"""Tool: Search News
Searches for recent news articles and headlines using open RSS search feeds without requiring API keys.
"""

from datetime import datetime
from typing import Any
import urllib.parse
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def search_news(
    query: str,
    max_results: int = 10,
    timeout: float = 12.0,
) -> dict[str, Any]:
    """Searches recent news articles and returns structured headlines and sources.

    Args:
        query: News topic or query string.
        max_results: Maximum number of news items to return (default: 10).
        timeout: Request timeout in seconds.

    Returns:
        dict: Result containing list of news articles with 'title', 'url', 'source', and 'published_date'.
    """
    clean_query = query.strip()
    if not clean_query:
        return {"success": False, "error": "Query cannot be empty.", "query": query}

    encoded_query = urllib.parse.quote_plus(clean_query)
    rss_url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-US&gl=US&ceid=US:en"

    headers = {"User-Agent": DEFAULT_USER_AGENT}

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(rss_url, headers=headers)
            resp.raise_for_status()
            rss_content = resp.content

        root = ET.fromstring(rss_content)
        channel = root.find("channel")
        if channel is None:
            return {
                "success": True,
                "query": clean_query,
                "total_articles": 0,
                "articles": [],
            }

        articles: list[dict[str, Any]] = []
        for item in channel.findall("item"):
            if len(articles) >= max_results:
                break

            title_elem = item.find("title")
            link_elem = item.find("link")
            pub_date_elem = item.find("pubDate")
            source_elem = item.find("source")
            desc_elem = item.find("description")

            title = title_elem.text.strip() if title_elem is not None and title_elem.text else ""
            link = link_elem.text.strip() if link_elem is not None and link_elem.text else ""
            pub_date = pub_date_elem.text.strip() if pub_date_elem is not None and pub_date_elem.text else ""
            source = source_elem.text.strip() if source_elem is not None and source_elem.text else ""

            # Extract clean snippet from HTML description if present
            snippet = ""
            if desc_elem is not None and desc_elem.text:
                soup = BeautifulSoup(desc_elem.text, "html.parser")
                snippet = soup.get_text(strip=True)

            if title and link:
                articles.append({
                    "title": title,
                    "url": link,
                    "source": source or "News Source",
                    "published_date": pub_date,
                    "snippet": snippet[:250],
                })

        return {
            "success": True,
            "query": clean_query,
            "total_articles": len(articles),
            "articles": articles,
        }

    except Exception as exc:
        return {
            "success": False,
            "error": f"News search failed: {exc}",
            "query": clean_query,
            "articles": [],
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return search_news(**kwargs)
