import unittest
from unittest.mock import patch, MagicMock
from pathlib import Path
from app.runtime.model_runtime import ModelRuntime

class TestModelRuntimeCLI(unittest.TestCase):
    @patch("subprocess.Popen")
    def test_cli_flags_generation(self, mock_popen):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_proc.stdout = MagicMock()
        mock_proc.stdout.readline.side_effect = [""]
        mock_proc.stdout.close = MagicMock()
        mock_proc.stderr = MagicMock()
        mock_popen.return_value = mock_proc

        runtime = ModelRuntime()
        
        with patch.object(runtime, "resolve_llama_server_path", return_value=Path("/bin/llama-server")), \
             patch.object(runtime, "resolve_model_path", return_value=(Path("/models/test.gguf"), "test.gguf")), \
             patch.object(runtime, "wait_until_ready", return_value=True):
            status = runtime.start(
                model_identifier="test.gguf",
                port=8080,
                ctx_size=4096,
                n_gpu_layers=33,
                n_cpu_moe=8,
                mmap=True,
                mlock=True,
                cache_type_k="turbo4",
                cache_type_v="turbo3",
                wait_ready=False
            )

        self.assertTrue(status["running"])
        self.assertEqual(status["n_cpu_moe"], 8)
        self.assertTrue(status["mmap"])
        self.assertTrue(status["mlock"])
        self.assertEqual(status["cache_type_k"], "turbo4")
        self.assertEqual(status["cache_type_v"], "turbo3")

        # Verify CLI args passed to subprocess.Popen
        args = mock_popen.call_args[0][0]
        self.assertIn("--n-cpu-moe", args)
        self.assertEqual(args[args.index("--n-cpu-moe") + 1], "8")
        self.assertIn("--mmap", args)
        self.assertIn("--mlock", args)
        self.assertIn("--cache-type-k", args)
        self.assertEqual(args[args.index("--cache-type-k") + 1], "turbo4")
        self.assertIn("--cache-type-v", args)
        self.assertEqual(args[args.index("--cache-type-v") + 1], "turbo3")

    @patch("subprocess.Popen")
    def test_cli_flags_mmap_false(self, mock_popen):
        mock_proc = MagicMock()
        mock_proc.poll.return_value = None
        mock_proc.stdout = MagicMock()
        mock_proc.stdout.readline.side_effect = [""]
        mock_proc.stdout.close = MagicMock()
        mock_proc.stderr = MagicMock()
        mock_popen.return_value = mock_proc

        runtime = ModelRuntime()
        
        with patch.object(runtime, "resolve_llama_server_path", return_value=Path("/bin/llama-server")), \
             patch.object(runtime, "resolve_model_path", return_value=(Path("/models/test.gguf"), "test.gguf")), \
             patch.object(runtime, "wait_until_ready", return_value=True):
            runtime.start(
                model_identifier="test.gguf",
                mmap=False,
                mlock=False,
                wait_ready=False
            )

        args = mock_popen.call_args[0][0]
        self.assertIn("--no-mmap", args)
        self.assertNotIn("--mlock", args)

if __name__ == "__main__":
    unittest.main()
