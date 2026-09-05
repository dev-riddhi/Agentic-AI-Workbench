"""Tool: Query APIs
Dispatches arbitrary HTTP REST requests (GET, POST, PUT, DELETE, PATCH) with JSON, parameters, and headers.
"""

import time
from typing import Any
import httpx

DEFAULT_USER_AGENT = "Agentic-AI-Workbench/1.0"


def query_apis(
    url: str,
    method: str = "GET",
    headers: dict[str, str] | None = None,
    params: dict[str, Any] | None = None,
    json_data: Any | None = None,
    form_data: dict[str, Any] | None = None,
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Queries an external or internal REST API endpoint.

    Args:
        url: Full API endpoint URL.
        method: HTTP method: 'GET', 'POST', 'PUT', 'DELETE', 'PATCH' (default: 'GET').
        headers: Optional dictionary of HTTP request headers.
        params: Optional dictionary of query parameters.
        json_data: Optional JSON serializable body for POST/PUT/PATCH requests.
        form_data: Optional form data dictionary.
        timeout: Request timeout in seconds (default: 30.0).

    Returns:
        dict: Result containing status_code, json or text response, headers, and latency_ms.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    req_method = method.strip().upper()
    req_headers = {"User-Agent": DEFAULT_USER_AGENT}
    if headers:
        req_headers.update(headers)

    start_time = time.time()

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.request(
                method=req_method,
                url=clean_url,
                headers=req_headers,
                params=params,
                json=json_data,
                data=form_data,
            )

        elapsed_ms = round((time.time() - start_time) * 1000, 2)

        # Attempt JSON parsing
        parsed_json = None
        is_json = False
        try:
            parsed_json = resp.json()
            is_json = True
        except Exception:
            parsed_json = None

        return {
            "success": resp.is_success,
            "status_code": resp.status_code,
            "url": str(resp.url),
            "latency_ms": elapsed_ms,
            "is_json": is_json,
            "data": parsed_json if is_json else resp.text[:10000],
            "headers": dict(resp.headers),
        }

    except Exception as exc:
        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "success": False,
            "error": f"API request to {clean_url} failed: {exc}",
            "latency_ms": elapsed_ms,
            "url": clean_url,
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return query_apis(**kwargs)
