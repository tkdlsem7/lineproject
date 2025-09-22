# backend/Checklist/schemas.py
# v1/v2 모두 동작하는 간단 스키마

try:
    from pydantic import BaseModel, Field, ConfigDict
    _V2 = True
except Exception:
    from pydantic import BaseModel, Field  # type: ignore
    _V2 = False


class ChecklistOut(BaseModel):
    no: int
    option: str
    step: int
    item: str
    hours: float

    if _V2:
        model_config = ConfigDict(from_attributes=True)
    else:
        class Config:
            orm_mode = True


class ChecklistCreate(BaseModel):
    # 선택한 옵션명으로 고정하여 생성
    option: str = Field(..., min_length=1, max_length=20)
    step: int = Field(..., ge=1)
    item: str = Field(..., min_length=1, max_length=200)
    hours: float = Field(..., ge=0)


class ChecklistUpdate(BaseModel):
    # 전체 필드 업데이트(단순화)
    step: int = Field(..., ge=1)
    item: str = Field(..., min_length=1, max_length=200)
    hours: float = Field(..., ge=0)
