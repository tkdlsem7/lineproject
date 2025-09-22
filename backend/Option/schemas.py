# backend/Option/schemas.py
# ------------------------------------------------------------
# Pydantic v1/v2 모두 호환.
# - 타입 별칭 대신 Field+validator로 제약(1~20자, strip)
# - 응답 모델은 SQLAlchemy 객체를 그대로 반환 가능하도록 설정
# ------------------------------------------------------------
from typing import Any

try:
    # pydantic v2
    from pydantic import BaseModel, Field, field_validator, ConfigDict
    _IS_V2 = True
except Exception:  # pydantic v1
    from pydantic import BaseModel, Field, validator  # type: ignore
    _IS_V2 = False


class OptionBase(BaseModel):
    # 1~20자, 설명만 달고 실제 trim은 validator에서 처리
    name: str = Field(..., min_length=1, max_length=20, description="옵션명(1~20자)")

    # 앞뒤 공백 제거
    if _IS_V2:
        @field_validator("name", mode="before")
        @classmethod
        def _strip_name(cls, v: Any) -> Any:
            return v.strip() if isinstance(v, str) else v
    else:
        @validator("name", pre=True)  # type: ignore[misc]
        def _strip_name_v1(cls, v: Any) -> Any:  # type: ignore[no-redef]
            return v.strip() if isinstance(v, str) else v


class OptionCreate(OptionBase):
    """POST /task-options body"""


class OptionUpdate(OptionBase):
    """PUT /task-options/{id} body"""


# 응답 모델
if _IS_V2:
    class OptionOut(BaseModel):
        id: int
        name: str
        # SQLAlchemy 객체 → 응답 허용
        model_config = ConfigDict(from_attributes=True)
else:
    class OptionOut(BaseModel):
        id: int
        name: str
        class Config:
            orm_mode = True
