# app/schemas/troubleshoot.py
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

# Pydantic v2 전용 설정(ORM → 모델 변환) 지원 여부 확인
try:
    from pydantic import ConfigDict  # v2
    _HAS_CONFIG_DICT = True
except Exception:
    _HAS_CONFIG_DICT = False

Step = Literal[
    'Common','Stage','Loader','STAGE(Advanced)','Cold Test',
    'Option&ETC','개조','HW','Packing&Delivery'
]
HwSw = Literal['H/W', 'S/W']
DefectCat = Literal['단순 하드웨어','단순 소프트웨어']

class TroubleShootBase(BaseModel):
    # ⚙️ Field 로 범위 검증 (v1/v2 공통 동작)
    month: int = Field(..., ge=1, le=12)
    model: str
    diff: int
    unit_no: int
    hw_sw: HwSw
    step: Step
    defect_category: DefectCat
    location: str
    defect: str
    defect_type: str
    detail: Optional[str] = None
    photo_ref: Optional[str] = None
    ts_minutes: int = Field(0, ge=0)
    reporter: str

class TroubleShootCreate(TroubleShootBase):
    pass

class TroubleShootRead(TroubleShootBase):
    id: int
    created_at: datetime

    # ✅ v2 / v1 모두 지원
    if _HAS_CONFIG_DICT:
        model_config = ConfigDict(from_attributes=True)  # Pydantic v2
    else:
        class Config:  # Pydantic v1
            orm_mode = True
