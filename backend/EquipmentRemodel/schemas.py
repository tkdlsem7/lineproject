from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

MachineId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=50),
]

OptionName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]


class EquipmentRemodelChecklistItemSave(BaseModel):
    option_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    remodel_time_text: Optional[str] = None
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    delay_reason: Optional[str] = None
    sort_order: int = 0

    @field_validator("end_date")
    @classmethod
    def validate_end_date(cls, v, info):
        start_date = info.data.get("start_date")
        if v is not None and start_date is not None and v < start_date:
            raise ValueError("종료 일정은 시작 일정보다 빠를 수 없습니다.")
        return v


class EquipmentRemodelSaveRequest(BaseModel):
    remodel_id: Optional[int] = None

    machine_id: MachineId
    remodel_manager: Optional[str] = ""
    remodel_time_text: Optional[str] = ""
    model: Optional[str] = ""

    manager_feedback: Optional[str] = None
    delay_reason: Optional[str] = None

    result_status: Optional[Literal["정상", "부적합"]] = None
    improvement_status: Optional[Literal["need", "done"]] = None
    remodel_progress_status: Optional[Literal["planned", "completed", "io_done"]] = None

    checklist: List[EquipmentRemodelChecklistItemSave] = Field(default_factory=list)


class EquipmentRemodelSaveResponse(BaseModel):
    mode: Literal["insert", "update"]
    remodel_id: int
    checklist_count: int = 0
    message: str = "saved"


class RemodelOptionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    option_name: str


class RemodelOptionCreateRequest(BaseModel):
    option_name: OptionName


class RemodelOptionUpdateRequest(BaseModel):
    option_name: OptionName


class EquipmentRemodelChecklistItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    option_id: int
    option_name: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    remodel_time_text: Optional[str] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    delay_reason: Optional[str] = None
    sort_order: int


class EquipmentRemodelDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: str
    remodel_manager: Optional[str] = ""
    remodel_time_text: Optional[str] = ""
    model: Optional[str] = ""

    manager_feedback: Optional[str] = None
    delay_reason: Optional[str] = None

    result_status: Optional[Literal["정상", "부적합"]] = None
    improvement_status: Optional[str] = None
    remodel_progress_status: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    checklist_count: int = 0
    checklist: List[EquipmentRemodelChecklistItemOut] = Field(default_factory=list)
