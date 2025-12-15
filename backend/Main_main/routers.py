# backend/Main/routers.py
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional, List, Dict, Tuple

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.db.database import get_db
from . import schemas
from .models import EquipProgress, EquipmentReceiptLog

router = APIRouter(prefix="/main", tags=["main"])

# 자리 수 (고정)
CAPACITY = {"A": 60, "B": 32, "I": 8}

# slot_code → 동(A/B/I) 프리픽스
BUILDING_PREFIXES: Dict[str, List[str]] = {
    "A": ["a", "b", "c", "d", "e", "f"],
    "B": ["g", "h"],
    "I": ["i"],
}

# machine_id 앞(prefix) → 모델명 매핑 (대소문자 무시)
MODEL_PREFIX_MAP: Dict[str, str] = {
    "f": "FD",
    "c": "SC",
    "d(e)": "SD(e)",
    "e(e)": "SE(e)",
    "h(e)": "SH(e)",
    "t(e)": "SLT(e)",
    "p": "SP",
    "i": "ST(e)",
    "j": "STP(e)",
}

# ─────────────────────────────────────────────────────────────
# (schemas에 EquipSummaryResponse가 없을 때도 서버가 안 죽도록)
# ─────────────────────────────────────────────────────────────
class _EquipSummaryItem(BaseModel):
    name: str
    status_counts: Dict[str, int] = Field(default_factory=dict)
    model_counts: Dict[str, int] = Field(default_factory=dict)


class _EquipSummaryResponse(BaseModel):
    buildings: List[_EquipSummaryItem]
    sites: List[_EquipSummaryItem]


EquipSummaryResponseModel = getattr(schemas, "EquipSummaryResponse", _EquipSummaryResponse)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────
def _count_by_prefixes(db: Session, prefixes: List[str], site: Optional[str]) -> int:
    q = db.query(func.count(EquipProgress.no))
    if site:
        q = q.filter(EquipProgress.site == site)
    cond = or_(*[EquipProgress.slot_code.ilike(f"{p}%") for p in prefixes])
    q = q.filter(cond)
    return int(q.scalar() or 0)


def _fetch_rows_for_slot_prefixes(
    db: Session, prefixes: List[str], site: Optional[str]
) -> List[Tuple[Optional[str], Optional[float]]]:
    q = db.query(EquipProgress.machine_id, EquipProgress.progress)
    if site:
        q = q.filter(EquipProgress.site == site)
    cond = or_(*[EquipProgress.slot_code.ilike(f"{p}%") for p in prefixes])
    q = q.filter(cond)
    return list(q.all())


def _fetch_rows_for_site(
    db: Session, site: str
) -> List[Tuple[Optional[str], Optional[float]]]:
    return list(
        db.query(EquipProgress.machine_id, EquipProgress.progress)
        .filter(EquipProgress.site == site)
        .all()
    )


def _aggregate_rows(
    rows: List[Tuple[Optional[str], Optional[float]]]
) -> Dict[str, Dict[str, int]]:
    status_counts: Dict[str, int] = {}
    model_counts: Dict[str, int] = {}

    for machine_id, progress in rows:
        # 상태
        try:
            p = float(progress or 0)
        except Exception:
            p = 0.0

        if p <= 0:
            status = "waiting"        # 생산 대기
        elif p >= 100:
            status = "done"           # 생산 완료
        else:
            status = "processing"     # 생산 중
        status_counts[status] = status_counts.get(status, 0) + 1

        # 모델
        if machine_id:
            prefix_raw = (machine_id.split("-")[0] or "").strip()
            key = prefix_raw.lower()
            label = MODEL_PREFIX_MAP.get(key, prefix_raw)
            model_counts[label] = model_counts.get(label, 0) + 1

    # 0개 항목 제거(보기 깔끔)
    status_counts = {k: v for k, v in status_counts.items() if v > 0}
    model_counts = {k: v for k, v in model_counts.items() if v > 0}

    return {"status_counts": status_counts, "model_counts": model_counts}


