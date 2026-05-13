from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field, StringConstraints
from typing_extensions import Annotated


OptionName = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=200),
]

MachineId = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=100),
]


class RemodelLogOptionFilterOut(BaseModel):
    id: int
    option_name: str


class EquipmentRemodelLogFilterOptionsOut(BaseModel):
    models: List[str] = Field(default_factory=list)
    managers: List[str] = Field(default_factory=list)
    options: List[RemodelLogOptionFilterOut] = Field(default_factory=list)
    min_date: Optional[str] = None
    max_date: Optional[str] = None


class EquipmentRemodelLogAppliedFiltersOut(BaseModel):
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    model: Optional[str] = None
    manager: Optional[str] = None
    option_id: Optional[int] = None


class ModelOptionTimeLogRowOut(BaseModel):
    model: str
    option_name: str
    item_count: int
    time_input_count: int
    avg_minutes: Optional[int] = None
    avg_time_text: str = "-"
    min_time_text: str = "-"
    max_time_text: str = "-"


class ResultSummaryOverallOut(BaseModel):
    total_jobs: int
    defect_jobs: int
    defect_rate: float


class ResultSummaryByManagerOut(BaseModel):
    remodel_manager: str
    total_jobs: int
    defect_jobs: int
    defect_rate: float


class MonthlyModelOptionCountOut(BaseModel):
    month: str
    model: str
    option_name: str
    item_count: int


class EquipmentRemodelLogDashboardOut(BaseModel):
    applied_filters: EquipmentRemodelLogAppliedFiltersOut
    model_option_times: List[ModelOptionTimeLogRowOut] = Field(default_factory=list)
    result_summary_overall: ResultSummaryOverallOut
    result_summary_by_manager: List[ResultSummaryByManagerOut] = Field(default_factory=list)
    monthly_model_option_counts: List[MonthlyModelOptionCountOut] = Field(default_factory=list)


class EquipmentRemodelManageChecklistItemOut(BaseModel):
    id: int
    option_id: int
    option_name: str
    remodel_time_text: Optional[str] = None
    delay_reason: Optional[str] = None
    sort_order: int = 0


class EquipmentRemodelManageListItemOut(BaseModel):
    id: int
    machine_id: str
    remodel_manager: Optional[str] = None
    model: Optional[str] = None
    manager_feedback: Optional[str] = None
    delay_reason: Optional[str] = None
    option_names: List[str] = Field(default_factory=list)
    option_summary: str = ""
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class EquipmentRemodelManageListOut(BaseModel):
    total_count: int
    items: List[EquipmentRemodelManageListItemOut] = Field(default_factory=list)


class EquipmentRemodelManageDetailOut(BaseModel):
    id: int
    machine_id: str
    remodel_manager: Optional[str] = None
    model: Optional[str] = None
    manager_feedback: Optional[str] = None
    delay_reason: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    checklist: List[EquipmentRemodelManageChecklistItemOut] = Field(default_factory=list)


class EquipmentRemodelManageChecklistItemUpdateIn(BaseModel):
    id: Optional[int] = None
    option_id: int
    remodel_time_text: Optional[str] = None
    delay_reason: Optional[str] = None
    sort_order: int = 0


class EquipmentRemodelManageUpdateRequest(BaseModel):
    machine_id: MachineId
    remodel_manager: Optional[str] = ""
    manager_feedback: Optional[str] = None
    delay_reason: Optional[str] = None
    checklist: List[EquipmentRemodelManageChecklistItemUpdateIn] = Field(default_factory=list)


class EquipmentRemodelManageMessageOut(BaseModel):
    message: str
    remodel_id: int
