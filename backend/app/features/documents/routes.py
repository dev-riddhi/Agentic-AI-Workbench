from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.features.documents import controller
from app.features.documents.schemas import DocumentResponse
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/documents")


@router.post("/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.upload_document_controller(db=db, file=file)


@router.get("/", response_model=list[DocumentResponse], status_code=status.HTTP_200_OK)
def get_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_documents_controller(db=db, skip=skip, limit=limit)


@router.get("/{id}", response_model=DocumentResponse, status_code=status.HTTP_200_OK)
def get_document(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return controller.get_document_by_id_controller(db=db, doc_id=id)


@router.get("/{id}/download")
def download_document(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    return controller.download_document_controller(db=db, doc_id=id)


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    controller.delete_document_controller(db=db, doc_id=id)
