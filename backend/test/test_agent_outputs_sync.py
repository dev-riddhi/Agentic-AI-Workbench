"""Verification Test Suite for agent_outputs database table, model, controller, and file download."""

import os
from pathlib import Path
import sqlite3
import sys
from uuid import uuid4

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))
reconfigure_out = getattr(sys.stdout, "reconfigure", None)
if callable(reconfigure_out):
    try:
        reconfigure_out(encoding="utf-8", errors="replace")
    except Exception:
        pass

from database.database import SessionLocal, init_db
from database.models import AgentOutput, User, Agent, AIModel
from app.features.agent_outputs import controller, model
from app.tools.file.file_security import get_outputs_dir, get_upload_dir


def test_agent_outputs_table_exists():
    print("\n[STEP 1] Verifying SQLite Table Schema for agent_outputs...")
    init_db()
    conn = sqlite3.connect(str(backend_dir / "database" / "app.db"))
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    conn.close()

    assert "agent_outputs" in tables, f"'agent_outputs' table missing from SQLite: {tables}"
    print("  ✅ 'agent_outputs' table successfully verified in database/app.db.")


def test_agent_output_model_crud():
    print("\n[STEP 2] Testing AgentOutput Database Model CRUD...")
    with SessionLocal() as db:
        test_title = f"Test_Report_{uuid4().hex[:6]}.pdf"
        output = model.create_agent_output(
            db=db,
            title=test_title,
            output_type="pdf",
            agent_name="Research Analyst",
            file_path="uploads/test_report.pdf",
            file_size=102400,
            mime_type="application/pdf",
            content_preview="Executive Summary: Benchmark results...",
        )
        out_id = output.id
        assert out_id is not None
        print(f"  ✅ Created AgentOutput record in DB with ID: {out_id}")

        # Query back
        fetched = model.get_agent_output_by_id(db=db, output_id=out_id)
        assert fetched is not None
        assert fetched.title == test_title
        assert fetched.output_type == "pdf"
        assert fetched.mime_type == "application/pdf"
        assert fetched.file_size == 102400
        print("  ✅ Retrieved AgentOutput record with all fields verified.")

        # Filter by type
        pdfs = model.get_agent_outputs(db=db, output_type="pdf")
        assert any(p.id == out_id for p in pdfs)
        print("  ✅ Filter by output_type='pdf' passed.")

        # Search
        searched = model.get_agent_outputs(db=db, search="Research Analyst")
        assert any(p.id == out_id for p in searched)
        print("  ✅ Search by agent_name passed.")

        # Cleanup
        model.delete_agent_output(db=db, output=fetched)
        assert model.get_agent_output_by_id(db=db, output_id=out_id) is None
        print("  ✅ Deleted AgentOutput successfully.")


def test_agent_output_file_download_and_preview():
    print("\n[STEP 3] Testing File Generation, Download Response, and Preview...")
    outputs_dir = get_outputs_dir()
    outputs_dir.mkdir(parents=True, exist_ok=True)

    test_pdf_file = outputs_dir / f"test_doc_{uuid4().hex[:6]}.pdf"
    # Write a dummy binary PDF header
    with open(test_pdf_file, "wb") as f:
        f.write(b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")

    test_md_file = outputs_dir / f"test_notes_{uuid4().hex[:6]}.md"
    with open(test_md_file, "w", encoding="utf-8") as f:
        f.write("# Analysis Results\n\n- Key Metric 1: 99.4%\n- Key Metric 2: 12ms latency\n")

    with SessionLocal() as db:
        pdf_out = model.create_agent_output(
            db=db,
            title=test_pdf_file.name,
            output_type="pdf",
            agent_name="PDF Specialist",
            file_path=str(test_pdf_file),
            file_size=test_pdf_file.stat().st_size,
            mime_type="application/pdf",
        )

        md_out = model.create_agent_output(
            db=db,
            title=test_md_file.name,
            output_type="markdown",
            agent_name="Data Reporter",
            file_path=str(test_md_file),
            file_size=test_md_file.stat().st_size,
            mime_type="text/markdown",
            content_preview="# Analysis Results...",
        )

        # 1. Test Download Controller for PDF
        pdf_download_resp = controller.download_output_controller(db=db, output_id=pdf_out.id)
        assert hasattr(pdf_download_resp, "path") or hasattr(pdf_download_resp, "body")
        print(f"  ✅ PDF Download response verified: media_type='{pdf_download_resp.media_type}'")

        # 2. Test Preview Controller for Markdown
        md_preview = controller.preview_output_controller(db=db, output_id=md_out.id)
        assert md_preview.is_binary is False
        assert "Analysis Results" in (md_preview.content or "")
        print("  ✅ Markdown Preview response verified text content.")

        # 3. Test Preview Controller for PDF
        pdf_preview = controller.preview_output_controller(db=db, output_id=pdf_out.id)
        assert pdf_preview.is_binary is True
        print("  ✅ PDF Preview correctly detected binary output.")

        # 4. Clean up via controller
        controller.delete_output_controller(db=db, output_id=pdf_out.id)
        controller.delete_output_controller(db=db, output_id=md_out.id)

        assert not test_pdf_file.exists()
        assert not test_md_file.exists()
        print("  ✅ Cleaned up records and disk files successfully.")


if __name__ == "__main__":
    test_agent_outputs_table_exists()
    test_agent_output_model_crud()
    test_agent_output_file_download_and_preview()
    print("\n🎉 ALL AGENT OUTPUT TESTS PASSED SUCCESSFULLY!\n")
