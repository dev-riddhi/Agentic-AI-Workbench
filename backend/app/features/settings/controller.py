from sqlalchemy.orm import Session
from app.features.settings import model
from app.features.settings.schemas import SettingsResponse, SettingsUpdate


def get_settings_controller(db: Session, key: str = "general") -> SettingsResponse:
    setting = model.get_or_create_settings(db, key=key)
    return SettingsResponse.model_validate(setting)


def update_settings_controller(db: Session, payload: SettingsUpdate, key: str = "general") -> SettingsResponse:
    update_dict = payload.model_dump(exclude_unset=True)
    setting = model.update_settings(db, update_data=update_dict, key=key)
    return SettingsResponse.model_validate(setting)
