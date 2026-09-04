from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database.models.setting import Setting
from app.features.settings.schemas import SettingsData


def get_default_settings_dict() -> dict[str, Any]:
    return SettingsData().model_dump()


def get_or_create_settings(db: Session, key: str = "general") -> Setting:
    statement = select(Setting).where(Setting.key == key)
    setting = db.scalar(statement)
    if not setting:
        default_data = get_default_settings_dict()
        setting = Setting(key=key, data=default_data)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def update_settings(db: Session, update_data: dict[str, Any], key: str = "general") -> Setting:
    setting = get_or_create_settings(db, key=key)
    current_data = dict(setting.data or {})

    # Merge top-level fields
    for k, v in update_data.items():
        if v is not None:
            if k == "extra_values" and isinstance(v, dict):
                current_extras = dict(current_data.get("extra_values", {}))
                current_extras.update(v)
                current_data["extra_values"] = current_extras
            else:
                current_data[k] = v

    setting.data = current_data
    flag_modified(setting, "data")
    db.commit()
    db.refresh(setting)
    return setting
