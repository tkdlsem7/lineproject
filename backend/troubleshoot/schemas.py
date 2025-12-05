# app/schemas/troubleshoot.py
from typing import Optional, Literal
from datetime import datetime
from pydantic import BaseModel, Field

# Pydantic v2 지원
try:
    from pydantic import ConfigDict
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
    month: int = Field(..., ge=1, le=12)

    # ✅ 변경: machine_no 로 통일
    machine_no: str

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

    if _HAS_CONFIG_DICT:
        model_config = ConfigDict(from_attributes=True)
    else:
        class Config:
            orm_mode = True


class TroubleShootUpdate(BaseModel):
    month: Optional[int] = Field(None, ge=1, le=12)
    machine_no: Optional[str] = None
    hw_sw: Optional[HwSw] = None
    step: Optional[Step] = None
    defect_category: Optional[DefectCat] = None
    location: Optional[str] = None
    defect: Optional[str] = None
    defect_type: Optional[str] = None
    detail: Optional[str] = None
    photo_ref: Optional[str] = None
    ts_minutes: Optional[int] = Field(None, ge=0)
    reporter: Optional[str] = None