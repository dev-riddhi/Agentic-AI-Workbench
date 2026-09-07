"""LLM Integration Package.

Exports both Google Gemini and local llama.cpp integration modules and clients
unconditionally without testing flags gating exports.
"""

import importlib.util
import logging
from pathlib import Path
import sys
from typing import Any

logger = logging.getLogger(__name__)

# 1. Load and export Google Gemini integration
from app.llm import gemini
from app.llm.gemini import (
    DEFAULT_FREE_TIER_MODEL,
    HARDCODED_MODEL,
    GeminiClient,
)

# 2. Dynamically load and export local llama.cpp integration
# Standard Python import cannot directly import 'llama.cpp.py' due to dots in filename.
_llama_cpp_file = Path(__file__).resolve().parent / "llama.cpp.py"
if _llama_cpp_file.exists():
    _spec = importlib.util.spec_from_file_location("app.llm.llama_cpp", _llama_cpp_file)
    if _spec and _spec.loader:
        llama_cpp = importlib.util.module_from_spec(_spec)
        sys.modules["app.llm.llama_cpp"] = llama_cpp
        _spec.loader.exec_module(llama_cpp)
    else:
        raise ImportError(f"Could not load specification for {_llama_cpp_file}")
else:
    raise FileNotFoundError(f"Module file not found: {_llama_cpp_file}")

# Aliases for flexible referencing:
# - from app.llm import llama_cpp
# - from app.llm import llama -> llama.cpp
# - getattr(app.llm, "llama.cpp")
llama = llama_cpp
setattr(llama, "cpp", llama_cpp)
setattr(sys.modules[__name__], "llama.cpp", llama_cpp)

# Dedicated client classes
LlamaCppClient = llama_cpp.LlamaCppClient

# Testing flag (defaults to False, dynamically checked via get_is_testing)
available_testing: bool = False
aviable_testing: bool = available_testing


def get_is_testing(db=None) -> bool:
    """Checks whether is_testing is enabled in the settings table (defaults to False)."""
    try:
        from app.features.settings.model import get_is_testing as _get_is_testing
        return _get_is_testing(db=db)
    except Exception:
        return getattr(sys.modules[__name__], "available_testing", False)


# Dynamic convenience functions that check is_testing from settings table:
# If is_testing is True -> use Gemini across the full backend.
# If is_testing is False -> use llama.cpp.py to get models and use them.

def get_running_models(base_url: str | None = None, api_key: str | None = None, client: Any = None, timeout: float = 5.0, db=None) -> list[str]:
    """If is_testing is True, returns Gemini running models; otherwise queries llama.cpp server."""
    if get_is_testing(db=db):
        return gemini.get_running_models()
    kwargs: dict[str, Any] = {"timeout": timeout}
    if base_url is not None:
        kwargs["base_url"] = base_url
    if api_key is not None:
        kwargs["api_key"] = api_key
    if client is not None:
        kwargs["client"] = client
    return llama_cpp.get_running_models(**kwargs)


def get_running_models_details(base_url: str | None = None, api_key: str | None = None, client: Any = None, db=None) -> list[dict[str, Any]]:
    if get_is_testing(db=db):
        return gemini.get_running_models_details()
    kwargs: dict[str, Any] = {}
    if base_url is not None:
        kwargs["base_url"] = base_url
    if api_key is not None:
        kwargs["api_key"] = api_key
    if client is not None:
        kwargs["client"] = client
    return llama_cpp.get_running_models_details(**kwargs)


def get_available_models(db=None) -> list[str]:
    if get_is_testing(db=db):
        return gemini.get_available_models()
    try:
        return llama_cpp.get_running_models()
    except Exception:
        return []


def get_available_models_details(db=None) -> list[dict[str, Any]]:
    if get_is_testing(db=db):
        return gemini.get_available_models_details()
    try:
        return llama_cpp.get_running_models_details()
    except Exception:
        return []


def chat(model: str | None = None, prompt: str = "", system_prompt: str | None = None, db=None, **kwargs: Any) -> str:
    """If is_testing is True, uses Gemini; if False, gets models from llama.cpp.py and uses them."""
    if get_is_testing(db=db):
        return gemini.chat(model=gemini.HARDCODED_MODEL, prompt=prompt, system_prompt=system_prompt, **kwargs)

    target_model = model
    if not target_model or target_model == "default":
        try:
            running = llama_cpp.get_running_models()
            if running:
                target_model = running[0]
        except Exception as exc:
            logger.warning("Could not get models from llama.cpp.py: %s", exc)
    return llama_cpp.chat(model=target_model or "default", prompt=prompt, system_prompt=system_prompt, **kwargs)


def stream_chat(model: str | None = None, prompt: str = "", system_prompt: str | None = None, db=None, **kwargs: Any):
    """If is_testing is True, streams from Gemini; if False, streams from llama.cpp.py model."""
    if get_is_testing(db=db):
        yield from gemini.stream_chat(model=gemini.HARDCODED_MODEL, prompt=prompt, system_prompt=system_prompt, **kwargs)
        return

    target_model = model
    if not target_model or target_model == "default":
        try:
            running = llama_cpp.get_running_models()
            if running:
                target_model = running[0]
        except Exception as exc:
            logger.warning("Could not get models from llama.cpp.py: %s", exc)
    yield from llama_cpp.stream_chat(model=target_model or "default", prompt=prompt, system_prompt=system_prompt, **kwargs)


def request_model(model: str | None = None, messages: Any = "", db=None, **kwargs: Any):
    """If is_testing is True, routes request to Gemini; if False, routes to llama.cpp.py."""
    if get_is_testing(db=db):
        return gemini.request_model(model=gemini.HARDCODED_MODEL, messages=messages, **kwargs)

    target_model = model
    if not target_model or target_model == "default":
        try:
            running = llama_cpp.get_running_models()
            if running:
                target_model = running[0]
        except Exception as exc:
            logger.warning("Could not get models from llama.cpp.py: %s", exc)
    return llama_cpp.request_model(model=target_model or "default", messages=messages, **kwargs)


get_client = gemini.get_client
load_model = getattr(gemini, "load_model", None)

# Explicit provider-specific helpers
gemini_request_model = gemini.request_model
gemini_chat = gemini.chat
llama_request_model = llama_cpp.request_model
llama_chat = llama_cpp.chat

__all__ = [
    # Submodules
    "gemini",
    "llama_cpp",
    "llama",
    # Clients
    "GeminiClient",
    "LlamaCppClient",
    # Model info
    "HARDCODED_MODEL",
    "DEFAULT_FREE_TIER_MODEL",
    # Universal / convenience methods
    "get_client",
    "get_running_models",
    "get_running_models_details",
    "get_available_models",
    "get_available_models_details",
    "request_model",
    "chat",
    "stream_chat",
    "load_model",
    # Explicit provider methods
    "gemini_request_model",
    "gemini_chat",
    "llama_request_model",
    "llama_chat",
    # Compatibility flags
    "available_testing",
    "aviable_testing",
]
