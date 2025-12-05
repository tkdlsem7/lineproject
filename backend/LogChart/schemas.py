# app/schemas/logcharts.py
# ─────────────────────────────────────────────────────────
# LogChart 응답 전용 스키마
#  - 요청은 GET 쿼리스트링으로 받고, 응답 모델만 정의
# ─────────────────────────────────────────────────────────
from typing import List, Optional
from pydantic import BaseModel


class LeadCycleStats(BaseModel):
    lead_avg_days: float
    lead_min_days: float
    lead_max_days: float
    cycle_avg_days: float
    cycle_min_days: float
    cycle_max_days: float


class StepStatItem(BaseModel):
    step: str
    count: int
    avg_hours: float
    max_hours: float
    min_hours: float


class StepStats(BaseModel):
    total_hours: float
    steps: List[StepStatItem]


class KeyCount(BaseModel):
    key: str
    count: int


class DefectStats(BaseModel):
    per_unit_avg: float
    per_unit_max: float
    per_unit_min: float
    ts_time_per_unit_avg_hours: float
    incoming_quality_avg: Optional[float] = None
    incoming_quality_max: Optional[float] = None
    incoming_quality_min: Optional[float] = None
    by_category: List[KeyCount]
    by_location: List[KeyCount]
    by_item: List[KeyCount]
    by_type: List[KeyCount]


class MonthFlowItem(BaseModel):
    month: str  # 'YYYY-MM'
    receipts: int
    shipments: int
    turnover_rate: Optional[float] = None  # %


class MonthlyFlow(BaseModel):
    total_receipts: int
    total_shipments: int
    avg_turnover_rate: Optional[float] = None
    max_turnover_rate: Optional[float] = None
    min_turnover_rate: Optional[float] = None
    months: List[MonthFlowItem]

class LeadStageStats(BaseModel):
    # 평균(일)
    receipt_to_start_avg_days: float
    start_to_complete_avg_days: float
    complete_to_ship_avg_days: float
    # 참고용 min/max 및 표본수
    receipt_to_start_min_days: float
    receipt_to_start_max_days: float
    start_to_complete_min_days: float
    start_to_complete_max_days: float
    complete_to_ship_min_days: float
    complete_to_ship_max_days: float
    n_receipt_to_start: int
    n_start_to_complete: int
    n_complete_to_ship: int