from datetime import datetime
import os
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field


class DocumentBase(BaseModel):
    name: str = Field(
        ...,
        validation_alias=AliasChoices("name", "filename"),
    )
    mime_type: str | None = None


class DocumentResponse(DocumentBase):
    id: UUID
    file_path: str
    created_at: datetime
    status: str = "indexed"

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    @property
    def filename(self) -> str:
        return self.name

    @computed_field
    @property
    def size_bytes(self) -> int:
        try:
            if os.path.exists(self.file_path):
                return os.path.getsize(self.file_path)
        except Exception:
            pass
        return 0
