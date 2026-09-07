import logging
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database.models.setting import Setting
from app.features.settings.schemas import SettingsData

logger = logging.getLogger(__name__)


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
    else:
        # Ensure is_testing key is always initialized
        current_data = dict(setting.data or {})
        if "is_testing" not in current_data:
            current_data["is_testing"] = False
            setting.data = current_data
            flag_modified(setting, "data")
            db.commit()
            db.refresh(setting)
    return setting


def get_is_testing(db: Session | None = None) -> bool:
    """Retrieves is_testing flag from the settings table. Defaults to False."""
    try:
        if db is not None:
            # First check dedicated key='is_testing' row
            direct_row = db.scalar(select(Setting).where(Setting.key == "is_testing"))
            if direct_row and isinstance(direct_row.data, dict):
                if "is_testing" in direct_row.data:
                    return bool(direct_row.data["is_testing"])
                if "value" in direct_row.data:
                    return bool(direct_row.data["value"])

            # Fallback to general settings row
            setting = get_or_create_settings(db, key="general")
            return bool(setting.data.get("is_testing", False))
        else:
            from database.database import SessionLocal
            with SessionLocal() as session:
                return get_is_testing(db=session)
    except Exception as exc:
        logger.warning("Could not read is_testing from settings table: %s", exc)
        return False


def update_settings(db: Session, update_data: dict[str, Any], key: str = "general") -> Setting:
    setting = get_or_create_settings(db, key=key)
    current_data = dict(setting.data or {})

    is_testing_val = None

    # Merge top-level fields
    for k, v in update_data.items():
        if v is not None:
            if k == "extra_values" and isinstance(v, dict):
                current_extras = dict(current_data.get("extra_values", {}))
                current_extras.update(v)
                current_data["extra_values"] = current_extras
            elif k == "is_testing":
                is_testing_val = bool(v)
                current_data["is_testing"] = is_testing_val
            else:
                current_data[k] = v

    setting.data = current_data
    flag_modified(setting, "data")
    db.commit()
    db.refresh(setting)

    # Also persist is_testing to dedicated key row if provided
    if is_testing_val is not None:
        try:
            testing_row = db.scalar(select(Setting).where(Setting.key == "is_testing"))
            if not testing_row:
                testing_row = Setting(
                    key="is_testing",
                    data={"is_testing": is_testing_val, "value": is_testing_val},
                )
                db.add(testing_row)
            else:
                testing_row_data = dict(testing_row.data or {})
                testing_row_data["is_testing"] = is_testing_val
                testing_row_data["value"] = is_testing_val
                testing_row.data = testing_row_data
                flag_modified(testing_row, "data")
            db.commit()
        except Exception as err:
            logger.warning("Could not write dedicated is_testing row: %s", err)

        # Synchronize in-memory compatibility flag
        try:
            import app.llm as llm
            llm.available_testing = is_testing_val
            llm.aviable_testing = is_testing_val
        except Exception:
            pass

    return setting


def set_is_testing(db: Session, is_testing: bool) -> Setting:
    """Convenience helper to set the is_testing boolean flag in settings."""
    return update_settings(db, update_data={"is_testing": is_testing}, key="general")

