# 📁 backend/crud/equipment.py
from __future__ import annotations

from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError, IntegrityError

from backend.models.equipment import Equipment
from backend.schemas.equipment import EquipmentIn

# ───────────────────────────────────────────────
# READ
# ───────────────────────────────────────────────
def get_equipment_by_machine(
    db: Session,
    machine_id: str,
) -> Optional[Equipment]:
    """machine_id 로 1행 조회"""
    return (
        db.query(Equipment)
        .filter(Equipment.machine_id == machine_id)
        .first()
    )

def get_all_equipment(db: Session) -> List[Equipment]:
    # 모델 PK 컬럼은 `no`
    return db.query(Equipment).order_by(Equipment.no.asc()).all()   # ← 수정


# ───────────────────────────────────────────────
# CREATE / UPDATE / UPSERT
# ───────────────────────────────────────────────
def upsert_equipment(db: Session, data: EquipmentIn) -> Equipment:
    """
    machine_id 기준 UPSERT
    • 존재 시  → UPDATE
    • 미존재 시 → INSERT
    """
    equip = get_equipment_by_machine(db, data.machine_id)          # ← 수정 (snake_case)

    try:
        if equip is None:                                          # INSERT
            equip = Equipment(
                machine_id = data.machine_id,                      # ← 수정
                slot_code  = data.slot_code,                       # ← 추가
            )
            db.add(equip)

        # 공통 업데이트 필드
        equip.progress      = data.progress
        equip.shipping_date = data.shipping_date                   # ← 수정
        equip.customer      = data.customer
        equip.manager       = data.manager
        equip.note          = data.note
        equip.slot_code     = data.slot_code                       # ← 추가 (UPDATE 시에도 유지)

        print("[UPSERT PAYLOAD]", data.model_dump())

        db.commit()
        db.refresh(equip)
        return equip

    except IntegrityError as ie:
        db.rollback()
        # machine_id, slot_code 중복 등 제약 위반 메시지를 클라이언트에 전달하고 싶다면
        raise
    except SQLAlchemyError:
        db.rollback()
        raise


# ───────────────────────────────────────────────
# DELETE (선택)
# ───────────────────────────────────────────────
def delete_equipment(db: Session, machine_id: str) -> None:
    equip = get_equipment_by_machine(db, machine_id)
    if equip:
        db.delete(equip)
        db.commit()
