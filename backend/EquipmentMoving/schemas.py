from __future__ import annotations
from typing import List, Literal, Optional, Annotated
from pydantic import BaseModel, Field

# 사이트 리터럴
AllowedSite = Literal["본사", "진우리", "부항리"]

# ─────────────────────────────────────────────────────────────
# 장비 목록 응답
# ─────────────────────────────────────────────────────────────
class EquipmentRowOut(BaseModel):
    machine_id: str
    site: str
    slot: str
    manager: Optional[str] = None
    progress: Optional[float] = None

class EquipmentListOut(BaseModel):
    site: AllowedSite
    items: List[EquipmentRowOut]

# ─────────────────────────────────────────────────────────────
# 이동 요청/응답
# ─────────────────────────────────────────────────────────────
Str20   = Annotated[str,  Field(min_length=1, max_length=20, strip_whitespace=True)]
# to_slot에 'G-01' ~ 'D-11-06' 등도 대비해서 여유 있게 10으로 설정
SlotStr = Annotated[str,  Field(min_length=1, max_length=10, strip_whitespace=True)]

class MoveItemIn(BaseModel):
    machine_id: Str20
    to_site: AllowedSite
    to_slot: SlotStr

class MoveBatchIn(BaseModel):
    items: List[MoveItemIn] = Field(default_factory=list)

class ConflictOut(BaseModel):
    site: AllowedSite
    slot: str
    current_machine_id: str

class MoveBatchOut(BaseModel):
    ok: bool
    updated: int
    not_found: List[str] = Field(default_factory=list)
    conflicts: List[ConflictOut] = Field(default_factory=list)

# ─────────────────────────────────────────────────────────────
# 붙여넣기(메신저) 파서 스키마
# ─────────────────────────────────────────────────────────────
class PasteParseIn(BaseModel):
    text: str = Field(min_length=1, description="메신저에서 복붙한 원문")

class PasteParsedRow(BaseModel):
    from_site: AllowedSite
    from_slot: str
    to_site: AllowedSite
    to_slot: str
    machine_id: Optional[str] = None
    status: Literal["ok", "not_found", "conflict"]

class PasteParseOut(BaseModel):
    items: List[PasteParsedRow] = Field(default_factory=list)
    ok_count: int = 0
    not_found_count: int = 0
    conflict_count: int = 0

class PasteParseIn(BaseModel):
    text: str = Field(min_length=1, description="메신저에서 복붙한 원문")

class PasteParsedRow(BaseModel):
    from_site: "AllowedSite"   # 기존 AllowedSite 그대로 사용
    from_slot: str
    to_site: "AllowedSite"
    to_slot: str
    machine_id: Optional[str] = None
    status: Literal["ok", "not_found", "conflict"]

class PasteParseOut(BaseModel):
    items: List[PasteParsedRow] = []
    ok_count: int = 0
    not_found_count: int = 0
    conflict_count: int = 0