import os
import shutil
from uuid import UUID, uuid4

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.features.documents import model
from database.models import Document

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def upload_document_controller(db: Session, file: UploadFile) -> Document:
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename cannot be empty",
        )

    safe_filename = os.path.basename(file.filename)
    unique_prefix = uuid4().hex
    stored_filename = f"{unique_prefix}_{safe_filename}"
    file_path = os.path.join(UPLOAD_DIR, stored_filename)

    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {str(exc)}",
        )
    finally:
        file.file.close()

    return model.create_document(
        db=db,
        name=safe_filename,
        file_path=file_path,
        mime_type=file.content_type,
    )


def get_documents_controller(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:
    return model.get_documents(db=db, skip=skip, limit=limit)


def get_document_by_id_controller(db: Session, doc_id: UUID) -> Document:
    document = model.get_document_by_id(db=db, doc_id=doc_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )
    return document


def download_document_controller(db: Session, doc_id: UUID) -> FileResponse:
    document = model.get_document_by_id(db=db, doc_id=doc_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if not os.path.exists(document.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file does not exist on storage",
        )

    return FileResponse(
        path=document.file_path,
        filename=document.name,
        media_type=document.mime_type or "application/octet-stream",
    )


def delete_document_controller(db: Session, doc_id: UUID) -> None:
    document = model.get_document_by_id(db=db, doc_id=doc_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found",
        )

    if os.path.exists(document.file_path):
        try:
            os.remove(document.file_path)
        except OSError:
            pass

    model.delete_document(db=db, document=document)
