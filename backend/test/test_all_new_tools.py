"""Comprehensive Automated Verification Suite for File CRUD & Document Tools.
Tests:
1. Output folder routing (uploads/outputs/)
2. agent_outputs database tracking
3. create_pdf_from_markdown tool
4. write_create_file routing and db tracking
5. read_file multi-format auto-detection (PDF, Excel, CSV, Word, PowerPoint, Text)
6. Streamlined tools registry (15 active tools, removed bloated tools)
"""

from pathlib import Path
import sys
import uuid

# Setup Python path
backend_dir = Path(__file__).resolve().parent.parent if Path(__file__).resolve().parent.name == "test" else Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from database.database import SessionLocal
from database.models.agent_output import AgentOutput
from app.tools import TOOLS, TOOLS_MAP, TOOL_NAMES, run_tool
from app.tools.file.file_security import get_upload_dir, get_outputs_dir, resolve_output_path, resolve_safe_path
from app.tools.file.read_file import read_file
from app.tools.file.create_file import create_file, write_create_file
from app.tools.utils.create_pdf_from_markdown import create_pdf_from_markdown
from app.runtime.agent_runtime import current_execution_context


def run_tests():
    print("\n" + "=" * 60)
    print("🚀 STARTING AUTOMATED TOOLS & FILE CRUD TEST SUITE")
    print("=" * 60)

    upload_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()
    print(f"📁 Upload directory:  {upload_dir}")
    print(f"📁 Outputs directory: {outputs_dir}")
    assert outputs_dir.exists(), "Outputs directory must exist"

    # Set mock agent execution context to test db auto-recording
    mock_agent_id = uuid.uuid4()
    mock_exec_id = f"exec-{uuid.uuid4().hex[:8]}"
    ctx_token = current_execution_context.set({
        "agent_id": mock_agent_id,
        "agent_name": "Test Suite Agent",
        "execution_id": mock_exec_id,
        "action_id": uuid.uuid4(),
    })

    try:
        # TEST 1: write_create_file routing and DB recording
        print("\n--- TEST 1: write_create_file output routing ---")
        write_res = write_create_file(
            file_path="agent_report_test.txt",
            content="This is an automated intelligence summary created by Test Suite Agent.",
        )
        assert write_res["success"] is True, f"write_create_file failed: {write_res}"
        target_path = Path(write_res["file_path"])
        print(f"✅ Created file at: {target_path}")
        assert target_path.parent == outputs_dir, f"Expected {target_path.parent} to equal {outputs_dir}"

        # Verify DB entry in agent_outputs
        with SessionLocal() as db:
            from sqlalchemy import select
            rec = db.scalar(select(AgentOutput).where(AgentOutput.execution_id == mock_exec_id, AgentOutput.file_path == str(target_path)))
            assert rec is not None, "agent_outputs record was not created for write_create_file!"
            print(f"✅ DB record verified: ID={rec.id}, title='{rec.title}', type='{rec.output_type}'")

        # TEST 2: create_pdf_from_markdown tool
        print("\n--- TEST 2: create_pdf_from_markdown tool ---")
        sample_md = """# Enterprise Deliverable

## Section 1: Introduction
This is a test document validating the ReportLab markdown engine.

* Point Alpha: 100% verified
* Point Beta: Subsystem operational

### Metrics Overview
| Metric | Value | Status |
| :--- | :--- | :--- |
| Uptime | 99.99% | Nominal |
| Latency | 12ms | Excellent |

> Operational reliability exceeds baseline standards.
"""
        pdf_res = create_pdf_from_markdown(
            file_path="deliverable_test.pdf",
            markdown_content=sample_md,
            title="Enterprise Deliverable",
        )
        assert pdf_res["success"] is True, f"create_pdf_from_markdown failed: {pdf_res}"
        pdf_path = Path(pdf_res["file_path"])
        print(f"✅ Created PDF at: {pdf_path} (Size: {pdf_res['file_size']} bytes)")
        assert pdf_path.parent == outputs_dir, f"Expected {pdf_path.parent} to equal {outputs_dir}"
        assert pdf_path.stat().st_size > 1000, "PDF should be non-trivial"

        # Verify DB entry
        with SessionLocal() as db:
            rec_pdf = db.scalar(select(AgentOutput).where(AgentOutput.execution_id == mock_exec_id, AgentOutput.file_path == str(pdf_path)))
            assert rec_pdf is not None, "agent_outputs record was not created for create_pdf_from_markdown!"
            print(f"✅ DB record verified for PDF: ID={rec_pdf.id}, title='{rec_pdf.title}', type='{rec_pdf.output_type}'")

        # TEST 3: read_file reading from outputs folder
        print("\n--- TEST 3: read_file reading from outputs folder ---")
        read_pdf_res = read_file("deliverable_test.pdf")
        assert read_pdf_res["success"] is True, f"read_file failed on PDF: {read_pdf_res}"
        assert read_pdf_res["format"] == "pdf", f"Expected format 'pdf', got {read_pdf_res.get('format')}"
        assert "Enterprise Deliverable" in read_pdf_res["content"], "PDF content should contain title"
        print(f"✅ Auto-detected PDF from outputs folder: {read_pdf_res['filename']}, pages={read_pdf_res['metadata']['num_pages']}")

        # TEST 4: read_file multi-format detection (CSV, Excel, Word, PPTX, Text)
        print("\n--- TEST 4: read_file multi-format auto-detection ---")

        # 4a. CSV
        r_csv = read_file("test_sample.csv")
        assert r_csv["success"] is True and r_csv["format"] == "csv", f"CSV read failed: {r_csv}"
        assert "Alice" in r_csv["content"], "CSV content should contain row data"
        print(f"✅ CSV Extracted: {r_csv['filename']}, rows={r_csv['metadata']['total_rows']}")

        # 4b. Excel (.xlsx)
        r_xlsx = read_file("test_sample.xlsx")
        assert r_xlsx["success"] is True and r_xlsx["format"] == "excel", f"Excel read failed: {r_xlsx}"
        assert "Quarterly" in r_xlsx["content"], "Excel content should contain sheet name"
        print(f"✅ Excel Extracted: {r_xlsx['filename']}, sheets={r_xlsx['metadata']['sheet_names']}")

        # 4c. Word (.docx)
        r_docx = read_file("test_sample.docx")
        assert r_docx["success"] is True and r_docx["format"] == "docx", f"DOCX read failed: {r_docx}"
        assert "Project Alpha Status" in r_docx["content"], "DOCX content should contain heading"
        print(f"✅ Word Extracted: {r_docx['filename']}, paragraphs={r_docx['metadata']['num_paragraphs']}")

        # 4d. PowerPoint (.pptx)
        r_pptx = read_file("test_sample.pptx")
        assert r_pptx["success"] is True and r_pptx["format"] == "pptx", f"PPTX read failed: {r_pptx}"
        assert "AI Workbench Presentation" in r_pptx["content"], "PPTX content should contain slide title"
        print(f"✅ PowerPoint Extracted: {r_pptx['filename']}, slides={r_pptx['metadata']['total_slides']}")

        # 4e. Text (.txt) with slicing
        r_txt = read_file("agent_report_test.txt", start_line=1, end_line=1)
        assert r_txt["success"] is True and r_txt["format"] == "text", f"Text read failed: {r_txt}"
        print(f"✅ Text Extracted with slicing: {r_txt['filename']}, lines={r_txt['total_lines']}")

        # TEST 5: Streamlined Tool Registry Verification
        print("\n--- TEST 5: Streamlined Tools Registry ---")
        assert len(TOOLS) == 15, f"Expected 15 active tools, found {len(TOOLS)}"
        print(f"✅ Total active tools: {len(TOOLS)}")
        for expected in ["read_file", "create_file", "create_pdf_from_markdown", "edit_file", "delete_rename_file", "search_files", "get_file_metadata", "web_search", "fetch_webpage", "extract_webpage_content", "browse_links", "search_news", "search_images", "query_apis", "system_notification"]:
            assert expected in TOOL_NAMES, f"Expected tool '{expected}' not in TOOL_NAMES"
            assert expected in TOOLS_MAP, f"Expected tool '{expected}' not in TOOLS_MAP"

        for removed in ["list_directory", "compress_extract_zip", "download_files", "python_execution", "parse_pdf", "read_write_csv_excel_json_xml"]:
            assert removed not in TOOL_NAMES, f"Removed tool '{removed}' is still in active TOOL_NAMES"
            assert removed not in TOOLS_MAP, f"Removed tool '{removed}' is still in active TOOLS_MAP"
        print(f"✅ All 6 decommissioned/bloated tools successfully excluded from agent tool calling registry.")

        print("\n" + "=" * 60)
        print("🎉 ALL TESTS PASSED SUCCESSFULLY!")
        print("=" * 60 + "\n")

    finally:
        current_execution_context.reset(ctx_token)


if __name__ == "__main__":
    run_tests()
