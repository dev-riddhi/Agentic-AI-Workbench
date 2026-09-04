from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.features.settings import controller
from app.features.settings.schemas import SettingsResponse, SettingsUpdate
from app.features.user.controller import get_current_user
from database.database import get_db
from database.models.user import User

router = APIRouter(prefix="/settings")


@router.get("/", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
def get_settings(
    db: Session = Depends(get_db),
):
    """Retrieve global system and company settings."""
    return controller.get_settings_controller(db=db)


@router.put("/", response_model=SettingsResponse, status_code=status.HTTP_200_OK)
def update_settings(
    payload: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update system, company, and runtime limit settings."""
    return controller.update_settings_controller(db=db, payload=payload)
