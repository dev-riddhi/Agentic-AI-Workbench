"""Tool: Search Images
Searches for image assets online via DuckDuckGo image endpoints, returning image URLs, thumbnails, and sources.
"""

import json
import re
from typing import Any
import urllib.parse
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def search_images(
    query: str,
    max_results: int = 10,
    timeout: float = 12.0,
) -> dict[str, Any]:
    """Searches for online images matching the query.

    Args:
        query: Search term for images (e.g. 'industrial hydraulic pump diagram').
        max_results: Maximum number of image results to return (default: 10).
        timeout: Request timeout in seconds.

    Returns:
        dict: Result containing list of image records with 'title', 'image_url', 'thumbnail', and 'source'.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"success": False, "error": "Query cannot be empty.", "query": query}

    headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Referer": "https://duckduckgo.com/",
    }

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            # 1. Obtain session token (vqd)
            token_url = f"https://duckduckgo.com/?q={urllib.parse.quote_plus(clean_query)}&iax=images&ia=images"
            token_resp = client.get(token_url, headers=headers)
            token_match = re.search(r'vqd=([\d-]+)&', token_resp.text) or re.search(r'vqd="([^"]+)"', token_resp.text)

            if not token_match:
                return {
                    "success": False,
                    "error": "Could not initialize image search session token.",
                    "query": clean_query,
                    "images": [],
                }

            vqd = token_match.group(1)

            # 2. Query DuckDuckGo image JSON API
            api_url = f"https://duckduckgo.com/i.js?q={urllib.parse.quote_plus(clean_query)}&o=json&p=1&s=0&u=bing&f=,,,&l=us-en&vqd={vqd}"
            api_resp = client.get(api_url, headers=headers)
            api_resp.raise_for_status()

            payload = api_resp.json()
            raw_results = payload.get("results", [])

            images: list[dict[str, Any]] = []
            for item in raw_results:
                if len(images) >= max_results:
                    break
                image_url = item.get("image")
                if not image_url or not image_url.startswith("http"):
                    continue

                images.append({
                    "title": item.get("title", ""),
                    "image_url": image_url,
                    "thumbnail_url": item.get("thumbnail", ""),
                    "source_url": item.get("url", ""),
                    "width": item.get("width"),
                    "height": item.get("height"),
                })

            return {
                "success": True,
                "query": clean_query,
                "total_images": len(images),
                "images": images,
            }

    except Exception as exc:
        return {
            "success": False,
            "error": f"Image search failed: {exc}",
            "query": clean_query,
            "images": [],
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return search_images(**kwargs)
