from pydantic import BaseModel
from datetime import date


# 공통 스키마 (응답/요청 공통 필드 정의)
class EquipProgressBase(BaseModel):
    slot_code: str        # 슬롯 위치 (예: B6)
    machine_id: str       # 장비 ID (예: J-07-02)
    manager : str
    progress: float         # 진척도 (예: 75)
    shipping_date: date   # 출하일 (예: 2025-08-15)

    class Config:
        from_attributes = True  # ✅ Pydantic v2 호환 (이전 orm_mode = True)