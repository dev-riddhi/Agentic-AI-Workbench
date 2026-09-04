from collections import deque
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import shutil
import subprocess
import threading
import time
from typing import Any
import urllib.request
import urllib.error
import json
from uuid import UUID

from database.database import SessionLocal
from database.models.ai_model import AIModel

logger = logging.getLogger(__name__)


class ModelRuntime:
    """Manages the lifecycle of a llama-server background subprocess
    running local GGUF models from backend/llama.cpp.
    """

    def __init__(self):
        self.process: subprocess.Popen | None = None
        self.current_model_path: Path | None = None
        self.current_model_name: str | None = None
        self.host: str = "127.0.0.1"
        self.port: int = 8080
        self.ctx_size: int = 4096
        self.n_gpu_layers: int = 99
        self.threads: int | None = None
        self.start_time: float | None = None
        self.logs: deque[str] = deque(maxlen=500)
        self._log_thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def resolve_llama_server_path(self) -> Path:
        """Locates the compiled llama-server executable in backend/llama.cpp."""
        backend_dir = Path(__file__).resolve().parents[2]
        candidate_paths = [
            backend_dir / "llama.cpp" / "bin" / "Release" / "llama-server.exe",
            backend_dir / "llama.cpp" / "build" / "bin" / "Release" / "llama-server.exe",
            backend_dir / "llama.cpp" / "build" / "bin" / "llama-server.exe",
            backend_dir / "llama.cpp" / "bin" / "llama-server.exe",
            backend_dir / "llama.cpp" / "build" / "bin" / "Release" / "llama-server",
            backend_dir / "llama.cpp" / "build" / "bin" / "llama-server",
            backend_dir / "llama.cpp" / "bin" / "llama-server",
        ]

        for candidate in candidate_paths:
            if candidate.is_file():
                return candidate

        raise FileNotFoundError(
            "llama-server executable not found in backend/llama.cpp. "
            "Please run 'powershell -File backend/build_llama.ps1' to compile it."
        )

    def resolve_model_path(self, model_identifier: str | Path | UUID) -> tuple[Path, str]:
        """Resolves a model identifier (file path, filename, model name, or UUID)
        to an absolute Path and friendly name.
        """
        backend_dir = Path(__file__).resolve().parents[2]
        models_base_dir = backend_dir / "models"

        # 1. Direct path check
        candidate_path = Path(str(model_identifier))
        if not candidate_path.is_absolute():
            candidate_path = backend_dir / candidate_path

        if candidate_path.is_file() and candidate_path.suffix.lower() == ".gguf":
            return candidate_path, candidate_path.stem

        # 2. Check within models_base_dir by filename
        str_id = str(model_identifier).strip()
        if not str_id.lower().endswith(".gguf"):
            search_filename = f"{str_id}.gguf"
        else:
            search_filename = str_id

        direct_in_models = models_base_dir / search_filename
        if direct_in_models.is_file():
            return direct_in_models, direct_in_models.stem

        # Search recursively in models directory
        for gguf_file in models_base_dir.rglob("*.gguf"):
            if gguf_file.name.lower() == search_filename.lower() or gguf_file.stem.lower() == str_id.lower():
                return gguf_file, gguf_file.stem

        # 3. Lookup in database by UUID or Name
        with SessionLocal() as db:
            db_model = None
            try:
                # Try parsing as UUID
                model_uuid = UUID(str_id)
                db_model = db.query(AIModel).filter(AIModel.id == model_uuid).first()
            except (ValueError, AttributeError):
                # Search by friendly name or filename
                db_model = (
                    db.query(AIModel)
                    .filter(
                        (AIModel.name == str_id)
                        | (AIModel.filename == search_filename)
                        | (AIModel.filename == str_id)
                    )
                    .first()
                )

            if db_model and db_model.file_path:
                db_path = Path(db_model.file_path)
                if not db_path.is_absolute():
                    db_path = backend_dir / db_path
                if db_path.is_file():
                    return db_path, db_model.name

        raise FileNotFoundError(
            f"GGUF model '{model_identifier}' could not be resolved in {models_base_dir} or the database."
        )

    def _stream_process_logs(self, proc: subprocess.Popen):
        """Reads stdout/stderr lines from the subprocess into the log ring buffer."""
        try:
            if proc.stdout:
                for line in iter(proc.stdout.readline, ""):
                    if not line:
                        break
                    clean_line = line.rstrip()
                    self.logs.append(clean_line)
        except Exception as e:
            logger.debug("Exception reading llama-server logs: %s", e)
        finally:
            if proc.stdout:
                proc.stdout.close()

    def is_running(self) -> bool:
        """Returns True if the llama-server subprocess is currently active."""
        with self._lock:
            return self.process is not None and self.process.poll() is None

    def is_ready(self) -> bool:
        """Checks if llama-server /health endpoint responds with status 200 and 'ok'."""
        if not self.is_running():
            return False

        url = f"http://{self.host}:{self.port}/health"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Agentic-Workbench"})
            with urllib.request.urlopen(req, timeout=1.5) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data.get("status") == "ok"
        except Exception:
            return False

        return False

    def wait_until_ready(self, timeout: float = 30.0, check_interval: float = 0.5) -> bool:
        """Waits until the server reports ready or timeout is reached."""
        deadline = time.time() + timeout
        while time.time() < deadline:
            if not self.is_running():
                return False
            if self.is_ready():
                return True
            time.sleep(check_interval)
        return False

    def start(
        self,
        model_identifier: str | Path | UUID,
        host: str = "127.0.0.1",
        port: int = 8080,
        ctx_size: int = 4096,
        n_gpu_layers: int = 99,
        threads: int | None = None,
        wait_ready: bool = True,
        timeout: float = 30.0,
        extra_args: list[str] | None = None,
    ) -> dict[str, Any]:
        """Starts the llama-server subprocess with the selected model."""
        server_exe = self.resolve_llama_server_path()
        model_path, model_name = self.resolve_model_path(model_identifier)

        with self._lock:
            # If already running with identical model and port, keep it active
            if (
                self.process is not None
                and self.process.poll() is None
                and self.current_model_path == model_path
                and self.port == port
                and self.host == host
            ):
                logger.info("llama-server already running with model %s on port %d", model_name, port)
                return self.get_status()

            # Stop existing instance if running
            self._stop_unlocked(timeout=5.0)

            # Determine thread count
            cpu_threads = threads or os.cpu_count() or 4

            # Build command arguments
            cmd = [
                str(server_exe),
                "-m", str(model_path),
                "--host", host,
                "--port", str(port),
                "-c", str(ctx_size),
                "-ngl", str(n_gpu_layers),
                "-t", str(cpu_threads),
            ]

            if extra_args:
                cmd.extend(extra_args)

            logger.info("Starting llama-server: %s", " ".join(cmd))
            self.logs.append(f"[{datetime.now().isoformat()}] Starting: {' '.join(cmd)}")

            # Windows process configuration
            creationflags = 0
            if os.name == "nt":
                creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                cwd=str(server_exe.parent),
                creationflags=creationflags,
            )

            self.current_model_path = model_path
            self.current_model_name = model_name
            self.host = host
            self.port = port
            self.ctx_size = ctx_size
            self.n_gpu_layers = n_gpu_layers
            self.threads = cpu_threads
            self.start_time = time.time()

            # Start background thread to capture stdout/stderr lines
            self._log_thread = threading.Thread(
                target=self._stream_process_logs,
                args=(self.process,),
                name="llama-server-logger",
                daemon=True,
            )
            self._log_thread.start()

        if wait_ready:
            is_ok = self.wait_until_ready(timeout=timeout)
            if not is_ok and not self.is_running():
                exit_code = self.process.poll() if self.process else -1
                recent_logs = "\n".join(list(self.logs)[-10:])
                raise RuntimeError(
                    f"llama-server process exited unexpectedly with code {exit_code}.\n"
                    f"Recent logs:\n{recent_logs}"
                )

        return self.get_status()

    def _stop_unlocked(self, timeout: float = 5.0) -> None:
        """Internal helper to terminate process while lock is already held."""
        if self.process is None:
            return

        if self.process.poll() is None:
            logger.info("Stopping llama-server PID %s", self.process.pid)
            self.logs.append(f"[{datetime.now().isoformat()}] Stopping llama-server PID {self.process.pid}")
            try:
                self.process.terminate()
                self.process.wait(timeout=timeout)
            except (subprocess.TimeoutExpired, Exception):
                logger.warning("llama-server did not terminate gracefully; killing PID %s", self.process.pid)
                try:
                    self.process.kill()
                    self.process.wait(timeout=2.0)
                except Exception:
                    pass

        self.process = None
        self.current_model_path = None
        self.current_model_name = None
        self.start_time = None

    def stop(self, timeout: float = 5.0) -> dict[str, Any]:
        """Gracefully stops the active llama-server process."""
        with self._lock:
            self._stop_unlocked(timeout=timeout)
        return self.get_status()

    def get_status(self) -> dict[str, Any]:
        """Returns the current operational status of the llama-server subprocess."""
        running = self.is_running()
        uptime = (time.time() - self.start_time) if (running and self.start_time) else None

        return {
            "running": running,
            "ready": self.is_ready() if running else False,
            "pid": self.process.pid if running and self.process else None,
            "model_path": str(self.current_model_path) if self.current_model_path else None,
            "model_name": self.current_model_name,
            "host": self.host,
            "port": self.port,
            "ctx_size": self.ctx_size,
            "n_gpu_layers": self.n_gpu_layers,
            "threads": self.threads,
            "base_url": f"http://{self.host}:{self.port}/v1",
            "health_url": f"http://{self.host}:{self.port}/health",
            "uptime_seconds": round(uptime, 2) if uptime is not None else None,
        }

    def get_logs(self, lines: int = 100) -> list[str]:
        """Returns the most recent log entries from the llama-server process."""
        with self._lock:
            all_logs = list(self.logs)
            return all_logs[-lines:] if lines > 0 else all_logs


# Global singleton instance
model_runtime = ModelRuntime()


# Module-level convenience functions
def start_model_server(
    model_identifier: str | Path | UUID,
    host: str = "127.0.0.1",
    port: int = 8080,
    ctx_size: int = 4096,
    n_gpu_layers: int = 99,
    threads: int | None = None,
    wait_ready: bool = True,
    timeout: float = 30.0,
    extra_args: list[str] | None = None,
) -> dict[str, Any]:
    """Starts the llama-server subprocess using the global model_runtime."""
    return model_runtime.start(
        model_identifier=model_identifier,
        host=host,
        port=port,
        ctx_size=ctx_size,
        n_gpu_layers=n_gpu_layers,
        threads=threads,
        wait_ready=wait_ready,
        timeout=timeout,
        extra_args=extra_args,
    )


def stop_model_server(timeout: float = 5.0) -> dict[str, Any]:
    """Stops the global llama-server instance."""
    return model_runtime.stop(timeout=timeout)


def get_model_server_status() -> dict[str, Any]:
    """Returns status of the global llama-server instance."""
    return model_runtime.get_status()


def get_model_server_logs(lines: int = 100) -> list[str]:
    """Returns recent log lines from the global llama-server instance."""
    return model_runtime.get_logs(lines=lines)
