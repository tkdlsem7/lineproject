# ------------------------------------------------------------
# Dashboard/routers.py
# ------------------------------------------------------------
from __future__ import annotations
from datetime import date as _date
from typing import List, Iterable
import re

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.deps import get_db
from .models import (
    EquipProgress,
    EquipmentLog,
    EquipmentMoveLog,
    EquipmentShipmentLog,
)
from .schemas import SlotOut, MoveRequest, OK

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

# --- A/B/I 매핑(확장 가능) ---
BUILDING_PREFIX = {
    "A": tuple("ABCDEF"),
    "B": tuple("GHIJKL"),   # 실제 환경에 맞게 수정
    "I": tuple("I"),        # 실제 환경에 맞게 수정
}

def _is_empty(machine_id: str | None) -> bool:
    return (machine_id or "").strip() == ""

def _sort_key(slot_code: str) -> tuple[str, int]:
    m = re.match(r"^([A-Za-z])\s*0*([0-9]+)$", slot_code or "")
    if not m:
        return ("Z", 9999)
    return (m.group(1).upper(), int(m.group(2)))


@router.get("/slots", response_model=List[SlotOut])
def list_slots(
    db: Session = Depends(get_db),
    site: str = Query("본사", description="사이트명(본사/부항리/진우리)"),
    building: str = Query("A", description="건물/라인 그룹: A|B|I"),
    limit: int = Query(1000, ge=1, le=5000),
    offset: int = Query(0, ge=0),
):
    b = building.upper()
    if b not in BUILDING_PREFIX:
        raise HTTPException(status_code=400, detail="지원하지 않는 building 입니다.")

    prefixes: Iterable[str] = BUILDING_PREFIX[b]

    stmt = (
        select(EquipProgress)
        .where(EquipProgress.site == site)
        .where(or_(*[EquipProgress.slot_code.ilike(f"{p}%") for p in prefixes]))
        .limit(limit)
        .offset(offset)
    )
    rows: list[EquipProgress] = list(db.execute(stmt).scalars().all())
    rows.sort(key=lambda r: _sort_key(r.slot_code))

    return [
        SlotOut(
            id=r.slot_code,
            slot_code=r.slot_code,
            machine_id=r.machine_id or None,
            progress=float(r.progress or 0),
            shipping_date=r.shipping_date,
            manager=r.manager,
            site=r.site,
            customer=getattr(r, "customer", None),
            serial_number=getattr(r, "serial_number", None),
            note=getattr(r, "note", None),
            status=getattr(r, "status", None),
        )
        for r in rows
    ]



@router.post("/ship/{slot_code}", response_model=OK, status_code=status.HTTP_200_OK)
def ship_equipment(
    slot_code: str = Path(..., min_length=2, max_length=5, description="원본 슬롯 코드 (예: A7)"),
    db: Session = Depends(get_db),
):
    # 1) 슬롯 조회 & 검증
    row: EquipProgress | None = (
        db.query(EquipProgress).filter(EquipProgress.slot_code == slot_code).first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다.")
    if not row.machine_id or not row.machine_id.strip():
        raise HTTPException(status_code=400, detail="빈 슬롯은 출하 처리할 수 없습니다.")
    if (row.status or "").strip() != "가능" :
        raise HTTPException(status_code=400, detail='status가 "가능일 때만 출하 가능합니다')

    # 2) 출하 로그 INSERT  (컬럼명이 machine_no인 스키마라면 속성명도 machine_no로)
    db.add(
        EquipmentShipmentLog(
            machine_no = row.machine_id.strip(),
            manager = (row.manager or "미지정").strip(),
            shipped_date = _date.today(),
            site = row.site.strip(),
            slot = row.slot_code.strip(),
            customer = (row.customer or "미지정").strip(),
            progress = (row.progress or 0),
            serial_number = (row.serial_number or "").strip(),
        )
    )

    # 3) 일반 액션 로그
    db.add(EquipmentLog(action="SHIP", slot_code=row.slot_code, machine_id=row.machine_id))

    # 4) 슬롯 레코드 자체를 삭제 → 제약 위반 위험 없음
    db.delete(row)

    # 5) 확정 반영
    db.commit()

    return OK()


@router.post("/move/{slot_code}", response_model=OK, status_code=status.HTTP_200_OK)
def move_equipment(
    slot_code: str = Path(..., min_length=2, max_length=5, description="원본 슬롯 코드 (예: A7)"),
    payload: MoveRequest = ...,
    db: Session = Depends(get_db),
):
    """
    장비 이동
    - 조건: 원본 슬롯에 장비가 있어야 함 + 대상 슬롯은 비어 있어야 함
    - 동작: 대상 복사 → 원본 초기화 → 이동 로그 → 커밋
    """
    src: EquipProgress | None = (
        db.query(EquipProgress).filter(EquipProgress.slot_code == slot_code).first()
    )
    if not src:
        raise HTTPException(status_code=404, detail="원본 슬롯을 찾을 수 없습니다.")
    if _is_empty(src.machine_id):
        raise HTTPException(status_code=400, detail="원본 슬롯이 비어 있습니다.")

    dst: EquipProgress | None = (
        db.query(EquipProgress).filter(EquipProgress.slot_code == payload.dst_slot_code).first()
    )
    if not dst:
        raise HTTPException(status_code=404, detail="대상 슬롯을 찾을 수 없습니다.")
    if not _is_empty(dst.machine_id):
        raise HTTPException(status_code=400, detail="대상 슬롯이 비어있지 않습니다.")

    # 이동: 대상에 정보 복사
    dst.machine_id = src.machine_id
    dst.manager = src.manager
    dst.progress = src.progress
    dst.shipping_date = src.shipping_date
    if hasattr(dst, "customer") and hasattr(src, "customer"):
        dst.customer = getattr(src, "customer", None)
    if hasattr(dst, "serial_number") and hasattr(src, "serial_number"):
        dst.serial_number = getattr(src, "serial_number", None)
    if hasattr(dst, "note") and hasattr(src, "note"):
        dst.note = getattr(src, "note", None)
    if hasattr(dst, "status") and hasattr(src, "status"):
        dst.status = getattr(src, "status", None)

    # 원본 초기화
    src.machine_id = None
    src.manager = None
    src.progress = 0
    src.shipping_date = None
    if hasattr(src, "customer"):      src.customer = None
    if hasattr(src, "serial_number"): src.serial_number = None
    if hasattr(src, "note"):          src.note = None
    if hasattr(src, "status"):        src.status = None

    # 이동 로그 (모델 속성명 일치: from_slot / to_slot / machine_id)
    db.add(
        EquipmentMoveLog(
            from_slot=src.slot_code,
            to_slot=dst.slot_code,
            machine_id=dst.machine_id,
        )
    )

    db.commit()
    return OK()
