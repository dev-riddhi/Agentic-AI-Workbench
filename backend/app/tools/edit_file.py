"""Tool: Edit File
Performs find-and-replace or targeted substring edits within an existing file.
"""

from pathlib import Path
import re
from typing import Any


def edit_file(
    file_path: str,
    target_content: str,
    replacement_content: str,
    replace_all: bool = False,
    is_regex: bool = False,
    encoding: str = "utf-8",
) -> dict[str, Any]:
    """Edits a file by replacing instances of target_content with replacement_content.

    Args:
        file_path: Absolute or relative path to the file.
        target_content: String or regex pattern to search for.
        replacement_content: String to replace the target with.
        replace_all: If True, replace all occurrences; otherwise, only the first occurrence.
        is_regex: If True, treat target_content as a regular expression pattern.
        encoding: File character encoding (default: 'utf-8').

    Returns:
        dict: Result containing 'success', 'file_path', and 'replacements_count'.
    """
    path = Path(file_path).resolve()
    if not path.exists():
        return {
            "success": False,
            "error": f"File does not exist: {file_path}",
            "file_path": str(path),
        }
    if not path.is_file():
        return {
            "success": False,
            "error": f"Path is not a file: {file_path}",
            "file_path": str(path),
        }

    try:
        with open(path, "r", encoding=encoding, errors="replace") as f:
            original = f.read()

        count = 0
        if is_regex:
            pattern = re.compile(target_content)
            matches = list(pattern.finditer(original))
            count = len(matches)
            if count == 0:
                return {
                    "success": False,
                    "error": f"Target regex pattern not found in file: {target_content}",
                    "file_path": str(path),
                    "replacements_count": 0,
                }
            max_count = 0 if replace_all else 1
            new_content = pattern.sub(replacement_content, original, count=max_count)
            actual_replaced = count if replace_all else 1
        else:
            count = original.count(target_content)
            if count == 0:
                return {
                    "success": False,
                    "error": "Target content not found in file.",
                    "file_path": str(path),
                    "replacements_count": 0,
                }
            max_count = -1 if replace_all else 1
            new_content = original.replace(target_content, replacement_content, max_count)
            actual_replaced = count if replace_all else 1

        with open(path, "w", encoding=encoding, errors="replace") as f:
            f.write(new_content)

        return {
            "success": True,
            "file_path": str(path),
            "replacements_count": actual_replaced,
            "total_matches": count,
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to edit file: {exc}",
            "file_path": str(path),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return edit_file(**kwargs)
