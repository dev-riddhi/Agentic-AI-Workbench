from fastapi import APIRouter, Body, Depends, Query, status
from sqlalchemy.orm import Session

from app.features.settings import controller, model
from app.features.settings.schemas import SettingsResponse, SettingsUpdate
from app.features.user.controller import get_optional_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/settings")


@router.get("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.get("/", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
def get_settings(
    db: Session = Depends(get_db),
):
    """Retrieve global system and company settings."""
    return controller.get_settings_controller(db=db)


@router.put("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.put("/", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.patch("", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.patch("/", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    """Update system, company, and runtime limit settings."""
    return controller.update_settings_controller(db=db, payload=payload)


@router.put("/is_testing", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.patch("/is_testing", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
@router.post("/is_testing", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
def update_is_testing_direct(
    payload: dict | None = Body(default=None),
    is_testing: bool | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_current_user),
):
    """Directly update the is_testing flag in the database settings table."""
    value = None
    if payload is not None and "is_testing" in payload:
        value = bool(payload["is_testing"])
    elif is_testing is not None:
        value = bool(is_testing)
    elif payload is not None and "value" in payload:
        value = bool(payload["value"])
    else:
        value = True

    model.set_is_testing(db=db, is_testing=value)
    return controller.get_settings_controller(db=db)

