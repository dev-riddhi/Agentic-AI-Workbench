"""Tool: Create PDF From Markdown
Generates professional, beautifully styled PDF documents from LLM Markdown output,
placing the resulting file in the uploads/outputs directory and registering it
in the agent_outputs database table.
"""

from datetime import datetime
import os
from pathlib import Path
import re
from typing import Any, Callable

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)



class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and draw total page counts and running headers/footers."""

    _saved_page_states: list[dict[str, Any]]
    _pageNumber: int
    _pagesize: tuple[float, float]
    _doc_title: str
    _startPage: Callable[[], None]

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self) -> None:
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self) -> None:
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count: int) -> None:
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Footer
        footer_y = 36
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(self._pagesize[0] - 54, footer_y, page_text)
        self.drawString(54, footer_y, "Agentic AI Workbench • Generated Deliverable")

        # Subtle footer divider
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(54, footer_y + 12, self._pagesize[0] - 54, footer_y + 12)

        # Header (on pages after the first)
        if self._pageNumber > 1:
            header_y = self._pagesize[1] - 40
            doc_title = getattr(self, "_doc_title", "")
            if doc_title:
                self.drawString(54, header_y, str(doc_title)[:80])
                self.line(54, header_y - 6, self._pagesize[0] - 54, header_y - 6)

        self.restoreState()


def _sanitize_inline_markdown(text: str) -> str:
    """Converts standard Markdown inline formatting into ReportLab Paragraph XML."""
    # Escape XML entities first
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    # Bold + Italic: ***text*** or ___text___
    text = re.sub(r"\*\*\*(.*?)\*\*\*", r"<b><i>\1</i></b>", text)
    text = re.sub(r"___(.*?)___", r"<b><i>\1</i></b>", text)

    # Bold: **text** or __text__
    text = re.sub(r"\*\*(.*?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"__(.*?)__", r"<b>\1</b>", text)

    # Italic: *text* or _text_
    text = re.sub(r"(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"(?<!_)_(?!_)(.*?)(?<!_)_(?!_)", r"<i>\1</i>", text)

    # Inline code: `text`
    text = re.sub(
        r"`(.*?)`",
        r'<font face="Courier" color="#b91c1c" size="9"><b> \1 </b></font>',
        text,
    )

    return text.strip()


def markdown_to_flowables(
    markdown_text: str,
    styles: Any,
    page_width: float,
    theme_color: str = "#1e40af",
) -> tuple[list[Any], str]:
    """Parses markdown text into a list of ReportLab Flowables.

    Returns:
        tuple[list[Flowable], str]: Flowables list and extracted document title.
    """
    flowables: list[Any] = []
    lines = markdown_text.splitlines()
    i = 0
    total_lines = len(lines)
    extracted_title = ""

    # Custom styles
    h1_style = ParagraphStyle(
        "CustomH1",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        textColor=colors.HexColor(theme_color),
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )

    h2_style = ParagraphStyle(
        "CustomH2",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=12,
        spaceAfter=4,
        keepWithNext=True,
    )

    h3_style = ParagraphStyle(
        "CustomH3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceBefore=10,
        spaceAfter=3,
        keepWithNext=True,
    )

    body_style = ParagraphStyle(
        "CustomBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor("#334155"),
        spaceBefore=0,
        spaceAfter=6,
    )

    bullet_style = ParagraphStyle(
        "CustomBullet",
        parent=body_style,
        leftIndent=16,
        firstLineIndent=-10,
        spaceBefore=1,
        spaceAfter=3,
    )

    quote_style = ParagraphStyle(
        "CustomQuote",
        parent=body_style,
        fontName="Helvetica-Oblique",
        textColor=colors.HexColor("#475569"),
        leftIndent=20,
        rightIndent=15,
        spaceBefore=4,
        spaceAfter=6,
    )

    table_cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#1e293b"),
    )

    table_header_style = ParagraphStyle(
        "TableHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.white,
    )

    printable_width = page_width - 108  # 54 margin on left and right

    while i < total_lines:
        line = lines[i].rstrip()
        stripped = line.strip()

        # Blank line
        if not stripped:
            i += 1
            continue

        # Horizontal Rule
        if re.match(r"^(\-{3,}|\*{3,}|_{3,})$", stripped):
            flowables.append(Spacer(1, 4))
            flowables.append(
                HRFlowable(
                    width="100%",
                    thickness=0.75,
                    color=colors.HexColor("#cbd5e1"),
                    spaceBefore=4,
                    spaceAfter=8,
                )
            )
            i += 1
            continue

        # Code Block ```
        if stripped.startswith("```"):
            code_lines = []
            i += 1
            while i < total_lines and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            if i < total_lines and lines[i].strip().startswith("```"):
                i += 1  # Skip closing backticks

            code_text = "\n".join(code_lines)
            pre = Preformatted(
                code_text,
                ParagraphStyle(
                    "CodeStyle",
                    fontName="Courier",
                    fontSize=8,
                    leading=10,
                    textColor=colors.HexColor("#0f172a"),
                ),
            )
            code_table = Table(
                [[pre]],
                colWidths=[printable_width],
            )
            code_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                        ("LEFTPADDING", (0, 0), (-1, -1), 8),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ]
                )
            )
            flowables.append(Spacer(1, 4))
            flowables.append(code_table)
            flowables.append(Spacer(1, 6))
            continue

        # Markdown Table Detection
        if "|" in stripped and i + 1 < total_lines and re.match(r"^\|?\s*[\-:]+[\s\-:|]+$", lines[i + 1].strip()):
            header_raw = stripped
            i += 2  # skip separator row
            data_rows = []

            # Parse header cells
            header_cells = [c.strip() for c in header_raw.strip("|").split("|")]
            num_cols = len(header_cells)

            # Collect following table rows
            while i < total_lines and "|" in lines[i]:
                row_raw = lines[i].strip()
                if not row_raw:
                    break
                row_cells = [c.strip() for c in row_raw.strip("|").split("|")]
                # Align column count
                while len(row_cells) < num_cols:
                    row_cells.append("")
                data_rows.append(row_cells[:num_cols])
                i += 1

            if num_cols > 0:
                col_w = printable_width / num_cols
                table_data = []

                # Format Header
                table_data.append(
                    [Paragraph(f"<b>{_sanitize_inline_markdown(c)}</b>", table_header_style) for c in header_cells]
                )

                # Format Data Rows
                for row_idx, r in enumerate(data_rows):
                    table_data.append(
                        [Paragraph(_sanitize_inline_markdown(c), table_cell_style) for c in r]
                    )

                rl_table = Table(table_data, colWidths=[col_w] * num_cols, repeatRows=1)
                t_style = [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(theme_color)),
                    ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
                ]
                # Alternating row colors
                for r_i in range(1, len(table_data)):
                    if r_i % 2 == 0:
                        t_style.append(("BACKGROUND", (0, r_i), (-1, r_i), colors.HexColor("#f8fafc")))

                rl_table.setStyle(TableStyle(t_style))
                flowables.append(Spacer(1, 4))
                flowables.append(rl_table)
                flowables.append(Spacer(1, 6))
            continue

        # Headings
        h1_match = re.match(r"^#\s+(.+)$", stripped)
        if h1_match:
            title_text = h1_match.group(1).strip()
            if not extracted_title:
                extracted_title = title_text
            clean_text = _sanitize_inline_markdown(title_text)
            flowables.append(Paragraph(clean_text, h1_style))
            flowables.append(
                HRFlowable(
                    width="100%",
                    thickness=1.5,
                    color=colors.HexColor(theme_color),
                    spaceBefore=2,
                    spaceAfter=8,
                )
            )
            i += 1
            continue

        h2_match = re.match(r"^##\s+(.+)$", stripped)
        if h2_match:
            title_text = h2_match.group(1).strip()
            if not extracted_title:
                extracted_title = title_text
            clean_text = _sanitize_inline_markdown(title_text)
            flowables.append(Paragraph(clean_text, h2_style))
            i += 1
            continue

        h3_match = re.match(r"^###\s+(.+)$", stripped)
        if h3_match:
            clean_text = _sanitize_inline_markdown(h3_match.group(1).strip())
            flowables.append(Paragraph(clean_text, h3_style))
            i += 1
            continue

        h4_match = re.match(r"^####+\s+(.+)$", stripped)
        if h4_match:
            clean_text = _sanitize_inline_markdown(h4_match.group(1).strip())
            flowables.append(Paragraph(f"<b>{clean_text}</b>", body_style))
            i += 1
            continue

        # Blockquote
        if stripped.startswith(">"):
            quote_text = stripped.lstrip("> ").strip()
            clean_text = _sanitize_inline_markdown(quote_text)
            flowables.append(Paragraph(f"“ {clean_text} ”", quote_style))
            i += 1
            continue

        # Bullet List Items
        bullet_match = re.match(r"^(\*|\-|\+)\s+(.+)$", stripped)
        if bullet_match:
            item_text = bullet_match.group(2).strip()
            clean_text = _sanitize_inline_markdown(item_text)
            flowables.append(Paragraph(f"• &nbsp; {clean_text}", bullet_style))
            i += 1
            continue

        # Numbered List Items
        num_match = re.match(r"^(\d+)\.\s+(.+)$", stripped)
        if num_match:
            idx_num = num_match.group(1)
            item_text = num_match.group(2).strip()
            clean_text = _sanitize_inline_markdown(item_text)
            flowables.append(Paragraph(f"<b>{idx_num}.</b> &nbsp; {clean_text}", bullet_style))
            i += 1
            continue

        # Regular Body Paragraph
        # Accumulate adjacent lines of the paragraph
        para_lines = [stripped]
        i += 1
        while i < total_lines:
            next_line = lines[i].rstrip()
            next_stripped = next_line.strip()
            if (
                not next_stripped
                or next_stripped.startswith(("#", ">", "* ", "- ", "+ ", "```"))
                or re.match(r"^(\d+)\.\s+", next_stripped)
                or "|" in next_stripped
            ):
                break
            para_lines.append(next_stripped)
            i += 1

        full_para = " ".join(para_lines)
        clean_para = _sanitize_inline_markdown(full_para)
        flowables.append(Paragraph(clean_para, body_style))

    return flowables, extracted_title


def create_pdf_from_markdown(
    file_path: str,
    markdown_content: str = "",
    content: str = "",
    title: str | None = None,
    page_size: str = "LETTER",
    theme_color: str = "#1e40af",
    **kwargs: Any,
) -> dict[str, Any]:
    """Generates a professional PDF document from LLM markdown content.

    The PDF is strictly saved inside backend/outputs/ and recorded in the agent_outputs database.

    Args:
        file_path: Output filename or relative path inside backend/outputs. (e.g. 'summary.pdf')
        markdown_content: Markdown formatted text generated by the agent.
        content: Alternative alias for markdown content.
        title: Optional document title displayed on header / cover.
        page_size: Page size, either 'LETTER' or 'A4' (default: 'LETTER').
        theme_color: Primary theme hex color for headings/tables (default: '#1e40af').

    Returns:
        dict: Result containing 'success', 'file_path', 'filename', 'file_size', and 'title'.
    """
    actual_markdown = markdown_content or content or kwargs.get("text", "")
    if not actual_markdown or not actual_markdown.strip():
        return {
            "success": False,
            "error": "markdown_content cannot be empty.",
            "file_path": file_path,
        }

    backend_dir = Path(__file__).resolve().parents[3]
    outputs_dir = (backend_dir / "outputs").resolve()
    outputs_dir.mkdir(parents=True, exist_ok=True)

    raw_path = (file_path or "").strip().replace("\\", "/")
    while raw_path.startswith("./"):
        raw_path = raw_path[2:]
    if raw_path.startswith("outputs/"):
        raw_path = raw_path[len("outputs/"):]
    elif raw_path.startswith("uploads/outputs/"):
        raw_path = raw_path[len("uploads/outputs/"):]
    elif raw_path.startswith("uploads/"):
        raw_path = raw_path[len("uploads/"):]

    if not raw_path.lower().endswith(".pdf"):
        raw_path += ".pdf"

    p = Path(raw_path)
    dest_path = (outputs_dir / p).resolve()
    if not (dest_path == outputs_dir or dest_path.is_relative_to(outputs_dir)):
        dest_path = (outputs_dir / p.name).resolve()

    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        chosen_page_size = A4 if page_size.upper() == "A4" else letter

        # Base margin: 54 points (0.75 in)
        doc = SimpleDocTemplate(
            str(dest_path),
            pagesize=chosen_page_size,
            leftMargin=54,
            rightMargin=54,
            topMargin=54,
            bottomMargin=54,
        )

        styles = getSampleStyleSheet()
        flowables, detected_title = markdown_to_flowables(
            markdown_text=actual_markdown,
            styles=styles,
            page_width=chosen_page_size[0],
            theme_color=theme_color,
        )

        doc_title = title or detected_title or dest_path.stem.replace("_", " ").title()

        # Canvas builder function with doc title attached
        def canvas_maker(*args: Any, **kwargs: Any) -> NumberedCanvas:
            c = NumberedCanvas(*args, **kwargs)
            setattr(c, "_doc_title", doc_title)
            return c

        doc.build(flowables, canvasmaker=canvas_maker)

        file_size = dest_path.stat().st_size

        # Record output in agent_outputs database table
        try:
            from app.runtime.agent_runtime import record_tool_generated_output
            record_tool_generated_output(
                file_path=str(dest_path),
                title=doc_title,
                output_type="pdf",
                content_preview=actual_markdown[:500],
            )
        except Exception as rec_err:
            pass

        return {
            "success": True,
            "file_path": str(dest_path),
            "filename": dest_path.name,
            "file_size": file_size,
            "title": doc_title,
            "message": f"Successfully created PDF '{dest_path.name}' ({file_size} bytes) in outputs directory.",
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to generate PDF: {exc}",
            "file_path": str(dest_path),
        }


def execute(**kwargs: Any) -> dict[str, Any]:
    """Standard entry point for dynamic tool execution."""
    return create_pdf_from_markdown(**kwargs)
