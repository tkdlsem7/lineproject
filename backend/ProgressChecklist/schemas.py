# backend/ProgressChecklist/schemas.py
from __future__ import annotations

from typing import List
from pydantic import BaseModel, Field


# ===== 조회 응답 =====

class ChecklistItemOut(BaseModel):
    no: int
    step: int
    item: str
    hours: float
    percent: float


class ChecklistPageOut(BaseModel):
    option: str
    total_hours: float
    item_count: int
    items: List[ChecklistItemOut]
    # 이미 저장된 체크 항목들(없으면 빈 배열)
    checked_steps: List[int] = Field(default_factory=list)


class ChecklistByMachineOut(BaseModel):
    machine_id: str
    options: List[str]
    pages: List[ChecklistPageOut]


# ===== 단건 저장 (선택) =====

class SaveChecklistIn(BaseModel):
    machine_id: str
    option: str
    checked_steps: List[int] = Field(default_factory=list)


class SaveChecklistOut(BaseModel):
    ok: bool


# ===== 배치 저장 (권장) =====

class SaveChecklistItem(BaseModel):
    option: str
    checked_steps: List[int] = Field(default_factory=list)


class SaveChecklistBatchIn(BaseModel):
    machine_id: str
    items: List[SaveChecklistItem] = Field(default_factory=list)


class SaveChecklistBatchOut(BaseModel):
    ok: bool
    saved: int
