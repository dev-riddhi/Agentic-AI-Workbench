"""Local LLM integration module using the OpenAI Python SDK to communicate
with a local llama.cpp server (llama-server.exe).

Provides functions and a client class to:
1. Retrieve the list of currently running/available models from the llama-server.
2. Send chat completion and generation requests to a selected model.
"""

from collections.abc import Iterator
import logging
import os
from typing import Any

from openai import APIConnectionError, APIError, OpenAI
from openai.types.chat import ChatCompletion, ChatCompletionChunk

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = os.getenv("LLAMA_CPP_BASE_URL", "http://127.0.0.1:8080/v1")
DEFAULT_API_KEY = os.getenv("LLAMA_CPP_API_KEY", "llama-cpp")


def get_client(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    timeout: float = 30.0,
    max_retries: int = 1,
) -> OpenAI:
    """Creates and returns an OpenAI client configured for the local llama.cpp server."""
    return OpenAI(
        base_url=base_url,
        api_key=api_key,
        timeout=timeout,
        max_retries=max_retries,
    )


def get_running_models(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    client: OpenAI | None = None,
    timeout: float = 5.0,
) -> list[str]:
    """Retrieves the list of currently running/loaded model IDs from the llama.cpp server.

    Args:
        base_url: Base URL of the llama-server OpenAI API (e.g. http://127.0.0.1:8080/v1).
        api_key: Optional API key (llama-server does not require a real key).
        client: Optional pre-configured OpenAI client.
        timeout: Network timeout in seconds (default: 5.0s).

    Returns:
        A list of model ID strings (e.g. ['qwen2.5-7b-instruct', ...]).

    Raises:
        ConnectionError: If llama-server is not running or unreachable.
        APIError: For other OpenAI/llama-server API errors.
    """
    cli = client or get_client(base_url=base_url, api_key=api_key, timeout=timeout, max_retries=0)
    try:
        response = cli.models.list()
        return [model.id for model in response.data]
    except APIConnectionError as exc:
        logger.error("Failed to connect to llama.cpp server at %s: %s", base_url, exc)
        raise ConnectionError(
            f"llama.cpp server is not running or unreachable at {base_url}. "
            "Please ensure llama-server is started."
        ) from exc
    except APIError as exc:
        logger.error("API error while listing models from llama.cpp: %s", exc)
        raise


def get_running_models_details(
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    client: OpenAI | None = None,
) -> list[dict[str, Any]]:
    """Retrieves full details of models currently loaded on the llama.cpp server.

    Returns:
        List of dictionaries with id, created, owned_by, and metadata.
    """
    cli = client or get_client(base_url=base_url, api_key=api_key)
    try:
        response = cli.models.list()
        return [
            {
                "id": m.id,
                "created": getattr(m, "created", None),
                "owned_by": getattr(m, "owned_by", "llama.cpp"),
            }
            for m in response.data
        ]
    except APIConnectionError as exc:
        raise ConnectionError(
            f"llama.cpp server is not running or unreachable at {base_url}."
        ) from exc


def request_model(
    model: str,
    messages: list[dict[str, str]] | str,
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    temperature: float = 0.7,
    max_tokens: int | None = 512,
    stream: bool = False,
    client: OpenAI | None = None,
    system_prompt: str | None = None,
    **kwargs: Any,
) -> ChatCompletion | Iterator[ChatCompletionChunk]:
    """Sends a chat completion request to the specified model on the llama.cpp server.

    Args:
        model: Identifier of the model to request (from get_running_models).
        messages: Either a list of message dicts (role, content) or a raw prompt string.
        base_url: Base URL of the llama-server OpenAI API.
        api_key: Optional API key.
        temperature: Sampling temperature (0.0 to 2.0).
        max_tokens: Maximum number of tokens to generate.
        stream: If True, returns an iterator yielding ChatCompletionChunks.
        client: Optional pre-configured OpenAI client.
        system_prompt: Optional system prompt prepended if messages is a string.
        **kwargs: Additional parameters passed to client.chat.completions.create.

    Returns:
        ChatCompletion object if stream=False, or an iterator of chunks if stream=True.
    """
    cli = client or get_client(base_url=base_url, api_key=api_key)

    # Normalize messages argument
    formatted_messages: list[dict[str, str]] = []
    if isinstance(messages, str):
        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})
        formatted_messages.append({"role": "user", "content": messages})
    else:
        formatted_messages = list(messages)
        if system_prompt and not any(m.get("role") == "system" for m in formatted_messages):
            formatted_messages.insert(0, {"role": "system", "content": system_prompt})

    try:
        return cli.chat.completions.create(
            model=model,
            messages=formatted_messages,  # type: ignore[arg-type]
            temperature=temperature,
            max_tokens=max_tokens,
            stream=stream,
            **kwargs,
        )
    except APIConnectionError as exc:
        logger.error("Failed to reach llama.cpp server at %s for model '%s': %s", base_url, model, exc)
        raise ConnectionError(
            f"llama.cpp server is not running or unreachable at {base_url}."
        ) from exc
    except APIError as exc:
        logger.error("OpenAI API error from llama.cpp server: %s", exc)
        raise


