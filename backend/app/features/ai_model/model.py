from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from database.models import AIModel


def create_ai_model(
    db: Session,
    name: str,
    repo_id: str,
    filename: str,
    file_path: str,
    format: str = "gguf",
    quantization: str | None = None,
    size_bytes: int | None = None,
    status: str = "downloading",
) -> AIModel:
    model = AIModel(
        name=name,
        repo_id=repo_id,
        filename=filename,
        file_path=file_path,
        format=format,
        quantization=quantization,
        size_bytes=size_bytes,
        status=status,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def get_ai_models(
    db: Session,
    skip: int = 0,
    limit: int = 100,
) -> list[AIModel]:
    statement = (
        select(AIModel)
        .offset(skip)
        .limit(limit)
        .order_by(AIModel.created_at.desc())
    )
    return list(db.scalars(statement).all())


def get_ai_model_by_id(db: Session, model_id: UUID) -> AIModel | None:
    statement = select(AIModel).where(AIModel.id == model_id)
    return db.scalar(statement)


def get_ai_model_by_repo_and_file(
    db: Session,
    repo_id: str,
    filename: str,
) -> AIModel | None:
    statement = select(AIModel).where(
        AIModel.repo_id == repo_id,
        AIModel.filename == filename,
    )
    return db.scalar(statement)


def get_ai_model_by_filename_or_path(
    db: Session,
    filename: str,
    file_path: str | None = None,
    repo_id: str | None = None,
) -> AIModel | None:
    conditions = [AIModel.filename == filename]
    if file_path:
        conditions.append(AIModel.file_path == file_path)
    if repo_id:
        conditions.append((AIModel.repo_id == repo_id) & (AIModel.filename == filename))
    statement = select(AIModel).where(or_(*conditions))
    return db.scalars(statement).first()


def update_ai_model_status(
    db: Session,
    model: AIModel,
    status: str,
    file_path: str | None = None,
    size_bytes: int | None = None,
    error_message: str | None = None,
) -> AIModel:
    model.status = status
    if file_path is not None:
        model.file_path = file_path
    if size_bytes is not None:
        model.size_bytes = size_bytes
    if error_message is not None:
        model.error_message = error_message

    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def delete_ai_model(db: Session, model: AIModel) -> None:
    db.delete(model)
    db.commit()
