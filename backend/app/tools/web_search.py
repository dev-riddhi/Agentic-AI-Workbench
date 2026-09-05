"""Tool: Web Search
Executes web searches using public DuckDuckGo endpoints with zero API keys required.
"""

from typing import Any
import urllib.parse
from bs4 import BeautifulSoup
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def web_search(
    query: str,
    max_results: int = 8,
    region: str = "us-en",
    timeout: float = 12.0,
) -> dict[str, Any]:
    """Executes a web search and extracts structured search results.

    Args:
        query: Search query string.
        max_results: Maximum number of search results to return (default: 8).
        region: Search region filter (default: 'us-en').
        timeout: HTTP request timeout in seconds.

    Returns:
        dict: Result containing list of search hits with 'title', 'url', and 'snippet'.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"success": False, "error": "Query cannot be empty.", "query": query}

    endpoint = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {"q": clean_query, "kl": region}

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.post(endpoint, data=data, headers=headers)
            resp.raise_for_status()
            html_text = resp.text

        soup = BeautifulSoup(html_text, "html.parser")
        results: list[dict[str, str]] = []

        # Parse standard DDG HTML result elements
        result_elements = soup.find_all("div", class_="result")
        for elem in result_elements:
            if len(results) >= max_results:
                break

            title_elem = elem.find("a", class_="result__a")
            snippet_elem = elem.find("a", class_="result__snippet")

            if not title_elem:
                continue

            raw_url = title_elem.get("href", "")
            # DuckDuckGo wraps URLs in uddg redirect: /l/?uddg=https%3A%2F%2Fexample.com
            actual_url = raw_url
            if "/l/?uddg=" in raw_url:
                parsed_qs = urllib.parse.parse_qs(urllib.parse.urlparse(raw_url).query)
                if "uddg" in parsed_qs:
                    actual_url = parsed_qs["uddg"][0]

            title = title_elem.get_text(strip=True)
            snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""

            if title and actual_url and actual_url.startswith("http"):
                results.append({
                    "title": title,
                    "url": actual_url,
                    "snippet": snippet,
                })

        return {
            "success": True,
            "query": clean_query,
            "total_results": len(results),
            "results": results,
        }

    except Exception as exc:
        return {
            "success": False,
            "error": f"Web search failed: {exc}",
            "query": clean_query,
            "results": [],
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return web_search(**kwargs)
