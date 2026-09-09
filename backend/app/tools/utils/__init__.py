"""File Creation Utilities Suite
Provides specialized file generation functions for rich document and data formats:
- PDF (.pdf) via ReportLab
- Excel (.xlsx) via openpyxl
- CSV (.csv) via standard csv engine
- Word Document (.docx) via python-docx
- PowerPoint (.pptx) via python-pptx
"""

from typing import Any, Callable

from app.tools.utils.create_pdf_from_markdown import create_pdf_from_markdown
from app.tools.utils.create_csv import create_csv
from app.tools.utils.create_excel import create_excel
from app.tools.utils.create_docx import create_docx
from app.tools.utils.create_pptx import create_pptx

# Unified registry mapping file type aliases to their specialized generator helper
FILE_CREATION_HELPERS: dict[str, Callable[..., dict[str, Any]]] = {
    # PDF
    "pdf": create_pdf_from_markdown,
    # Excel
    "xlsx": create_excel,
    "xlsl": create_excel,
    "xls": create_excel,
    "excel": create_excel,
    # CSV
    "csv": create_csv,
    "tsv": create_csv,
    # Word Document
    "docx": create_docx,
    "docs": create_docx,
    "doc": create_docx,
    "word": create_docx,
    # PowerPoint
    "pptx": create_pptx,
    "ppt": create_pptx,
    "powerpoint": create_pptx,
    "presentation": create_pptx,
}

__all__ = [
    "create_pdf_from_markdown",
    "create_csv",
    "create_excel",
    "create_docx",
    "create_pptx",
    "FILE_CREATION_HELPERS",
]
