# backend/EquipmentInfo/schemas.py
from __future__ import annotations

from datetime import date
from typing import Literal, Optional, List, Annotated

from pydantic import BaseModel, Field, StringConstraints

MachineId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
SlotCode  = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=10)]
SiteStr   = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]
SerialStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]


class EquipmentSaveRequest(BaseModel):
    machine_id: MachineId
    shipping_date: Optional[date] = None

    # 사용자가 지정한 입고일(미입력 시 백엔드에서 오늘 날짜로 처리)
    receive_date: Optional[date] = None

    manager: Optional[str] = Field(default="")
    customer: Optional[str] = Field(default="")
    slot_code: SlotCode
    site: Optional[SiteStr] = None

    serial_number: Optional[SerialStr] = None
    chiller_serial_number: Optional[SerialStr] = None

    status: Optional[Literal["가능", "불가능", "ok", "hold"]] = "불가능"
    note: Optional[str] = None

    option_ids: Optional[List[int]] = None
    replace_options: Optional[bool] = None
    option_codes_str: Optional[str] = None


class EquipmentSaveResponse(BaseModel):
    mode: Literal["insert", "update"]
    row_no: int
    saved_option_count: int = 0


class EquipmentOptionOut(BaseModel):
    machine_id: str
    option_codes: List[str] = []
    option_codes_str: str = ""


class EquipmentReceiptDateOut(BaseModel):
    receive_date: Optional[date] = None


class EquipmentDetailOut(BaseModel):
    row_no: int
    machine_id: Optional[str] = None
    shipping_date: Optional[date] = None
    receive_date: Optional[date] = None

    manager: str = ""
    customer: str = ""
    slot_code: str
    site: Optional[str] = None

    serial_number: Optional[str] = None
    chiller_serial_number: Optional[str] = None

    status: Optional[str] = None
    note: Optional[str] = None

    # 디버깅용(프론트는 무시 가능)
    found_by: Optional[str] = None


class EquipmentSyncInfoOut(BaseModel):
    """
    호기 번호 기준으로 다른 동기화 테이블에서 긁어모은 데이터.
    - serial_number       : equipment_master.stage_sn
    - chiller_serial_number : setup_sheet_all.chiller_sn (가장 최근)
    - shipping_date       : schedule_events 의 "출하요청" 이벤트 중 가장 최근 event_date
    - manager             : equipment_master.manager
    - customer            : equipment_master.customer_name
    """
    machine_id: str
    serial_number: Optional[str] = None
    chiller_serial_number: Optional[str] = None
    shipping_date: Optional[date] = None
    manager: Optional[str] = None
    customer: Optional[str] = None
    # 어떤 컬럼들이 실제로 채워졌는지(프론트 UX 메세지용)
    filled_fields: list[str] = []
    not_found: bool = False
