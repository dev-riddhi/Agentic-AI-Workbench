"""Comprehensive verification test for file tools reorganization & folder scoping:
1. All file tools located in app.tools.file
2. create_file writes strictly inside backend/outputs
3. edit_file writes strictly inside backend/outputs (rejects uploads)
4. delete_rename_file only deletes/renames inside backend/outputs (rejects uploads)
5. read_file can read from other folders (uploads, outputs)
6. encoding parameter is NOT in create_file signature, works seamlessly
"""

import inspect
from pathlib import Path
import sys

backend_dir = Path(__file__).resolve().parent.parent if Path(__file__).resolve().parent.name == "test" else Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.tools import (
    create_file,
    read_file,
    edit_file,
    delete_rename_file,
)
from app.tools.file.file_security import get_outputs_dir, get_upload_dir


def test_signatures():
    sig = inspect.signature(create_file)
    assert "encoding" not in sig.parameters, "encoding should NOT be in create_file signature"
    print("[OK] test_signatures: create_file signature does not have 'encoding'")


def test_read_file_can_read_other_folders():
    upload_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()

    # Create a test file in uploads
    test_upload_file = upload_dir / "sample_in_uploads.txt"
    test_upload_file.write_text("Hello from uploads folder", encoding="utf-8")

    # Read from uploads
    res1 = read_file("sample_in_uploads.txt")
    assert res1["success"] is True, f"Failed to read from uploads: {res1}"
    assert "Hello from uploads folder" in res1["content"]

    # Create a test file in outputs
    test_output_file = outputs_dir / "sample_in_outputs.txt"
    test_output_file.write_text("Hello from outputs folder", encoding="utf-8")

    # Read from outputs
    res2 = read_file("sample_in_outputs.txt")
    assert res2["success"] is True, f"Failed to read from outputs: {res2}"
    assert "Hello from outputs folder" in res2["content"]

    # Read with explicit 'outputs/' prefix
    res3 = read_file("outputs/sample_in_outputs.txt")
    assert res3["success"] is True, f"Failed to read with outputs/ prefix: {res3}"
    assert "Hello from outputs folder" in res3["content"]

    # Clean up
    test_upload_file.unlink(missing_ok=True)
    test_output_file.unlink(missing_ok=True)
    print("[OK] test_read_file_can_read_other_folders: read_file successfully reads from uploads and outputs")


def test_create_file_only_inside_outputs():
    outputs_dir = get_outputs_dir()

    # Create a file
    res = create_file("agent_note.txt", content="This is an agent deliverable", file_type="txt")
    assert res["success"] is True, f"Create failed: {res}"
    # Target should be created as .md in outputs
    created_path = Path(res["file_path"])
    assert created_path.parent == outputs_dir
    assert created_path.suffix == ".md"
    assert created_path.exists()

    # Clean up
    created_path.unlink(missing_ok=True)
    print("[OK] test_create_file_only_inside_outputs: create_file strictly writes inside backend/outputs")


def test_edit_file_strictly_outputs():
    upload_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()

    # Create a file in uploads directly
    file_in_uploads = upload_dir / "protected_upload.txt"
    file_in_uploads.write_text("Original Upload Content", encoding="utf-8")

    # Try to edit the file in uploads (should be REJECTED or resolve only in outputs)
    res_upload_edit = edit_file("uploads/protected_upload.txt", "Original", "Hacked")
    assert res_upload_edit["success"] is False, "edit_file must NOT succeed for uploads folder!"
    assert "Access denied" in res_upload_edit.get("error", "")

    # Create a file in outputs
    file_in_outputs = outputs_dir / "editable_output.txt"
    file_in_outputs.write_text("Editable Output Content", encoding="utf-8")

    # Edit file in outputs (should SUCCEED)
    res_output_edit = edit_file("editable_output.txt", "Editable", "Updated")
    assert res_output_edit["success"] is True, f"edit_file in outputs failed: {res_output_edit}"
    assert file_in_outputs.read_text(encoding="utf-8") == "Updated Output Content"

    # Clean up
    file_in_uploads.unlink(missing_ok=True)
    file_in_outputs.unlink(missing_ok=True)
    print("[OK] test_edit_file_strictly_outputs: edit_file can only edit files inside backend/outputs")


def test_delete_rename_file_strictly_outputs():
    upload_dir = get_upload_dir()
    outputs_dir = get_outputs_dir()

    # Create a file in uploads
    file_in_uploads = upload_dir / "cannot_delete_upload.txt"
    file_in_uploads.write_text("Upload File", encoding="utf-8")

    # Attempt to delete file in uploads (must be REJECTED)
    res_del_upload = delete_rename_file("delete", "uploads/cannot_delete_upload.txt")
    assert res_del_upload["success"] is False, "delete_rename_file must NOT delete files in uploads!"
    assert file_in_uploads.exists(), "File in uploads should still exist!"

    # Attempt to rename file in uploads (must be REJECTED)
    res_ren_upload = delete_rename_file("rename", "uploads/cannot_delete_upload.txt", "renamed.txt")
    assert res_ren_upload["success"] is False, "delete_rename_file must NOT rename files in uploads!"

    # Create a file in outputs
    file_in_outputs = outputs_dir / "deletable_output.txt"
    file_in_outputs.write_text("Output File", encoding="utf-8")

    # Rename inside outputs (should SUCCEED)
    res_rename = delete_rename_file("rename", "deletable_output.txt", "renamed_output.txt")
    assert res_rename["success"] is True, f"Rename failed: {res_rename}"
    renamed_file = outputs_dir / "renamed_output.txt"
    assert renamed_file.exists()
    assert not file_in_outputs.exists()

    # Delete inside outputs (should SUCCEED)
    res_delete = delete_rename_file("delete", "renamed_output.txt")
    assert res_delete["success"] is True, f"Delete failed: {res_delete}"
    assert not renamed_file.exists()

    # Clean up
    file_in_uploads.unlink(missing_ok=True)
    print("[OK] test_delete_rename_file_strictly_outputs: delete and rename strictly restricted to backend/outputs")


if __name__ == "__main__":
    test_signatures()
    test_read_file_can_read_other_folders()
    test_create_file_only_inside_outputs()
    test_edit_file_strictly_outputs()
    test_delete_rename_file_strictly_outputs()
    print("\nALL FILE TOOL SECURITY AND REORGANIZATION TESTS PASSED!")
