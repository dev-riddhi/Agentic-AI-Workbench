"""Tool: Extract Webpage Content
Parses a webpage from URL or raw HTML, stripping boilerplates (scripts, styles, ads)
and extracting clean readable text, title, headings, and metadata.
"""

from typing import Any
from bs4 import BeautifulSoup
import httpx

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)


def extract_webpage_content(
    url: str | None = None,
    html: str | None = None,
    timeout: float = 15.0,
    max_chars: int = 25000,
) -> dict[str, Any]:
    """Extracts clean text and metadata from a webpage URL or HTML string.

    Args:
        url: Webpage URL to fetch and parse.
        html: Raw HTML string (used directly if url is not provided).
        timeout: HTTP request timeout in seconds if fetching by URL.
        max_chars: Maximum character limit for extracted text (default: 25000).

    Returns:
        dict: Cleaned text content, page title, headings list, and word count.
    """
    raw_html = html or ""
    source_url = url or ""

    if url and not html:
        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url
        source_url = clean_url

        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                resp = client.get(clean_url, headers={"User-Agent": DEFAULT_USER_AGENT})
                resp.raise_for_status()
                raw_html = resp.text
        except Exception as exc:
            return {
                "success": False,
                "error": f"Failed fetching webpage for content extraction: {exc}",
                "url": source_url,
            }

    if not raw_html:
        return {
            "success": False,
            "error": "Either 'url' or 'html' parameter must be provided.",
        }

    try:
        soup = BeautifulSoup(raw_html, "html.parser")

        # Extract title
        title = ""
        if soup.title and soup.title.string:
            title = soup.title.string.strip()

        # Extract meta description
        description = ""
        meta_desc = soup.find("meta", attrs={"name": lambda x: x and x.lower() == "description"})
        if meta_desc and meta_desc.get("content"):
            description = meta_desc["content"].strip()

        # Extract major headings
        headings = [h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3"]) if h.get_text(strip=True)]

        # Remove boilerplates, scripts, styles, navigation, footer, ads
        for tag in soup(["script", "style", "noscript", "nav", "footer", "header", "aside", "svg", "iframe"]):
            tag.decompose()

        # Extract clean text
        body_text = soup.get_text(separator="\n", strip=True)
        # Collapse excessive newlines
        lines = [line.strip() for line in body_text.splitlines() if line.strip()]
        cleaned_text = "\n\n".join(lines)

        truncated = False
        if len(cleaned_text) > max_chars:
            cleaned_text = cleaned_text[:max_chars]
            truncated = True

        return {
            "success": True,
            "url": source_url,
            "title": title,
            "description": description,
            "headings": headings[:15],
            "word_count": len(cleaned_text.split()),
            "character_count": len(cleaned_text),
            "truncated": truncated,
            "text": cleaned_text,
        }

    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed extracting webpage content: {exc}",
            "url": source_url,
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return extract_webpage_content(**kwargs)
