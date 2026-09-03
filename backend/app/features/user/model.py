from datetime import datetime
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from database.models import RefreshToken, User


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    statement = select(User).where(User.id == user_id)
    return db.scalar(statement)


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = select(User).where(User.email == email)
    return db.scalar(statement)


def get_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    statement = select(User).offset(skip).limit(limit).order_by(User.created_at.desc())
    return list(db.scalars(statement).all())


def create_user(db: Session, name: str, email: str, password_hash: str) -> User:
    user = User(name=name, email=email, password_hash=password_hash)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user: User,
    name: str | None = None,
    email: str | None = None,
    password_hash: str | None = None,
) -> User:
    if name is not None:
        user.name = name
    if email is not None:
        user.email = email
    if password_hash is not None:
        user.password_hash = password_hash

    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    db.delete(user)
    db.commit()


def delete_user_by_id(db: Session, user_id: UUID) -> bool:
    user = get_user_by_id(db, user_id)
    if user is None:
        return False
    delete_user(db, user)
    return True


def create_refresh_token(
    db: Session,
    user_id: UUID,
    token: str,
    expires_at: datetime,
) -> RefreshToken:
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        expires_at=expires_at,
    )
    db.add(refresh_token)
    db.commit()
    db.refresh(refresh_token)
    return refresh_token


def get_refresh_token(db: Session, token: str) -> RefreshToken | None:
    statement = select(RefreshToken).where(RefreshToken.token == token)
    return db.scalar(statement)


def revoke_refresh_token(db: Session, token: str) -> bool:
    statement = (
        update(RefreshToken)
        .where(RefreshToken.token == token)
        .values(revoked=True)
    )
    result = db.execute(statement)
    db.commit()
    return result.rowcount > 0


def revoke_all_user_refresh_tokens(db: Session, user_id: UUID) -> None:
    statement = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id)
        .values(revoked=True)
    )
    db.execute(statement)
    db.commit()