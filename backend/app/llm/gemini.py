"""Google Gemini LLM integration module with free-tier model support.

Provides the exact same function and client interfaces as llama.cpp.py:
1. get_client
2. get_running_models
3. get_running_models_details
4. request_model
5. chat
6. stream_chat
7. GeminiClient (and LlamaCppClient alias)

All operations route to the latest free-tier model: `gemini-2.5-flash-lite` (with fallback to `gemini-3-flash-preview`).
"""

from collections.abc import Iterator
import logging
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import errors, types

# Load environment variables from .env if present (supporting both workspace root and backend folder)
load_dotenv()
_backend_env = Path(__file__).resolve().parents[2] / ".env"
if _backend_env.is_file():
    load_dotenv(dotenv_path=_backend_env)

logger = logging.getLogger(__name__)

# Primary Gemini model for free-tier inference and testing
HARDCODED_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash-lite")
DEFAULT_MODEL: str = HARDCODED_MODEL
DEFAULT_FREE_TIER_MODEL: str = HARDCODED_MODEL

# Available free-tier models in Google AI Studio for automatic fallback
FREE_TIER_FALLBACKS: list[str] = [
    "gemini-2.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
]

DEFAULT_BASE_URL: str = os.getenv("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta")
DEFAULT_API_KEY: str = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or "gemini-api-key"
)

# Documentation and specifications for the model
HARDCODED_MODEL_SPECS: dict[str, Any] = {
    "id": HARDCODED_MODEL,
    "name": f"models/{HARDCODED_MODEL}",
    "created": None,
    "owned_by": "google",
    "displayName": "Gemini 2.5 Flash-Lite",
    "description": "Google Gemini 2.5 Flash-Lite - Latest high-speed, cost-efficient free-tier model for inference and testing.",
    "inputTokenLimit": 1048576,
    "outputTokenLimit": 65536,
    "supportedGenerationMethods": ["generateContent", "countTokens"],
    "rate_limits": {
        "rpm": 15,
        "tpm": 1000000,
        "rpd": 1500,
    },
}


class GeminiResponseChoice:
    """Compatibility wrapper providing both OpenAI-style and GenAI-style message attributes."""

    def __init__(self, content: str):
        self.message = type("Message", (), {"content": content, "role": "assistant"})()
        self.delta = type("Delta", (), {"content": content, "role": "assistant"})()


class GeminiResponseWrapper:
    """Unified response object compatible with both OpenAI and GenAI accessor patterns."""

    def __init__(self, text: str, raw_response: Any = None):
        self.text: str = text
        self.raw_response: Any = raw_response
        self.choices: list[GeminiResponseChoice] = [GeminiResponseChoice(text)]

    def __str__(self) -> str:
        return self.text

    def __repr__(self) -> str:
        return f"GeminiResponseWrapper(text={self.text!r})"


def get_api_key(api_key: str | None = None) -> str | None:
    """Retrieves the Gemini API key from parameter or environment variables."""
    key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if key and key != "gemini-api-key":
        return key
    return None


def get_client(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    timeout: float = 60.0,
    max_retries: int = 2,
    **kwargs: Any,
) -> genai.Client:
    """Creates and returns a Google GenAI client instance.

    Args:
        base_url: Optional base URL (kept for signature compatibility with llama.cpp.py).
        api_key: Optional Gemini/Google API key.
        timeout: Request timeout.
        max_retries: Max retry attempts.
    """
    resolved_key = get_api_key(api_key)
    if not resolved_key:
        raise ConnectionError(
            "Gemini API key is not configured. "
            "Please set GEMINI_API_KEY or GOOGLE_API_KEY in your environment or .env file."
        )
    return genai.Client(api_key=resolved_key, **kwargs)


def get_running_models(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    client: genai.Client | None = None,
    timeout: float = 5.0,
) -> list[str]:
    """Retrieves the running model ID list (returns only the single hardcoded model).

    Returns:
        ['gemini-2.5-flash']
    """
    return [HARDCODED_MODEL]


def get_running_models_details(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    client: genai.Client | None = None,
) -> list[dict[str, Any]]:
    """Retrieves full details of the single hardcoded Gemini model.

    Returns:
        List containing metadata for 'gemini-2.5-flash'.
    """
    return [dict(HARDCODED_MODEL_SPECS)]


# Also alias for backwards compatibility
get_available_models = get_running_models
get_available_models_details = get_running_models_details


