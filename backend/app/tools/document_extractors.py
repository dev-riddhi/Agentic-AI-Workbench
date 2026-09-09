"""Document Extraction Utilities for Agent Tools.
Provides robust text and structured data extraction for:
- PDF (.pdf)
- Excel (.xlsx, .xls)
- CSV / TSV (.csv, .tsv)
- Word documents (.docx)
- PowerPoint presentations (.pptx)
"""

import csv
import io
import os
from pathlib import Path
from typing import Any


def extract_pdf(path: Path, max_pages: int | None = None) -> dict[str, Any]:
    """Extracts text content and metadata from a PDF file using pypdf."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(str(path))
        num_pages = len(reader.pages)
        pages_to_read = min(num_pages, max_pages) if max_pages and max_pages > 0 else num_pages

        pages_text = []
        for idx in range(pages_to_read):
            page = reader.pages[idx]
            text = (page.extract_text() or "").strip()
            pages_text.append(f"--- Page {idx + 1} of {num_pages} ---\n{text if text else '[No text on page]'}")

        meta = reader.metadata or {}
        extracted_meta = {
            "num_pages": num_pages,
            "read_pages": pages_to_read,
            "title": str(meta.get("/Title") or ""),
            "author": str(meta.get("/Author") or ""),
            "creator": str(meta.get("/Creator") or ""),
        }

        full_content = "\n\n".join(pages_text)
        return {
            "format": "pdf",
            "content": full_content,
            "metadata": extracted_meta,
            "truncated": pages_to_read < num_pages,
        }
    except Exception as err:
        return {
            "format": "pdf",
            "content": f"[Error parsing PDF: {err}]",
            "error": str(err),
            "metadata": {"num_pages": 0},
            "truncated": False,
        }


def extract_excel(
    path: Path,
    max_rows: int | None = 250,
    sheet_name: str | None = None,
) -> dict[str, Any]:
    """Extracts structured sheets, rows, and tables from an Excel file (.xlsx) using openpyxl."""
    import openpyxl

    try:
        wb = openpyxl.load_workbook(str(path), data_only=True, read_only=True)
        sheet_names = list(wb.sheetnames)
        limit_rows = max_rows if max_rows and max_rows > 0 else 250

        target_sheets = [sheet_name] if sheet_name and sheet_name in sheet_names else sheet_names
        formatted_sheets = []
        total_rows_extracted = 0
        truncated = False

        for s_name in target_sheets:
            ws = wb[s_name]
            sheet_output = [f"### Sheet: '{s_name}'"]
            rows_collected = []

            for r_idx, row in enumerate(ws.iter_rows(values_only=True)):
                if r_idx >= limit_rows:
                    truncated = True
                    break
                # Convert row cells into string representations
                str_row = [str(cell) if cell is not None else "" for cell in row]
                if any(c.strip() for c in str_row):
                    rows_collected.append(str_row)

            if not rows_collected:
                sheet_output.append("*(Sheet is empty)*")
            else:
                # Format as markdown table
                num_cols = max(len(r) for r in rows_collected)
                header = rows_collected[0]
                while len(header) < num_cols:
                    header.append("")

                header_line = "| " + " | ".join(c.replace("\n", " ").strip() or f"Col {j+1}" for j, c in enumerate(header)) + " |"
                sep_line = "| " + " | ".join("---" for _ in range(num_cols)) + " |"
                sheet_output.append(header_line)
                sheet_output.append(sep_line)

                for r in rows_collected[1:]:
                    while len(r) < num_cols:
                        r.append("")
                    row_line = "| " + " | ".join(c.replace("\n", " ").strip() for c in r) + " |"
                    sheet_output.append(row_line)

                total_rows_extracted += len(rows_collected)
                sheet_output.append(f"\n*(Extracted {len(rows_collected)} rows from '{s_name}')*")

            formatted_sheets.append("\n".join(sheet_output))

        wb.close()

        full_content = "\n\n---\n\n".join(formatted_sheets)
        return {
            "format": "excel",
            "content": full_content,
            "metadata": {
                "sheet_names": sheet_names,
                "extracted_sheets": target_sheets,
                "total_rows_extracted": total_rows_extracted,
            },
            "truncated": truncated,
        }
    except Exception as err:
        return {
            "format": "excel",
            "content": f"[Error reading Excel workbook: {err}]",
            "error": str(err),
            "metadata": {},
            "truncated": False,
        }


def extract_csv(
    path: Path,
    max_rows: int | None = 500,
    delimiter: str | None = None,
    encoding: str = "utf-8",
) -> dict[str, Any]:
    """Extracts and formats rows from a CSV or TSV file."""
    limit_rows = max_rows if max_rows and max_rows > 0 else 500
    rows = []
    truncated = False

    encodings = [encoding, "utf-8-sig", "latin-1", "cp1252"]
    text_content = ""
    for enc in encodings:
        try:
            with open(path, "r", encoding=enc, errors="replace") as f:
                text_content = f.read()
            break
        except Exception:
            continue

    if not text_content:
        return {
            "format": "csv",
            "content": "*(File is empty)*",
            "metadata": {"total_rows": 0, "columns": []},
            "truncated": False,
        }

    # Determine delimiter
    delim = delimiter
    if not delim:
        if path.suffix.lower() == ".tsv":
            delim = "\t"
        else:
            try:
                sample = text_content[:2048]
                sniffer = csv.Sniffer()
                delim = sniffer.sniff(sample).delimiter
            except Exception:
                delim = ","

    reader = csv.reader(io.StringIO(text_content), delimiter=delim)
    all_rows = list(reader)
    total_rows = len(all_rows)

    if total_rows > limit_rows:
        rows = all_rows[:limit_rows]
        truncated = True
    else:
        rows = all_rows

    if not rows:
        return {
            "format": "csv",
            "content": "*(CSV is empty)*",
            "metadata": {"total_rows": 0, "columns": []},
            "truncated": False,
        }

    # Format as Markdown Table
    num_cols = max(len(r) for r in rows)
    header = rows[0]
    while len(header) < num_cols:
        header.append(f"Col_{len(header) + 1}")

    formatted_lines = []
    header_line = "| " + " | ".join(c.replace("\n", " ").strip() or f"Col_{j+1}" for j, c in enumerate(header)) + " |"
    sep_line = "| " + " | ".join("---" for _ in range(num_cols)) + " |"
    formatted_lines.append(header_line)
    formatted_lines.append(sep_line)

    for r in rows[1:]:
        while len(r) < num_cols:
            r.append("")
        row_line = "| " + " | ".join(c.replace("\n", " ").strip() for c in r) + " |"
        formatted_lines.append(row_line)

    summary_note = f"\n\n*(Showing {len(rows)} of {total_rows} total rows, delimiter='{delim}')*"
    full_content = "\n".join(formatted_lines) + summary_note

    return {
        "format": "csv",
        "content": full_content,
        "metadata": {
            "total_rows": total_rows,
            "read_rows": len(rows),
            "columns": header,
            "delimiter": delim,
        },
        "truncated": truncated,
    }


def extract_docx(path: Path) -> dict[str, Any]:
    """Extracts paragraphs, headings, and tables from a Word (.docx) document using python-docx."""
    import docx

    try:
        doc = docx.Document(str(path))
        sections: list[str] = []

        # Extract headings and paragraphs
        for p in doc.paragraphs:
            text = p.text.strip()
            if not text:
                continue
            style_name = (p.style.name or "").lower() if p.style else ""
            if "heading 1" in style_name:
                sections.append(f"# {text}")
            elif "heading 2" in style_name:
                sections.append(f"## {text}")
            elif "heading 3" in style_name:
                sections.append(f"### {text}")
            elif "title" in style_name:
                sections.append(f"# {text}")
            elif "subtitle" in style_name:
                sections.append(f"*{text}*")
            else:
                sections.append(text)

        # Extract tables
        for t_idx, table in enumerate(doc.tables):
            table_lines = [f"\n### Table {t_idx + 1}"]
            rows_data = []
            for row in table.rows:
                row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                rows_data.append(row_cells)

            if rows_data:
                num_cols = max(len(r) for r in rows_data)
                header = rows_data[0]
                while len(header) < num_cols:
                    header.append("")
                table_lines.append("| " + " | ".join(header) + " |")
                table_lines.append("| " + " | ".join("---" for _ in range(num_cols)) + " |")
                for r in rows_data[1:]:
                    while len(r) < num_cols:
                        r.append("")
                    table_lines.append("| " + " | ".join(r) + " |")

            sections.append("\n".join(table_lines))

        full_content = "\n\n".join(sections)
        return {
            "format": "docx",
            "content": full_content if full_content.strip() else "*(Document is empty)*",
            "metadata": {
                "num_paragraphs": len(doc.paragraphs),
                "num_tables": len(doc.tables),
            },
            "truncated": False,
        }
    except Exception as err:
        return {
            "format": "docx",
            "content": f"[Error reading Word document: {err}]",
            "error": str(err),
            "metadata": {},
            "truncated": False,
        }


def extract_pptx(path: Path) -> dict[str, Any]:
    """Extracts slides, titles, body content, tables, and speaker notes from a PowerPoint (.pptx) file."""
    from pptx import Presentation

    try:
        prs = Presentation(str(path))
        slides_output = []
        total_slides = len(prs.slides)

        for idx, slide in enumerate(prs.slides):
            slide_lines = []

            # Slide Title
            title = ""
            if slide.shapes.title and slide.shapes.title.text:
                title = slide.shapes.title.text.strip()
                slide_lines.append(f"## Slide {idx + 1}: {title}")
            else:
                slide_lines.append(f"## Slide {idx + 1}")

            def _extract_shape_content(sp: Any) -> None:
                # Text Frame
                if getattr(sp, "has_text_frame", False):
                    text_frame = getattr(sp, "text_frame", None)
                    if text_frame:
                        for para in text_frame.paragraphs:
                            text = para.text.strip()
                            if text:
                                indent = "  " * para.level if para.level else ""
                                slide_lines.append(f"{indent}- {text}")
                # Table
                elif getattr(sp, "has_table", False):
                    table = getattr(sp, "table", None)
                    if table:
                        table_lines = ["\n[Slide Table]"]
                        for row in table.rows:
                            row_cells = [cell.text.strip().replace("\n", " ") for cell in row.cells]
                            table_lines.append("| " + " | ".join(row_cells) + " |")
                        slide_lines.append("\n".join(table_lines))
                # Grouped Shapes
                elif hasattr(sp, "shapes"):
                    for child_sp in sp.shapes:
                        _extract_shape_content(child_sp)

            # Slide Body Shapes
            for shape in slide.shapes:
                if slide.shapes.title and shape == slide.shapes.title:
                    continue
                _extract_shape_content(shape)

            # Speaker Notes
            if slide.has_notes_slide and slide.notes_slide.notes_text_frame:
                notes = slide.notes_slide.notes_text_frame.text.strip()
                if notes:
                    slide_lines.append(f"\n> **Speaker Notes:** {notes}")

            slides_output.append("\n".join(slide_lines))

        full_content = "\n\n---\n\n".join(slides_output)
        return {
            "format": "pptx",
            "content": full_content if full_content.strip() else "*(Presentation has no text slides)*",
            "metadata": {
                "total_slides": total_slides,
            },
            "truncated": False,
        }
    except Exception as err:
        return {
            "format": "pptx",
            "content": f"[Error reading PowerPoint presentation: {err}]",
            "error": str(err),
            "metadata": {},
            "truncated": False,
        }


def auto_detect_and_extract(
    path: Path,
    max_pages: int | None = None,
    max_rows: int | None = None,
    sheet_name: str | None = None,
    delimiter: str | None = None,
    encoding: str = "utf-8",
) -> dict[str, Any] | None:
    """Detects if the file is a rich document (PDF, Excel, CSV, Word, PPTX)

    and delegates to the specialized extractor.
    Returns None if the file is standard plain text/code.
    """
    ext = path.suffix.lower()

    if ext == ".pdf":
        return extract_pdf(path, max_pages=max_pages)
    if ext in (".xlsx", ".xlsm", ".xltx", ".xltm"):
        return extract_excel(path, max_rows=max_rows, sheet_name=sheet_name)
    if ext in (".csv", ".tsv"):
        return extract_csv(path, max_rows=max_rows, delimiter=delimiter, encoding=encoding)
    if ext in (".docx", ".docm", ".dotx", ".dotm"):
        return extract_docx(path)
    if ext in (".pptx", ".pptm", ".potx", ".potm"):
        return extract_pptx(path)

    return None
