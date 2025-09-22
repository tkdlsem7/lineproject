from __future__ import annotations
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field
from pydantic import ConfigDict

class BaseSchema(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

class Meta(BaseSchema):
    model_name: Optional[str] = None
    car_no: Optional[str] = None
    machine_no: Optional[str] = None
    sn: Optional[str] = None
    chiller_sn: Optional[str] = None
    setup_start_date: Optional[date] = None
    setup_end_date: Optional[date] = None

class Step(BaseSchema):
    id: Optional[int] = None            # ← 수정/업데이트 시 사용(없으면 새로 생성)
    step_name: str
    setup_hours: Optional[float] = Field(default=None, ge=0)
    defect_detail: Optional[str] = None
    quality_score: Optional[int] = Field(default=None, ge=0, le=100)
    ts_hours: Optional[float] = Field(default=None, ge=0)

class SaveRequest(BaseSchema):
    sheetId: Optional[int] = None
    meta: Meta
    step: Step

class SaveResponse(BaseSchema):
    sheetId: int
    headerId: int
    stepId: int
