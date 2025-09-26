# backend/Main/routers.py
from __future__ import annotations
from typing import Optional, List
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from ..db.database import get_db
from . import schemas
from .models import EquipProgress, EquipmentLog, EquipmentReceiptLog

router = APIRouter(prefix="/main", tags=["main"])

CAPACITY = {"A": 60, "B": 32, "I": 8}

def _count_by_prefixes(db: Session, prefixes: List[str], site: Optional[str]) -> int:
    q = db.query(func.count(EquipProgress.no))
    if site:
        q = q.filter(EquipProgress.site == site)
    cond = or_(*[EquipProgress.slot_code.ilike(f"{p}%") for p in prefixes])
    q = q.filter(cond)
    return int(q.scalar() or 0)

@router.get("/capacity", response_model=schemas.CapacityResponse)
def capacity_summary(
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    used_A = _count_by_prefixes(db, ["a", "b", "c", "d", "e", "f"], site)
    used_B = _count_by_prefixes(db, ["g", "h"], site)
    used_I = _count_by_prefixes(db, ["i"], site)

    return {
        "A": {"used": used_A, "capacity": CAPACITY["A"], "remaining": max(CAPACITY["A"] - used_A, 0)},
        "B": {"used": used_B, "capacity": CAPACITY["B"], "remaining": max(CAPACITY["B"] - used_B, 0)},
        "I": {"used": used_I, "capacity": CAPACITY["I"], "remaining": max(CAPACITY["I"] - used_I, 0)},
    }

# ✅ 오늘/3일 이내 출하 요약 (shipping_date 기준, 오늘 포함 3일)
@router.get("/ship-summary", response_model=schemas.ShipSummary)
def ship_summary(
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    today = date.today()
    end = today + timedelta(days=3)

    q1 = db.query(func.count(EquipProgress.no))
    if site:
        q1 = q1.filter(EquipProgress.site == site)
    today_count = int(q1.filter(EquipProgress.shipping_date == today).scalar() or 0)

    q2 = db.query(func.count(EquipProgress.no))
    if site:
        q2 = q2.filter(EquipProgress.site == site)
    within3_count = int(q2.filter(EquipProgress.shipping_date.between(today, end)).scalar() or 0)

    return {"today": today_count, "within3": within3_count}

# ✅ 오늘 입고 수 (equipment_receipt_log.receive_date == today)
@router.get("/receipt-summary", response_model=schemas.ReceiptSummary)
def receipt_summary(
    site: str | None = Query(None, description="사이트 필터(예: 본사). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    today = date.today()
    q = db.query(func.count(EquipmentReceiptLog.id)).filter(
        EquipmentReceiptLog.receive_date == today
    )
    if site:
        q = q.filter(EquipmentReceiptLog.site == site)
    cnt = int(q.scalar() or 0)
    return {"today": cnt}
