"""
Pydantic v2 스키마
──────────────────────────────────────────────────────────────────
• from_attributes = True → ORM 모델 ↔ 스키마 자동 변환
"""
from datetime import date
from pydantic import BaseModel
from typing import Optional

# ▶ 클라이언트 → 서버 (POST 요청 바디)
class EquipmentLogCreate(BaseModel):
    machine_no: str

# ▶ 서버 → 클라이언트 (응답)
class EquipmentLogOut(BaseModel):
    id:            int
    machine_no:    str
    manager:       Optional[str]
    receive_date:  Optional[date]
    ship_date:     Optional[date]

    class Config:
        from_attributes = True
