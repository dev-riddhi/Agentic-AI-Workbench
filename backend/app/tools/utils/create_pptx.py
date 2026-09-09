"""Utility: Create PowerPoint Presentation (.pptx)
Generates structured PowerPoint presentations from Markdown text using python-pptx,
supporting title slides, section slides, and bulleted content slides,
saving strictly into backend/outputs and registering the file in agent_outputs.
"""

from pathlib import Path
import re
from typing import Any

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN
from pptx.util import Inches, Pt


def _split_into_slides(content: str) -> list[dict[str, Any]]:
    """Splits markdown content into structured slide dicts."""
    raw_slides = re.split(r"\n\s*(?:---+|\*\*\*+)\s*\n", content)
    slides_data = []

    for idx, raw_slide in enumerate(raw_slides):
        lines = [line.strip() for line in raw_slide.strip().splitlines() if line.strip()]
        if not lines:
            continue

        slide_title = ""
        slide_subtitle = ""
        bullets: list[str] = []

        i = 0
        while i < len(lines):
            line = lines[i]
            # Detect title
            h_match = re.match(r"^#+\s+(.+)$", line)
            if h_match and not slide_title:
                slide_title = h_match.group(1).strip()
            elif not slide_title and not line.startswith(("*", "-", "+", ">")):
                slide_title = line
            elif not slide_subtitle and idx == 0 and not line.startswith(("*", "-", "+")):
                slide_subtitle = line
            else:
                clean_bullet = re.sub(r"^(\*|\-|\+|\d+\.)\s+", "", line).strip()
                bullets.append(clean_bullet)
            i += 1

        slides_data.append({
            "is_title_slide": idx == 0,
            "title": slide_title or f"Slide {idx + 1}",
            "subtitle": slide_subtitle,
            "bullets": bullets,
        })

    return slides_data


def create_pptx(
    file_path: str | Path,
    content: str = "",
    title: str | None = None,
    overwrite: bool = True,
    theme_color: str = "1E40AF",
    **kwargs: Any,
) -> dict[str, Any]:
    """Creates a formatted PowerPoint (.pptx) presentation inside backend/outputs."""
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

    if not dest_path.name.lower().endswith(".pptx"):
        dest_path = dest_path.with_suffix(".pptx")

    if not overwrite and dest_path.exists():
        return {
            "success": False,
            "error": f"File already exists and overwrite is False: {dest_path.name}",
            "file_path": str(dest_path),
        }

    try:
        dest_path.parent.mkdir(parents=True, exist_ok=True)
        prs = Presentation()

        slides_data = _split_into_slides(content)
        if not slides_data:
            slides_data = [{
                "is_title_slide": True,
                "title": title or dest_path.stem.replace("_", " ").title(),
                "subtitle": "Generated Presentation Deliverable",
                "bullets": [],
            }]

        clean_hex = theme_color.lstrip("#").upper()
        if len(clean_hex) != 6:
            clean_hex = "1E40AF"
        theme_rgb = RGBColor(int(clean_hex[:2], 16), int(clean_hex[2:4], 16), int(clean_hex[4:], 16))

        for idx, s_data in enumerate(slides_data):
            if s_data["is_title_slide"] and idx == 0:
                # Layout 0: Title Slide
                slide_layout = prs.slide_layouts[0]
                slide = prs.slides.add_slide(slide_layout)

                if slide.shapes.title:
                    slide.shapes.title.text = s_data["title"]
                    title_para = slide.shapes.title.text_frame.paragraphs[0]
                    title_para.font.bold = True
                    title_para.font.color.rgb = theme_rgb
                    title_para.font.size = Pt(40)

                sub_placeholder = slide.placeholders[1] if len(slide.placeholders) > 1 else None
                if sub_placeholder:
                    sub_text = s_data["subtitle"] or "Agentic AI Workbench • Deliverable"
                    sub_placeholder.text = sub_text
                    if sub_placeholder.text_frame.paragraphs:
                        sub_placeholder.text_frame.paragraphs[0].font.size = Pt(20)
            else:
                # Layout 1: Title and Content
                slide_layout = prs.slide_layouts[1]
                slide = prs.slides.add_slide(slide_layout)

                if slide.shapes.title:
                    slide.shapes.title.text = s_data["title"]
                    title_para = slide.shapes.title.text_frame.paragraphs[0]
                    title_para.font.bold = True
                    title_para.font.color.rgb = theme_rgb
                    title_para.font.size = Pt(32)

                body_placeholder = slide.placeholders[1] if len(slide.placeholders) > 1 else None
                if body_placeholder:
                    tf = body_placeholder.text_frame
                    tf.word_wrap = True
                    bullets = s_data["bullets"]

                    if bullets:
                        # First paragraph
                        tf.text = bullets[0]
                        p_first = tf.paragraphs[0]
                        p_first.font.size = Pt(18)
                        p_first.space_after = Pt(10)

                        for b_text in bullets[1:]:
                            p = tf.add_paragraph()
                            p.text = b_text
                            p.font.size = Pt(18)
                            p.space_after = Pt(10)
                    else:
                        tf.text = s_data.get("subtitle") or ""

        prs.save(str(dest_path))
        file_size = dest_path.stat().st_size
        doc_title = title or slides_data[0]["title"] or dest_path.stem.replace("_", " ").title()

        # Update agent_outputs db record
        try:
            from app.runtime.agent_runtime import record_tool_generated_output
            record_tool_generated_output(
                file_path=str(dest_path),
                title=doc_title,
                output_type="pptx",
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
            "output_type": "pptx",
            "slides_count": len(slides_data),
            "message": f"Successfully created PowerPoint presentation '{dest_path.name}' ({len(slides_data)} slides, {file_size} bytes) in outputs directory.",
        }
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to generate PowerPoint presentation: {exc}",
            "file_path": str(dest_path),
            "output_type": "pptx",
        }
