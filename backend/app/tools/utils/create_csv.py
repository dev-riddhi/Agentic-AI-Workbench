"""Utility: Create CSV
Generates standard CSV files from tabular data, Markdown tables, or delimited text,
saving strictly into backend/outputs and registering the file in agent_outputs.
"""

import csv
import io
import json
from pathlib import Path
import re
from typing import Any


def parse_content_to_rows(content: str, default_delimiter: str = ",") -> list[list[str]]:
    """Extracts rows from markdown tables, CSV/delimited text, or JSON lines."""
    if not content or not content.strip():
        return []

    stripped = content.strip()

    # 1. Try parsing as JSON array of objects or lists
    if (stripped.startswith("[") and stripped.endswith("]")) or (stripped.startswith("{") and stripped.endswith("}")):
        try:
            data = json.loads(stripped)
            if isinstance(data, list) and data:
                if isinstance(data[0], dict):
                    headers = list(data[0].keys())
                    rows = [headers]
                    for item in data:
                        if isinstance(item, dict):
                            rows.append([str(item.get(h, "")) for h in headers])
                    return rows
                elif isinstance(data[0], list):
                    return [[str(c) for c in row] for row in data]
        except Exception:
            pass

    # 2. Check for Markdown table format
    lines = [line.strip() for line in stripped.splitlines() if line.strip()]
    if any("|" in line for line in lines):
        table_rows: list[list[str]] = []
        for line in lines:
            if not line.startswith("|") and not line.endswith("|") and "|" not in line:
                continue
            # Skip separator lines like |---|---| or :---:|
            if re.match(r"^\|?\s*[\-:]+[\s\-:|]+$", line):
                continue
            cells = [c.strip() for c in line.strip("|").split("|")]
            table_rows.append(cells)
        if table_rows:
            return table_rows

    # 3. Standard CSV / delimited text parse
    try:
        # Detect delimiter if possible
        sample = "\n".join(lines[:5])
        dialect = None
        try:
            sniffer = csv.Sniffer()
            dialect = sniffer.sniff(sample, delimiters=[",", "\t", ";", "|"])
        except Exception:
            pass

        delim = dialect.delimiter if dialect else default_delimiter
        reader = csv.reader(io.StringIO(stripped), delimiter=delim)
        return [row for row in reader if row]
    except Exception:
        # Fallback: line by line
        return [[line] for line in lines]


def create_csv(
    file_path: str | Path,
    content: str = "",
    title: str | None = None,
    overwrite: bool = True,
    encoding: str = "utf-8",
    delimiter: str = ",",
    **kwargs: Any,
) -> dict[str, Any]:
    """Creates a CSV file inside backend/outputs and registers it in agent_outputs."""
    backend_dir = Path(__file__).resolve().parents[3]
    outputs_dir = (backend_dir / "outputs").resolve()
    outputs_dir.mkdir(parents=True, exist_ok=True)

    raw_path = str(file_path).strip().replace("\\", "/")
    while raw_path.startswith("./"):
        raw_path = raw_path[2:]
    if raw_path.startswith("outputs/"):
        raw_path = raw_path[len("outputs/") :]
    elif raw_path.startswith("uploads/outputs/"):
        raw_path = raw_path[len("uploads/outputs/") :]
    elif raw_path.startswith("uploads/"):
        raw_path = raw_path[len("uploads/") :]

    p = Path(raw_path)
    dest_path = (outputs_dir / p).resolve()
    if not (dest_path == outputs_dir or dest_path.is_relative_to(outputs_dir)):
        dest_path = (outputs_dir / p.name).resolve()

    if not dest_path.name.lower().endswith(".csv"):
        dest_path = dest_path.with_suffix(".csv")

    if not overwrite and dest_path.exists():
        return {
            "success": False,
            "error": f"File already exists and overwrite is False: {dest_path.name}",
            "file_path": str(dest_path),
        }

    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        rows = parse_content_to_rows(content, default_delimiter=delimiter)

        with open(dest_path, "w", newline="", encoding=encoding, errors="replace") as f:
            writer = csv.writer(f, delimiter=delimiter, lineterminator="\n")
            if rows:
                writer.writerows(rows)
            else:
                # If no rows extracted, write raw content
                f.write(content)

        file_size = dest_path.stat().st_size
        doc_title = title or dest_path.stem.replace("_", " ").title()

        # Update agent_outputs db record
        try:
            from app.runtime.agent_runtime import record_tool_generated_output
            record_tool_generated_output(
                file_path=str(dest_path),
                title=doc_title,
                output_type="csv",
                content_preview=content[:500] if content else None,
            )
        except Exception:
            pass

        return {
            "success": True,
            "file_path": str(dest_path),
            "filename": dest_path.name,
            "file_size": file_size,
            "title": doc_title,
            "output_type": "csv",
            "rows_count": len(rows),
            "message": f"Successfully created CSV '{dest_path.name}' ({len(rows)} rows, {file_size} bytes) in outputs directory.",
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to generate CSV: {exc}",
            "file_path": str(dest_path),
            "output_type": "csv",
        }
