# backend/MainDashboard/schemas.py
# ------------------------------------------------------------
# Pydantic v2 권장 방식:
#  - Annotated[str, StringConstraints(...)] 로 문자열 제약 정의
#  - Field(...) 는 min/max_length 가능하지만 strip_whitespace는
#    StringConstraints로 지정하는 것이 깔끔함
# ------------------------------------------------------------
from __future__ import annotations

from datetime import date
from typing import Literal, Optional, List, Annotated
from pydantic import BaseModel, Field
from pydantic import StringConstraints
from typing import List

MachineId = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20)]
SlotCode  = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=5)]
SiteStr   = Annotated[str, StringConstraints(strip_whitespace=True, max_length=30)]
SerialStr = Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)]

class EquipmentSaveRequest(BaseModel):
    machine_id: MachineId
    shipping_date: date
    manager: Optional[str] = Field(default="")
    customer: Optional[str] = Field(default="")
    slot_code: SlotCode
    site: Optional[SiteStr] = None
    serial_number: Optional[SerialStr] = None
    # ✅ '가능'/'불가능'을 기본으로 허용, 과거 'ok'/'hold'도 허용
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
    option_codes: List[str] = []        # ["hot","cold","t5825"]
    option_codes_str: str = ""          # "hot, cold, t5825"
    