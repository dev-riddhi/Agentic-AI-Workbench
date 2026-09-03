from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from database.models import Document


def get_documents(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[Document]:
    statement = (
        select(Document)
        .offset(skip)
        .limit(limit)
        .order_by(Document.created_at.desc())
    )
    return list(db.scalars(statement).all())


def get_document_by_id(db: Session, doc_id: UUID) -> Document | None:
    statement = select(Document).where(Document.id == doc_id)
    return db.scalar(statement)


def create_document(
    db: Session,
    name: str,
    file_path: str,
    mime_type: str | None = None,
) -> Document:
    document = Document(
        name=name,
        file_path=file_path,
        mime_type=mime_type,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return document


def delete_document(db: Session, document: Document) -> None:
    db.delete(document)
    db.commit()


def get_documents_by_ids(db: Session, doc_ids: list[UUID]) -> list[Document]:
    if not doc_ids:
        return []
    statement = select(Document).where(Document.id.in_(doc_ids))
    return list(db.scalars(statement).all())
