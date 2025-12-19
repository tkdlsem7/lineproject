# backend/EquipmentInfo/routers.py
from __future__ import annotations
from fastapi import Path
from .schemas import EquipmentOptionOut
from decimal import Decimal
from datetime import date as _date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func
from sqlalchemy.orm import Session

from backend.deps import get_db
from .models import (
    EquipProgress,
    EquipmentReceiptLog,   # 입고 로그 테이블
    EquipmentOption,       # 옵션 테이블 (option_id: varchar)
)
from .schemas import EquipmentSaveRequest, EquipmentSaveResponse

router = APIRouter(
    prefix="/dashboard/equipment",
    tags=["Dashboard / EquipmentInfo"],
)

@router.get("/ping")
def ping():
    return {"ok": True, "where": "EquipmentInfo"}

# ─────────────────────────────────────────────────────────────
# 헬퍼
# ─────────────────────────────────────────────────────────────

def _normalize_status(s: Optional[str]) -> str:
    """
    항상 '가능' 또는 '불가능' 중 하나를 반환.
    - None/빈문자열/이상값 → '불가능'
    - ok/hold 등 영문도 허용해 맵핑
    """
    if s is None:
        return "불가능"
    v = s.strip().lower()
    if not v:
        return "불가능"
    if v in ("가능", "ok", "okay", "true", "yes", "avail", "available"):
        return "가능"
    if v in ("불가능", "hold", "false", "no", "unavail", "blocked", "ban"):
        return "불가능"
    return "불가능"

def _is_blank(s: Optional[str]) -> bool:
    """None 또는 공백문자열"""
    return s is None or s.strip() == ""

def _upsert_equipment_option(
    db: Session,
    machine_id: str,
    manager: str,
    option_codes_str: Optional[str],
) -> None:
    """
    equipment_option 을 machine_id 기준으로 upsert.
    option_codes_str 예: "hot, cold, t5825"
    """
    if option_codes_str is None:
        return  # 옵션이 안 넘어오면 스킵

    codes = option_codes_str.strip()  # 공백 정리(비우기 정책: 빈 문자열로 저장)

    row = (
        db.query(EquipmentOption)
        .filter(EquipmentOption.machine_id == machine_id)
        .order_by(EquipmentOption.id.desc())
        .first()
    )
    if row:
        row.option_id = codes
        row.manager = manager or ""
        row.selected_at = func.now()   # 업데이트 시각 갱신
    else:
        db.add(
            EquipmentOption(
                machine_id=machine_id,
                option_id=codes,
                manager=manager or "",
            )
        )

# ─────────────────────────────────────────────────────────────
# 메인 저장 엔드포인트
# ─────────────────────────────────────────────────────────────


@router.get("/options/{machine_id}", response_model=EquipmentOptionOut)
def get_equipment_options(machine_id: str = Path(..., min_length=1), db: Session = Depends(get_db)):
    row = (
        db.query(EquipmentOption)
        .filter(EquipmentOption.machine_id == machine_id.strip())
        .order_by(EquipmentOption.id.desc())
        .first()
    )
    if not row or not (row.option_id or "").strip():
        return EquipmentOptionOut(machine_id=machine_id, option_codes=[], option_codes_str="")
    raw = row.option_id or ""
    codes = [c.strip() for c in raw.split(",") if c.strip()]
    return EquipmentOptionOut(machine_id=machine_id, option_codes=codes, option_codes_str=raw)