def _prepare_contents(
    messages: list[dict[str, str]] | str,
    system_prompt: str | None = None,
) -> tuple[Any, str | None]:
    """Normalizes prompt or message dicts into Google GenAI format."""
    sys_inst = system_prompt
    if isinstance(messages, str):
        return messages, sys_inst

    formatted_contents: list[types.Content] = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "system":
            sys_inst = content
        elif role in ("assistant", "model"):
            formatted_contents.append(
                types.Content(role="model", parts=[types.Part.from_text(text=content)])
            )
        else:
            formatted_contents.append(
                types.Content(role="user", parts=[types.Part.from_text(text=content)])
            )

    return formatted_contents if formatted_contents else "", sys_inst


def request_model(
    model: str = HARDCODED_MODEL,
    messages: list[dict[str, str]] | str = "",
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    temperature: float = 0.7,
    max_tokens: int | None = 2048,
    stream: bool = False,
    client: genai.Client | None = None,
    system_prompt: str | None = None,
    **kwargs: Any,
) -> GeminiResponseWrapper | Iterator[GeminiResponseWrapper]:
    """Sends a generation request to the Gemini model (`gemini-2.5-flash-lite` with fallback).

    Args:
        model: Optional model identifier (defaults to HARDCODED_MODEL).
        messages: Either a prompt string or list of message dicts (role, content).
        base_url: Base URL (compatibility parameter).
        api_key: Optional API key.
        temperature: Sampling temperature.
        max_tokens: Maximum tokens to generate.
        stream: If True, yields GeminiResponseWrapper chunks.
        client: Optional pre-configured genai.Client.
        system_prompt: Optional system instructions.

    Returns:
        GeminiResponseWrapper (non-streaming) or Iterator of GeminiResponseWrapper (streaming).
    """
    cli = client
    if cli is None:
        try:
            cli = get_client(base_url=base_url, api_key=api_key)
        except ConnectionError as exc:
            logger.error("Failed to initialize Gemini client: %s", exc)
            raise ConnectionError(
                f"Gemini client error: {exc}. Please configure GEMINI_API_KEY or GOOGLE_API_KEY."
            ) from exc

    contents, sys_inst = _prepare_contents(messages, system_prompt)

    config = types.GenerateContentConfig(
        temperature=temperature,
        max_output_tokens=max_tokens,
        system_instruction=sys_inst if sys_inst else None,
    )

    # Determine priority list of models (requested model, then HARDCODED_MODEL, then fallbacks)
    initial_target = model or HARDCODED_MODEL
    candidate_models: list[str] = [initial_target]
    for alt in FREE_TIER_FALLBACKS:
        if alt not in candidate_models:
            candidate_models.append(alt)

    last_error: Exception | None = None
    for target_model in candidate_models:
        try:
            if stream:
                gen_stream = cli.models.generate_content_stream(
                    model=target_model,
                    contents=contents,
                    config=config,
                )

                def _stream_generator() -> Iterator[GeminiResponseWrapper]:
                    for chunk in gen_stream:
                        chunk_text = getattr(chunk, "text", "") or ""
                        if chunk_text:
                            yield GeminiResponseWrapper(text=chunk_text, raw_response=chunk)

                return _stream_generator()

            response = cli.models.generate_content(
                model=target_model,
                contents=contents,
                config=config,
            )
            full_text = getattr(response, "text", "") or ""
            return GeminiResponseWrapper(text=full_text, raw_response=response)

        except errors.APIError as exc:
            last_error = exc
            error_code = getattr(exc, "code", None)
            error_str = str(exc)
            # If rate-limited or model overloaded/unavailable, attempt fallback to other free tier models
            if error_code in (429, 503) or "RESOURCE_EXHAUSTED" in error_str or "UNAVAILABLE" in error_str:
                logger.warning(
                    "Gemini model '%s' quota exhausted or unavailable (%s). Attempting fallback model...",
                    target_model,
                    exc,
                )
                continue
            logger.error("Gemini API error for model '%s': %s", target_model, exc)
            raise

    if last_error:
        raise last_error
    raise RuntimeError("No Gemini models available for generation.")


