"""Tool: Fetch Webpage
Fetches the raw content of a given URL with support for custom headers, redirects, and timeouts.
"""

from typing import Any
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def fetch_webpage(
    url: str,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
    max_bytes: int | None = 2 * 1024 * 1024,
) -> dict[str, Any]:
    """Downloads raw content from a webpage URL.

    Args:
        url: Full HTTP or HTTPS web address.
        headers: Optional dictionary of HTTP request headers.
        timeout: Request timeout in seconds (default: 15.0).
        max_bytes: Maximum number of response bytes to return (default: 2MB).

    Returns:
        dict: Result containing 'status_code', 'content', 'headers', 'url'.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    req_headers = {"User-Agent": DEFAULT_USER_AGENT}
    if headers:
        req_headers.update(headers)

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(clean_url, headers=req_headers)
            content_type = resp.headers.get("content-type", "")
            raw_text = resp.text

            if max_bytes and len(raw_text.encode("utf-8", errors="ignore")) > max_bytes:
                truncated_text = raw_text[:max_bytes]
                truncated = True
            else:
                truncated_text = raw_text
                truncated = False

            return {
                "success": resp.is_success,
                "status_code": resp.status_code,
                "url": str(resp.url),
                "content_type": content_type,
                "size_bytes": len(raw_text.encode("utf-8", errors="ignore")),
                "truncated": truncated,
                "content": truncated_text,
            }

    except httpx.TimeoutException:
        return {
            "success": False,
            "error": f"Request to '{clean_url}' timed out after {timeout} seconds.",
            "url": clean_url,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to fetch webpage: {exc}",
            "url": clean_url,
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return fetch_webpage(**kwargs)
