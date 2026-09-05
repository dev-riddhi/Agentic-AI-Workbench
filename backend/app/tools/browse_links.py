"""Tool: Browse Links
Scrapes and normalizes all hyperlinks from a webpage, distinguishing internal from external links.
"""

from typing import Any
import urllib.parse
from bs4 import BeautifulSoup
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def browse_links(
    url: str,
    same_domain_only: bool = False,
    max_links: int = 50,
    timeout: float = 15.0,
) -> dict[str, Any]:
    """Extracts, normalizes, and filters hyperlinks from a webpage.

    Args:
        url: Webpage URL to analyze.
        same_domain_only: If True, only return links within the same domain.
        max_links: Maximum number of distinct links to return (default: 50).
        timeout: HTTP request timeout in seconds.

    Returns:
        dict: List of discovered links with anchor text and internal/external classification.
    """
    clean_url = url.strip()
    if not clean_url.startswith(("http://", "https://")):
        clean_url = "https://" + clean_url

    parsed_base = urllib.parse.urlparse(clean_url)
    base_domain = parsed_base.netloc.lower()

    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            resp = client.get(clean_url, headers={"User-Agent": DEFAULT_USER_AGENT})
            resp.raise_for_status()
            html_text = resp.text

        soup = BeautifulSoup(html_text, "html.parser")
        links: list[dict[str, Any]] = []
        seen_urls: set[str] = set()

        for a_tag in soup.find_all("a", href=True):
            if len(links) >= max_links:
                break

            raw_href = a_tag["href"].strip()
            if not raw_href or raw_href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue

            # Resolve relative URLs
            absolute_url = urllib.parse.urljoin(clean_url, raw_href)
            parsed_target = urllib.parse.urlparse(absolute_url)

            if parsed_target.scheme not in ("http", "https"):
                continue

            # Remove URL fragment
            normalized_url = parsed_target._replace(fragment="").geturl()
            if normalized_url in seen_urls:
                continue

            target_domain = parsed_target.netloc.lower()
            is_internal = target_domain == base_domain or target_domain.endswith("." + base_domain)

            if same_domain_only and not is_internal:
                continue

            seen_urls.add(normalized_url)
            anchor_text = a_tag.get_text(strip=True) or a_tag.get("title", "") or "[No anchor text]"

            links.append({
                "text": anchor_text[:100],
                "url": normalized_url,
                "is_internal": is_internal,
                "domain": target_domain,
            })

        return {
            "success": True,
            "source_url": clean_url,
            "domain": base_domain,
            "total_links": len(links),
            "links": links,
        }

    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed browsing links: {exc}",
            "source_url": clean_url,
            "links": [],
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return browse_links(**kwargs)
