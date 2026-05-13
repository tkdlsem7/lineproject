# backend/ScheduleHub/schemas.py
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


TabType = Literal["pending", "shipped", "all"]


class EquipmentListItem(BaseModel):
    id: int
    machine_no: str
    model: Optional[str] = None
    customer_name: Optional[str] = None
    cold_type: Optional[str] = None
    current_status: Optional[str] = None
    is_shipped: bool = False
    last_event_name: Optional[str] = None
    last_event_date: Optional[date] = None


class EquipmentListResponse(BaseModel):
    items: List[EquipmentListItem] = Field(default_factory=list)
    total: int
    page: int
    page_size: int


class ScheduleEventOut(BaseModel):
    id: int
    source_type: str
    event_type: str
    event_name: str
    event_date: date
    status: Optional[str] = None
    team_name: Optional[str] = None
    mo_no: Optional[str] = None
    previous_date: Optional[date] = None
    is_changed: bool = False
    extra_data: Dict[str, Any] = Field(default_factory=dict)


class EquipmentDetailItem(BaseModel):
    id: int
    machine_no: str
    model: Optional[str] = None
    customer_name: Optional[str] = None
    stage_sn: Optional[str] = None
    loader_sn: Optional[str] = None
    cold_type: Optional[str] = None
    mani_type: Optional[str] = None
    current_status: Optional[str] = None
    is_shipped: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class EquipmentDetailResponse(BaseModel):
    equipment: EquipmentDetailItem
    events: List[ScheduleEventOut] = Field(default_factory=list)
    changed_count: int = 0

class ScheduleEventHistoryOut(BaseModel):
    id: int
    equipment_id: int
    source_type: str
    event_type: str
    event_name: str
    team_name: Optional[str] = None
    mo_no: Optional[str] = None
    change_type: str
    before_event_date: Optional[date] = None
    before_status: Optional[str] = None
    before_extra_data: Dict[str, Any] = Field(default_factory=dict)
    after_event_date: Optional[date] = None
    after_status: Optional[str] = None
    after_extra_data: Dict[str, Any] = Field(default_factory=dict)
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class BatchCurrentEventOut(BaseModel):
    id: int
    equipment_id: int
    machine_no: Optional[str] = None
    source_type: str
    event_type: str
    event_name: str
    event_date: date
    status: Optional[str] = None
    team_name: Optional[str] = None
    mo_no: Optional[str] = None
    extra_data: Dict[str, Any] = Field(default_factory=dict)


class BatchHistoryEventOut(BaseModel):
    id: int
    equipment_id: int
    machine_no: Optional[str] = None
    source_type: str
    event_type: str
    event_name: str
    team_name: Optional[str] = None
    mo_no: Optional[str] = None
    change_type: str
    before_event_date: Optional[date] = None
    before_status: Optional[str] = None
    before_extra_data: Dict[str, Any] = Field(default_factory=dict)
    after_event_date: Optional[date] = None
    after_status: Optional[str] = None
    after_extra_data: Dict[str, Any] = Field(default_factory=dict)
    changed_by: Optional[str] = None
    change_reason: Optional[str] = None
    created_at: Optional[datetime] = None


class BatchCurrentSummaryItem(BaseModel):
    source_type: str
    event_type: str
    event_name: str
    machine_count: int
    min_event_date: Optional[date] = None
    max_event_date: Optional[date] = None


class BatchHistorySummaryItem(BaseModel):
    event_name: str
    change_count: int


class BatchHistorySummaryOut(BaseModel):
    total_changes: int = 0
    inserted_count: int = 0
    updated_count: int = 0
    deleted_count: int = 0
    latest_changed_at: Optional[datetime] = None


class BatchHistoryResponse(BaseModel):
    query: str
    model: str
    batch: str
    machine_count: int
    machines: List[str] = Field(default_factory=list)
    history_summary: BatchHistorySummaryOut
    current_summary: List[BatchCurrentSummaryItem] = Field(default_factory=list)
    history_event_summary: List[BatchHistorySummaryItem] = Field(default_factory=list)
    current_events: List[BatchCurrentEventOut] = Field(default_factory=list)
    history_events: List[BatchHistoryEventOut] = Field(default_factory=list)
