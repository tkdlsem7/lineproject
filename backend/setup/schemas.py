# schemas.py
from __future__ import annotations
from typing import Optional, List
from datetime import date, datetime
from pydantic import BaseModel, Field, ConfigDict

class _Base(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # ORM → Pydantic

# ─ 요청 본문 ─
class Meta(_Base):
    machine_no: Optional[str] = None
    sn: Optional[str] = None
    chiller_sn: Optional[str] = None
    setup_start_date: Optional[date] = None
    setup_end_date: Optional[date] = None

class Step(_Base):
    id: Optional[int] = None     # 있으면 UPDATE, 없으면 INSERT
    step_name: str
    setup_hours: Optional[float] = Field(default=None, ge=0)
    defect_detail: Optional[str] = None
    quality_score: Optional[int] = Field(default=None, ge=0, le=100)
    ts_hours: Optional[float] = Field(default=None, ge=0)

    # ★ 새로 추가된 불량 관련 필드들
    hw_sw: Optional[str] = None             # H/W, S/W
    defect: Optional[str] = None           # 불량
    defect_type: Optional[str] = None      # 불량유형
    defect_group: Optional[str] = None     # 불량구분
    defect_location: Optional[str] = None  # 불량위치

class SaveRequest(_Base):
    sheetId: Optional[int] = None
    meta: Meta
    step: Step

class SaveResponse(_Base):
    sheetId: int
    stepId: int

# ─ 조회 응답 ─
class RowRead(_Base):
    id: int
    sheet_id: int
    step_name: Optional[str]
    machine_no: Optional[str]
    sn: Optional[str]
    chiller_sn: Optional[str]
    setup_start_date: Optional[date]
    setup_end_date: Optional[date]
    setup_hours: Optional[float]
    defect_detail: Optional[str]
    quality_score: Optional[int]
    ts_hours: Optional[float]

    # ★ 새 컬럼들 조회에도 포함
    hw_sw: Optional[str]
    defect: Optional[str]
    defect_type: Optional[str]
    defect_group: Optional[str]
    defect_location: Optional[str]

    created_at: datetime
