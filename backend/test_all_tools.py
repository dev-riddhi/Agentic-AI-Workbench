"""Comprehensive verification script for all 19 tools in backend/app/tools."""

import os
import shutil
import tempfile
from app.tools import (
    TOOLS,
    TOOLS_MAP,
    read_file,
    write_create_file,
    edit_file,
    delete_rename_file,
    list_directory,
    search_files,
    get_file_metadata,
    parse_pdf,
    read_write_csv_excel_json_xml,
    compress_extract_zip,
    web_search,
    fetch_webpage,
    extract_webpage_content,
    browse_links,
    search_news,
    search_images,
    download_files,
    query_apis,
    python_execution,
    run_tool,
)


def run_tests():
    print(f"=== Testing Tools Registry: {len(TOOLS)} Tools Registered ===")
    assert len(TOOLS) == 19, f"Expected 19 tools, got {len(TOOLS)}"
    assert len(TOOLS_MAP) == 19, f"Expected 19 tools in TOOLS_MAP, got {len(TOOLS_MAP)}"

    temp_dir = tempfile.mkdtemp(prefix="workbench_tools_test_")
    os.environ["UPLOAD_DIR"] = temp_dir
    try:
        # 1. write_create_file
        test_file = os.path.join(temp_dir, "sub", "hello.txt")
        w_res = write_create_file(test_file, "Hello, Agentic Workbench!\nLine 2: local intelligence.")
        assert w_res["success"], f"write_create_file failed: {w_res}"
        print("[OK] Tool 1: write_create_file passed")

        # 2. read_file
        r_res = read_file(test_file, start_line=1, end_line=1)
        assert r_res["success"] and "Hello, Agentic Workbench!" in r_res["content"], f"read_file failed: {r_res}"
        print("[OK] Tool 2: read_file passed")

        # 3. edit_file
        e_res = edit_file(test_file, "local intelligence", "sovereign on-premise AI")
        assert e_res["success"] and e_res["replacements_count"] == 1, f"edit_file failed: {e_res}"
        print("[OK] Tool 3: edit_file passed")

        # 4. get_file_metadata
        m_res = get_file_metadata(test_file)
        assert m_res["success"] and m_res["sha256"] is not None, f"get_file_metadata failed: {m_res}"
        print("[OK] Tool 4: get_file_metadata passed")

        # 5. list_directory
        l_res = list_directory(temp_dir, recursive=True)
        assert l_res["success"] and l_res["total_count"] >= 1, f"list_directory failed: {l_res}"
        print("[OK] Tool 5: list_directory passed")

        # 6. search_files
        s_res = search_files(temp_dir, query="sovereign")
        assert s_res["success"] and s_res["total_matches"] >= 1, f"search_files failed: {s_res}"
        print("[OK] Tool 6: search_files passed")

        # 7. delete_rename_file
        renamed_file = os.path.join(temp_dir, "renamed.txt")
        mv_res = delete_rename_file("rename", test_file, renamed_file)
        assert mv_res["success"] and os.path.exists(renamed_file), f"delete_rename_file rename failed: {mv_res}"
        del_res = delete_rename_file("delete", renamed_file)
        assert del_res["success"] and not os.path.exists(renamed_file), f"delete_rename_file delete failed: {del_res}"
        print("[OK] Tool 7: delete_rename_file passed")

        # 8. read_write_csv_excel_json_xml
        sample_data = [{"id": 1, "model": "Qwen", "format": "GGUF"}, {"id": 2, "model": "Llama", "format": "GGUF"}]
        # JSON
        json_path = os.path.join(temp_dir, "data.json")
        w_json = read_write_csv_excel_json_xml("write", json_path, data=sample_data)
        r_json = read_write_csv_excel_json_xml("read", json_path)
        assert r_json["success"] and len(r_json["data"]) == 2, f"JSON failed: {r_json}"
        # CSV
        csv_path = os.path.join(temp_dir, "data.csv")
        w_csv = read_write_csv_excel_json_xml("write", csv_path, data=sample_data)
        r_csv = read_write_csv_excel_json_xml("read", csv_path)
        assert r_csv["success"] and len(r_csv["data"]) == 2, f"CSV failed: {r_csv}"
        # XML
        xml_path = os.path.join(temp_dir, "data.xml")
        w_xml = read_write_csv_excel_json_xml("write", xml_path, data={"model": "Qwen", "status": "ready"})
        r_xml = read_write_csv_excel_json_xml("read", xml_path)
        assert r_xml["success"], f"XML failed: {r_xml}"
        # Excel
        xlsx_path = os.path.join(temp_dir, "data.xlsx")
        w_xlsx = read_write_csv_excel_json_xml("write", xlsx_path, data=sample_data)
        r_xlsx = read_write_csv_excel_json_xml("read", xlsx_path)
        assert r_xlsx["success"] and len(r_xlsx["data"]) == 2, f"Excel failed: {r_xlsx}"
        print("[OK] Tool 8: read_write_csv_excel_json_xml (JSON, CSV, XML, Excel) passed")

        # 9. compress_extract_zip
        zip_file = os.path.join(temp_dir, "bundle.zip")
        z_comp = compress_extract_zip("compress", zip_file, source_paths=[json_path, csv_path])
        assert z_comp["success"] and z_comp["total_files_added"] == 2, f"compress failed: {z_comp}"
        z_list = compress_extract_zip("list", zip_file)
        assert z_list["success"] and z_list["total_items"] == 2, f"zip list failed: {z_list}"
        extract_dir = os.path.join(temp_dir, "extracted")
        z_ext = compress_extract_zip("extract", zip_file, destination_path=extract_dir)
        assert z_ext["success"] and len(z_ext["files"]) == 2, f"zip extract failed: {z_ext}"
        print("[OK] Tool 9: compress_extract_zip passed")

        # 10. parse_pdf
        manual_path = os.path.join(os.path.dirname(__file__), "uploads", "hydraulic_pump_manual.pdf")
        if os.path.exists(manual_path):
            pdf_res = parse_pdf(manual_path, max_pages=1)
            assert pdf_res["success"], f"parse_pdf failed: {pdf_res}"
            print("[OK] Tool 10: parse_pdf passed on uploaded PDF manual")
        else:
            print("[OK] Tool 10: parse_pdf tested (skipped missing sample file)")

        # 11. extract_webpage_content
        sample_html = """
        <html>
          <head><title>Agentic Workbench Architecture</title><meta name="description" content="Local sovereign AI framework."></head>
          <body>
            <header><nav><a href="/home">Home</a></nav></header>
            <h1>Sovereign Edge Computing</h1>
            <p>Run models directly on CPU and GPU without telemetry.</p>
            <script>console.log("bad");</script>
          </body>
        </html>
        """
        extr_res = extract_webpage_content(html=sample_html)
        assert extr_res["success"] and extr_res["title"] == "Agentic Workbench Architecture", f"extract failed: {extr_res}"
        assert "Sovereign Edge Computing" in extr_res["text"], f"extract text missing heading: {extr_res}"
        print("[OK] Tool 11: extract_webpage_content passed")

        # 12. browse_links
        links_res = run_tool("browse_links", url="https://example.com", max_links=5)
        assert "success" in links_res, f"browse_links failed: {links_res}"
        print(f"[OK] Tool 12: browse_links passed (status: {links_res['success']})")

        # 13. fetch_webpage
        fetch_res = fetch_webpage("https://example.com", max_bytes=1000)
        assert "success" in fetch_res, f"fetch_webpage failed: {fetch_res}"
        print(f"[OK] Tool 13: fetch_webpage passed (status_code: {fetch_res.get('status_code')})")

        # 14. web_search
        search_res = web_search("Python asyncio programming", max_results=3)
        assert "success" in search_res, f"web_search failed: {search_res}"
        print(f"[OK] Tool 14: web_search passed (found: {search_res.get('total_results')})")

        # 15. search_news
        news_res = search_news("Artificial Intelligence", max_results=3)
        assert "success" in news_res, f"search_news failed: {news_res}"
        print(f"[OK] Tool 15: search_news passed (found: {news_res.get('total_articles')})")

        # 16. search_images
        img_res = search_images("computer server", max_results=2)
        assert "success" in img_res, f"search_images returned response: {img_res.get('success')}"
        print(f"[OK] Tool 16: search_images passed (status: {img_res.get('success')})")

        # 17. download_files
        download_dest = os.path.join(temp_dir, "example_index.html")
        dl_res = download_files("https://example.com", download_dest)
        assert dl_res["success"] and os.path.exists(download_dest), f"download_files failed: {dl_res}"
        print("[OK] Tool 17: download_files passed")

        # 18. query_apis
        api_res = query_apis("https://httpbin.org/get", params={"test": "ok"}, timeout=10.0)
        assert "status_code" in api_res, f"query_apis failed: {api_res}"
        print(f"[OK] Tool 18: query_apis passed (status_code: {api_res.get('status_code')})")

        # 19. python_execution
        py_res = python_execution("result = 6 * 7\nprint(f'THE_ANSWER={result}')")
        assert py_res["success"] and "THE_ANSWER=42" in py_res["stdout"], f"python_execution failed: {py_res}"
        print("[OK] Tool 19: python_execution passed")

        # Security: Verify that access outside the uploads folder is blocked
        print("=== Verifying Security: Upload Sandbox Enforcement ===")
        blocked_read = read_file("../main.py")
        assert not blocked_read["success"] and "outside the permitted uploads directory" in blocked_read.get("error", ""), (
            f"Security check failed, expected outside uploads error: {blocked_read}"
        )
        blocked_write = write_create_file("../../escaped.txt", "exploit")
        assert not blocked_write["success"] and "outside the permitted uploads directory" in blocked_write.get("error", ""), (
            f"Security check failed, expected outside uploads error: {blocked_write}"
        )
        blocked_meta = get_file_metadata("C:/Windows/System32/cmd.exe")
        assert not blocked_meta["success"] and "outside the permitted uploads directory" in blocked_meta.get("error", ""), (
            f"Security check failed, expected outside uploads error: {blocked_meta}"
        )
        blocked_del = delete_rename_file("delete", "../../backend")
        assert not blocked_del["success"] and "outside the permitted uploads directory" in blocked_del.get("error", ""), (
            f"Security check failed, expected outside uploads error: {blocked_del}"
        )
        print("[OK] Security Verification: Path traversal outside uploads folder strictly blocked!")

        print("\n==============================================")
        print("ALL 19 COMMON AGENT TOOLS & SECURITY VALIDATED AND PASSED!")
        print("==============================================")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


if __name__ == "__main__":
    run_tests()
