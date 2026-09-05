import importlib.util
from pathlib import Path

# Load llama.cpp module dynamically since standard Python import syntax
# treats dots as subpackage delimiters.
_llama_cpp_file = Path(__file__).parent / "llama.cpp.py"

if _llama_cpp_file.exists():
    _spec = importlib.util.spec_from_file_location("llama_cpp_client", _llama_cpp_file)
    if _spec and _spec.loader:
        _module = importlib.util.module_from_spec(_spec)
        _spec.loader.exec_module(_module)
        get_client = _module.get_client
        get_running_models = _module.get_running_models
        get_running_models_details = _module.get_running_models_details
        request_model = _module.request_model
        chat = _module.chat
        LlamaCppClient = _module.LlamaCppClient

__all__ = [
    "get_client",
    "get_running_models",
    "get_running_models_details",
    "request_model",
    "chat",
    "LlamaCppClient",
]