@router.post("/save", response_model=EquipmentSaveResponse)
def save_equipment_info(payload: EquipmentSaveRequest, db: Session = Depends(get_db)):
    """
    장비 정보 저장(업서트)
    - 우선순위 1: machine_id 기준 UPDATE
    - 우선순위 2: (site, slot_code) 기준 UPDATE
    - 그 외: INSERT
    - 빈 슬롯을 채우는 경우(equipment_receipt_log) 입고 로그 기록
    - 옵션(equipment_option)은 machine_id 기준 upsert
    """
    # ── 입력 정규화
    machine_id = payload.machine_id.strip()
    slot_code = payload.slot_code.strip().upper()
    site = payload.site.strip() if payload.site else ""   # 로그테이블 site NOT NULL 대비
    status_norm = _normalize_status(payload.status)

    # ── 1) machine_id 기준 UPDATE (기존 장비 수정: 입고 로그 X)
    row_by_machine = (
        db.query(EquipProgress).filter(EquipProgress.machine_id == machine_id).first()
    )
    if row_by_machine:
        row_by_machine.manager = payload.manager or ""
        row_by_machine.shipping_date = payload.shipping_date
        row_by_machine.customer = payload.customer or ""
        row_by_machine.slot_code = slot_code
        row_by_machine.site = site
        row_by_machine.serial_number = payload.serial_number
        row_by_machine.status = status_norm
        row_by_machine.note = payload.note

        try:
            # 한 트랜잭션 안에서 옵션까지 반영
            db.flush()
            _upsert_equipment_option(
                db,
                machine_id=machine_id,
                manager=payload.manager or "",
                option_codes_str=payload.option_codes_str,
            )
            db.commit()
            db.refresh(row_by_machine)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"저장 실패: {e}",
            )

        return EquipmentSaveResponse(
            mode="update",
            row_no=row_by_machine.no,
            saved_option_count=0,
        )

    # ── 2) (site, slot_code) 기준 UPDATE
    row_by_slot = (
        db.query(EquipProgress)
        .filter(and_(EquipProgress.site == site, EquipProgress.slot_code == slot_code))
        .first()
    )
    if row_by_slot:
        # 이전에 빈 슬롯이었는지 판단 → 빈 슬롯을 채우면 입고 로그
        was_empty = _is_blank(row_by_slot.machine_id)

        row_by_slot.machine_id = machine_id
        row_by_slot.manager = payload.manager or ""
        row_by_slot.shipping_date = payload.shipping_date
        row_by_slot.customer = payload.customer or ""
        row_by_slot.slot_code = slot_code
        row_by_slot.site = site
        row_by_slot.serial_number = payload.serial_number
        row_by_slot.status = status_norm
        row_by_slot.note = payload.note

        # was_empty & 지금 machine_id가 있다면 입고 로그도 같이 insert
        try:
            db.flush()
            _upsert_equipment_option(
                db,
                machine_id=machine_id,
                manager=payload.manager or "",
                option_codes_str=payload.option_codes_str,
            )

            if was_empty and not _is_blank(machine_id):
                db.add(
                    EquipmentReceiptLog(
                        machine_no=machine_id,
                        manager=payload.manager or "",
                        receive_date=_date.today(),
                        site=site or "",
                        slot=slot_code,
                    )
                )

            db.commit()
            db.refresh(row_by_slot)
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"저장 실패: {e}",
            )

        return EquipmentSaveResponse(
            mode="update",
            row_no=row_by_slot.no,
            saved_option_count=0,
        )

    # ── 3) INSERT (해당 (site, slot)이 아예 없던 경우)
    new_row = EquipProgress(
        machine_id=machine_id,
        progress=Decimal("0.00"),
        manager=payload.manager or "",
        shipping_date=payload.shipping_date,
        customer=payload.customer or "",
        slot_code=slot_code,
        site=site,
        serial_number=payload.serial_number,
        status=status_norm,
        note=payload.note,
    )
    db.add(new_row)

    try:
        db.flush()

        # 옵션 upsert
        _upsert_equipment_option(
            db,
            machine_id=machine_id,
            manager=payload.manager or "",
            option_codes_str=payload.option_codes_str,
        )

        # 새로 삽입된 케이스는 입고로 간주
        db.add(
            EquipmentReceiptLog(
                machine_no=machine_id,
                manager=payload.manager or "",
                receive_date=_date.today(),
                site=site or "",
                slot=slot_code,
            )
        )

        db.commit()
        db.refresh(new_row)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"저장 실패: {e}",
        )

    return EquipmentSaveResponse(
        mode="insert",
        row_no=new_row.no,
        saved_option_count=0,
    )
