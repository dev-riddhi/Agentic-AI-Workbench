from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.features.user import controller
from app.features.user.schemas import (
    LoginRequest,
    RefreshTokenRequest,
    TokenResponse,
    UserCreate,
    UserResponse,
    UserUpdate,
)
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/users")


@router.post("/login", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def login(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    return controller.login_controller(db=db, login_data=login_data)


@router.post("/refresh", response_model=TokenResponse, status_code=status.HTTP_200_OK)
def refresh_token(
    refresh_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    return controller.refresh_token_controller(
        db=db,
        refresh_token_str=refresh_data.refresh_token,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    logout_data: RefreshTokenRequest,
    db: Session = Depends(get_db),
):
    controller.logout_controller(
        db=db,
        refresh_token_str=logout_data.refresh_token,
    )


@router.get("/me", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_current_user_profile(
    current_user: User = Depends(controller.get_current_user),
):
    return current_user


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    user_in: UserCreate,
    db: Session = Depends(get_db),
):
    return controller.create_user_controller(db=db, user_in=user_in)


@router.get("/", response_model=list[UserResponse], status_code=status.HTTP_200_OK)
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return controller.get_users_controller(db=db, skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def get_user(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    return controller.get_user_by_id_controller(db=db, user_id=user_id)


@router.put("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
@router.patch("/{user_id}", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_user(
    user_id: UUID,
    user_in: UserUpdate,
    db: Session = Depends(get_db),
):
    return controller.update_user_controller(db=db, user_id=user_id, user_in=user_in)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
):
    controller.delete_user_controller(db=db, user_id=user_id)
