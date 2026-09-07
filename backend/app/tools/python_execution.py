"""Tool: Python Execution
Executes Python code in an isolated subprocess with timeout, capturing stdout, stderr, and exit codes.
"""

import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from typing import Any


from app.tools.file_security import get_upload_dir, resolve_safe_path


def python_execution(
    code: str,
    timeout_seconds: int = 30,
    working_directory: str | None = None,
    env_vars: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Executes Python code in a separate subprocess inside the uploads directory.

    Args:
        code: Python source code string to execute.
        timeout_seconds: Maximum allowed execution time in seconds (default: 30).
        working_directory: Optional working directory inside uploads for the execution.
        env_vars: Optional environment variable overrides.

    Returns:
        dict: Execution results containing 'stdout', 'stderr', 'exit_code', and 'duration_ms'.
    """
    clean_code = code.strip()
    if not clean_code:
        return {
            "success": False,
            "error": "Code string cannot be empty.",
            "exit_code": -1,
        }

    # Prepare environment
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)

    try:
        if working_directory:
            cwd = resolve_safe_path(working_directory, default_to_root=True)
        else:
            cwd = get_upload_dir()
    except (PermissionError, ValueError) as err:
        return {
            "success": False,
            "error": str(err),
            "exit_code": -1,
        }

    # Create temporary script file to execute cleanly
    with tempfile.NamedTemporaryFile(
        mode="w",
        suffix=".py",
        encoding="utf-8",
        delete=False,
    ) as temp_file:
        temp_file.write(clean_code)
        temp_path = temp_file.name

    start_time = time.time()
    try:
        process = subprocess.run(
            [sys.executable, temp_path],
            cwd=str(cwd),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
        )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "success": process.returncode == 0,
            "exit_code": process.returncode,
            "stdout": process.stdout,
            "stderr": process.stderr,
            "duration_ms": elapsed_ms,
            "timed_out": False,
        }

    except subprocess.TimeoutExpired as exc:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "success": False,
            "error": f"Execution timed out after {timeout_seconds} seconds.",
            "exit_code": -1,
            "stdout": exc.stdout or "",
            "stderr": exc.stderr or "",
            "duration_ms": elapsed_ms,
            "timed_out": True,
        }

    except Exception as exc:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "success": False,
            "error": f"Failed executing python script: {exc}",
            "exit_code": -1,
            "stdout": "",
            "stderr": str(exc),
            "duration_ms": elapsed_ms,
            "timed_out": False,
        }

    finally:
        try:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
        except OSError:
            pass


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return python_execution(**kwargs)
