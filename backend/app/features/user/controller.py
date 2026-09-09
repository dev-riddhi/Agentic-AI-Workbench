from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.features.user import model
from app.features.user.schemas import (
    LoginRequest,
    TokenResponse,
    UserCreate,
    UserUpdate,
)
from database.database import get_db
from database.models.user import User

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "agentic-workbench-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

http_bearer = HTTPBearer(auto_error=True)


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        600_000,
    )
    return f"pbkdf2_sha256$600000${salt.hex()}${password_hash.hex()}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        _, iterations, salt_hex, hash_hex = hashed_password.split("$")
        salt = bytes.fromhex(salt_hex)
        expected_hash = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            salt,
            int(iterations),
        )
        return secrets.compare_digest(expected_hash.hex(), hash_hex)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> tuple[str, int]:
    to_encode = data.copy()
    expire_delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    expire = datetime.now(timezone.utc) + expire_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt, int(expire_delta.total_seconds())


def create_refresh_token_string() -> str:
    return secrets.token_urlsafe(64)


def login_controller(db: Session, login_data: LoginRequest) -> TokenResponse:
    user = model.get_user_by_email(db, login_data.email)
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token, expires_in = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )
    refresh_token_str = create_refresh_token_string()
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    model.create_refresh_token(
        db=db,
        user_id=user.id,
        token=refresh_token_str,
        expires_at=expires_at,
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token_str,
        token_type="bearer",
        expires_in=expires_in,
    )


def refresh_token_controller(db: Session, refresh_token_str: str) -> TokenResponse:
    token_record = model.get_refresh_token(db, refresh_token_str)
    if not token_record or token_record.revoked or token_record.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid, expired, or revoked refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = model.get_user_by_id(db, token_record.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Rotate refresh token
    model.revoke_refresh_token(db, refresh_token_str)
    new_refresh_token_str = create_refresh_token_string()
    new_expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    model.create_refresh_token(
        db=db,
        user_id=user.id,
        token=new_refresh_token_str,
        expires_at=new_expires_at,
    )

    access_token, expires_in = create_access_token(
        data={"sub": str(user.id), "email": user.email}
    )

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token_str,
        token_type="bearer",
        expires_in=expires_in,
    )


def logout_controller(db: Session, refresh_token_str: str) -> None:
    model.revoke_refresh_token(db, refresh_token_str)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id_str: str | None = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    user = model.get_user_by_id(db, user_id=user_id)
    if user is None:
        raise credentials_exception
    return user


http_bearer_optional = HTTPBearer(auto_error=False)


def get_optional_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(http_bearer_optional),
    db: Session = Depends(get_db),
) -> User | None:
    if not credentials or not credentials.credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            return None
        return model.get_user_by_id(db, user_id=UUID(user_id_str))
    except Exception:
        return None



def create_user_controller(db: Session, user_in: UserCreate) -> User:
    existing_user = model.get_user_by_email(db, user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    hashed_pw = hash_password(user_in.password)
    return model.create_user(
        db=db,
        name=user_in.name,
        email=user_in.email,
        password_hash=hashed_pw,
    )


def get_users_controller(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return model.get_users(db=db, skip=skip, limit=limit)


def get_user_by_id_controller(db: Session, user_id: UUID) -> User:
    user = model.get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


def update_user_controller(db: Session, user_id: UUID, user_in: UserUpdate) -> User:
    user = model.get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if user_in.email is not None and user_in.email != user.email:
        existing_user = model.get_user_by_email(db=db, email=user_in.email)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )

    password_hash = hash_password(user_in.password) if user_in.password else None

    return model.update_user(
        db=db,
        user=user,
        name=user_in.name,
        email=user_in.email,
        password_hash=password_hash,
    )


def delete_user_controller(db: Session, user_id: UUID) -> None:
    user = model.get_user_by_id(db=db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    model.delete_user(db=db, user=user)