# ─────────────────────────────────────────────────────────────
# APIs
# ─────────────────────────────────────────────────────────────
@router.get("/capacity", response_model=schemas.CapacityResponse)
def capacity_summary(
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    used_A = _count_by_prefixes(db, BUILDING_PREFIXES["A"], site)
    used_B = _count_by_prefixes(db, BUILDING_PREFIXES["B"], site)
    used_I = _count_by_prefixes(db, BUILDING_PREFIXES["I"], site)

    return {
        "A": {"used": used_A, "capacity": CAPACITY["A"], "remaining": max(CAPACITY["A"] - used_A, 0)},
        "B": {"used": used_B, "capacity": CAPACITY["B"], "remaining": max(CAPACITY["B"] - used_B, 0)},
        "I": {"used": used_I, "capacity": CAPACITY["I"], "remaining": max(CAPACITY["I"] - used_I, 0)},
    }


# ✅ 동별/사이트별 생산 상태 + 모델 요약
@router.get("/equip-summary", response_model=EquipSummaryResponseModel)
def equip_summary(
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사/진우리). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    # 동별(buildings): slot_code 기준
    rows_A = _fetch_rows_for_slot_prefixes(db, BUILDING_PREFIXES["A"], site)
    rows_B = _fetch_rows_for_slot_prefixes(db, BUILDING_PREFIXES["B"], site)
    rows_I = _fetch_rows_for_slot_prefixes(db, BUILDING_PREFIXES["I"], site)

    buildings = [
        {"name": "A동", **_aggregate_rows(rows_A)},
        {"name": "B동", **_aggregate_rows(rows_B)},
        {"name": "I라인", **_aggregate_rows(rows_I)},
    ]

    # 사이트별(sites): site 기준
    if site:
        site_names = [site]
    else:
        site_names = [
            s for (s,) in db.query(EquipProgress.site)
            .filter(EquipProgress.site.isnot(None))
            .distinct()
            .order_by(EquipProgress.site)
            .all()
            if s
        ]
        if not site_names:
            site_names = ["본사", "진우리"]

    sites = []
    for s in site_names:
        rows = _fetch_rows_for_site(db, s)
        sites.append({"name": s, **_aggregate_rows(rows)})

    return {"buildings": buildings, "sites": sites}


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
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사). 미지정 시 전체"),
    db: Session = Depends(get_db),
):
    today = date.today()
    q = db.query(func.count(EquipmentReceiptLog.id)).filter(EquipmentReceiptLog.receive_date == today)
    if site:
        q = q.filter(EquipmentReceiptLog.site == site)
    return {"today": int(q.scalar() or 0)}


# ─────────────────────────────────────────────────────────────
# 메인 하단 표 3개용 목록 API
# 반환: schemas.RowBrief (machine_id, manager, slot_code)
# ─────────────────────────────────────────────────────────────
@router.get("/receipt-today-rows", response_model=List[schemas.RowBrief])
def receipt_today_rows(
    site: Optional[str] = Query(None, description="사이트 필터(예: 본사)"),
    limit: int = Query(10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    today = date.today()

    q = (
        db.query(
            EquipmentReceiptLog.machine_no,
            EquipmentReceiptLog.manager,
            EquipmentReceiptLog.slot,
        )
        .filter(EquipmentReceiptLog.receive_date == today)
    )

    if site:
        q = q.filter(EquipmentReceiptLog.site == site)

    rows = (
        q.order_by(EquipmentReceiptLog.receive_date.desc(), EquipmentReceiptLog.id.desc())
        .limit(limit)
        .all()
    )

    return [{"machine_id": r[0], "manager": r[1], "slot_code": r[2]} for r in rows]


@router.get("/ship-today-rows", response_model=List[schemas.RowBrief])
def ship_today_rows(
    site: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    today = date.today()

    q = (
        db.query(EquipProgress.machine_id, EquipProgress.manager, EquipProgress.slot_code)
        .filter(EquipProgress.shipping_date == today)
    )
    if site:
        q = q.filter(EquipProgress.site == site)

    rows = (
        q.order_by(EquipProgress.shipping_date.desc(), EquipProgress.no.desc())
        .limit(limit)
        .all()
    )
    return [{"machine_id": r[0], "manager": r[1], "slot_code": r[2]} for r in rows]


@router.get("/ship-within3-rows", response_model=List[schemas.RowBrief])
def ship_within3_rows(
    site: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=200),
    db: Session = Depends(get_db),
):
    today = date.today()
    end = today + timedelta(days=3)

    q = (
        db.query(EquipProgress.machine_id, EquipProgress.manager, EquipProgress.slot_code)
        .filter(EquipProgress.shipping_date.between(today, end))
    )
    if site:
        q = q.filter(EquipProgress.site == site)

    rows = (
        q.order_by(EquipProgress.shipping_date.desc(), EquipProgress.no.desc())
        .limit(limit)
        .all()
    )
    return [{"machine_id": r[0], "manager": r[1], "slot_code": r[2]} for r in rows]
