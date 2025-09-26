# backend/Main/schemas.py
from __future__ import annotations
from pydantic import BaseModel

class BuildingCapacity(BaseModel):
    used: int
    capacity: int
    remaining: int

class CapacityResponse(BaseModel):
    A: BuildingCapacity
    B: BuildingCapacity
    I: BuildingCapacity

class ShipSummary(BaseModel):
    today: int       # 오늘 출하 개수 (shipping_date == today)
    within3: int     # 오늘 포함 3일 이내 출하 개수 (today ~ today+3)

# ✅ 오늘 입고 요약
class ReceiptSummary(BaseModel):
    today: int