class LlamaCppClient:
    """Object-oriented interface to interact with a local llama.cpp server."""

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str = DEFAULT_API_KEY,
        timeout: float = 60.0,
    ):
        self.base_url = base_url
        self.api_key = api_key
        self.timeout = timeout
        self.client = get_client(base_url=base_url, api_key=api_key, timeout=timeout)

    def get_running_models(self) -> list[str]:
        """Returns list of running model IDs."""
        return get_running_models(client=self.client, base_url=self.base_url)

    def get_running_models_details(self) -> list[dict[str, Any]]:
        """Returns detailed information on running models."""
        return get_running_models_details(client=self.client, base_url=self.base_url)

    def request_model(
        self,
        model: str,
        messages: list[dict[str, str]] | str,
        temperature: float = 0.7,
        max_tokens: int | None = 512,
        stream: bool = False,
        system_prompt: str | None = None,
        **kwargs: Any,
    ) -> ChatCompletion | Iterator[ChatCompletionChunk]:
        """Requests completion from the selected model."""
        return request_model(
            model=model,
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
        model: str,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = 512,
        **kwargs: Any,
    ) -> str:
        """High-level convenience method: sends a prompt and returns the text response."""
        response = self.request_model(
            model=model,
            messages=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=False,
            **kwargs,
        )
        if isinstance(response, ChatCompletion) and response.choices:
            msg = response.choices[0].message
            content = msg.content or ""
            if not content and hasattr(msg, "reasoning_content") and msg.reasoning_content:
                content = msg.reasoning_content
            return content
        return ""

    def stream_chat(
        self,
        model: str,
        prompt: str,
        system_prompt: str | None = None,
        temperature: float = 0.7,
        max_tokens: int | None = 512,
        **kwargs: Any,
    ) -> Iterator[str]:
        """High-level convenience generator: streams token chunks as text."""
        stream = self.request_model(
            model=model,
            messages=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs,
        )
        for chunk in stream:  # type: ignore[union-attr]
            if isinstance(chunk, ChatCompletionChunk) and chunk.choices:
                delta = chunk.choices[0].delta
                delta_content = delta.content or getattr(delta, "reasoning_content", None)
                if delta_content:
                    yield delta_content


def chat(
    model: str,
    prompt: str,
    system_prompt: str | None = None,
    base_url: str = DEFAULT_BASE_URL,
    api_key: str = DEFAULT_API_KEY,
    temperature: float = 0.7,
    max_tokens: int | None = 512,
    client: OpenAI | None = None,
    **kwargs: Any,
) -> str:
    """Convenience helper: sends a prompt to the selected model and returns the text response."""
    cli = LlamaCppClient(base_url=base_url, api_key=api_key) if client is None else None
    if cli is not None:
        return cli.chat(
            model=model,
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs,
        )
    resp = request_model(
        model=model,
        messages=prompt,
        system_prompt=system_prompt,
        base_url=base_url,
        api_key=api_key,
        temperature=temperature,
        max_tokens=max_tokens,
        client=client,
        stream=False,
        **kwargs,
    )
    if isinstance(resp, ChatCompletion) and resp.choices:
        msg = resp.choices[0].message
        return msg.content or getattr(msg, "reasoning_content", "") or ""
    return ""


# Quick manual verification when run directly
if __name__ == "__main__":
    import sys

    print("Checking local llama.cpp server at:", DEFAULT_BASE_URL)
    try:
        models = get_running_models()
        print("Running models found:", models)

        if models:
            target_model = models[0]
            print(f"\nSending test prompt to model '{target_model}'...")
            llm = LlamaCppClient()
            reply = llm.chat(
                model=target_model,
                prompt="Hello! Please introduce yourself briefly.",
                system_prompt="You are a helpful and concise local AI assistant.",
            )
            print("\nResponse:\n", reply)
        else:
            print("No models currently loaded on llama-server.")
    except ConnectionError as e:
        print(f"Connection failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