def chat(
    model: str = HARDCODED_MODEL,
    prompt: str = "",
    system_prompt: str | None = None,
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    temperature: float = 0.7,
    max_tokens: int | None = 2048,
    client: genai.Client | None = None,
    **kwargs: Any,
) -> str:
    """Convenience helper: sends a prompt to the Gemini model and returns the text response."""
    actual_prompt = prompt or kwargs.pop("contents", "")
    actual_system_prompt = system_prompt or kwargs.pop("system_instruction", None)
    target_model = model or HARDCODED_MODEL

    cli = GeminiClient(base_url=base_url, api_key=api_key) if client is None else None
    if cli is not None:
        return cli.chat(
            model=target_model,
            prompt=actual_prompt,
            system_prompt=actual_system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
    resp = request_model(
        model=target_model,
        messages=actual_prompt,
        system_prompt=actual_system_prompt,
        base_url=base_url,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        client=client,
        stream=False,
        **kwargs,
    )
    if isinstance(resp, GeminiResponseWrapper):
        return resp.text
    return ""


def stream_chat(
    model: str = HARDCODED_MODEL,
    prompt: str = "",
    system_prompt: str | None = None,
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    temperature: float = 0.7,
    max_tokens: int | None = 2048,
    client: genai.Client | None = None,
    **kwargs: Any,
) -> Iterator[str]:
    """Convenience generator: streams text chunks token-by-token from the hardcoded Gemini model."""
    cli = GeminiClient(base_url=base_url, api_key=api_key) if client is None else None
    if cli is not None:
        yield from cli.stream_chat(
            model=HARDCODED_MODEL,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
        return

    stream = request_model(
        model=HARDCODED_MODEL,
        messages=prompt,
        system_prompt=system_prompt,
        base_url=base_url,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        client=client,
        stream=True,
        **kwargs,
    )
    if isinstance(stream, Iterator):
        for chunk in stream:
            yield chunk.text


class GeminiClient:
    """Object-oriented interface mirroring LlamaCppClient, strictly bound to the hardcoded Gemini model."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str = DEFAULT_API_KEY,
        timeout: float = 60.0,
        model: str = HARDCODED_MODEL,
    ):
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.model = HARDCODED_MODEL
        self._client: genai.Client | None = None

    @property
    def client(self) -> genai.Client:
        """Lazily initializes the genai.Client instance."""
        if self._client is None:
            self._client = get_client(base_url=self.base_url, api_key=self.api_key, timeout=self.timeout)
        return self._client

    def get_running_models(self) -> list[str]:
        """Returns list of running model IDs (only the single hardcoded model)."""
        return [HARDCODED_MODEL]

    def get_running_models_details(self) -> list[dict[str, Any]]:
        """Returns details for the single hardcoded model."""
        return [dict(HARDCODED_MODEL_SPECS)]

    def request_model(
        self,
        model: str = HARDCODED_MODEL,
        messages: list[dict[str, str]] | str = "",
        temperature: float = 0.7,
        max_tokens: int | None = 2048,
        stream: bool = False,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> GeminiResponseWrapper | Iterator[GeminiResponseWrapper]:
        """Requests generation from the single hardcoded model."""
        return request_model(
            model=HARDCODED_MODEL,
            messages=messages,
            client=self.client,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            system_prompt=system_prompt,
            **kwargs,
        )

    def chat(
        self,
        model: str = HARDCODED_MODEL,
        prompt: str = "",
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = 2048,
        **kwargs: Any,
    ) -> str:
        """Sends a prompt and returns the completed text response."""
        response = self.request_model(
            model=HARDCODED_MODEL,
            messages=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
            **kwargs,
        )
        if isinstance(response, GeminiResponseWrapper):
            return response.text
        return ""

    def stream_chat(
        self,
        model: str = HARDCODED_MODEL,
        prompt: str = "",
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = 2048,
        **kwargs: Any,
    ) -> Iterator[str]:
        """Streams text chunks token-by-token from the hardcoded model."""
        stream = self.request_model(
            model=HARDCODED_MODEL,
            messages=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )
        if isinstance(stream, Iterator):
            for chunk in stream:
                yield chunk.text


# Alias to allow interchangeable drop-in replacement
LlamaCppClient = GeminiClient
load_model = lambda model=HARDCODED_MODEL, **kwargs: GeminiClient(model=HARDCODED_MODEL, **kwargs)


# Quick verification when run directly
if __name__ == "__main__":
    print("=== Gemini LLM Module (Single Hardcoded Model) ===")
    print(f"Hardcoded Model: {HARDCODED_MODEL}")
    print(f"Running models: {get_running_models()}")
    print(f"Model details:  {get_running_models_details()}")

    client = GeminiClient()
    print(f"GeminiClient model: {client.model}")
    print("Client running models:", client.get_running_models())
    print("Verification completed successfully.")
