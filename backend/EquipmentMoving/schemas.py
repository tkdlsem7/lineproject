from __future__ import annotations
from typing import List, Literal, Optional, Annotated
from pydantic import BaseModel, Field

AllowedSite = Literal["본사", "진우리", "부항리"]

class EquipmentRowOut(BaseModel):
  machine_id: str
  site: str
  slot: str
  manager: Optional[str] = None
  progress: Optional[float] = None

class EquipmentListOut(BaseModel):
  site: AllowedSite
  items: List[EquipmentRowOut]

# 입력 스키마
Str20  = Annotated[str, Field(min_length=1, max_length=20, strip_whitespace=True)]
SlotStr= Annotated[str, Field(min_length=1, max_length=5,  strip_whitespace=True)]

class MoveItemIn(BaseModel):
  machine_id: Str20
  to_site: AllowedSite
  to_slot: SlotStr

class MoveBatchIn(BaseModel):
  items: List[MoveItemIn] = Field(default_factory=list)

class MoveBatchOut(BaseModel):
  ok: bool
  updated: int
  not_found: List[str] = Field(default_factory=list)


class ConflictOut(BaseModel):
    site: AllowedSite
    slot: str
    current_machine_id: str

class MoveBatchOut(BaseModel):
    ok: bool
    updated: int
    not_found: List[str] = Field(default_factory=list)
    conflicts: List[ConflictOut] = Field(default_factory=list)  # ✅ 추가
