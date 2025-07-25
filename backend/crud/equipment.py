from __future__ import annotations
from typing import List, Optional

from sqlalchemy.orm import Session
from sqlalchemy.exc  import SQLAlchemyError, IntegrityError
from sqlalchemy      import func

from backend.models.equipment   import Equipment
from backend.schemas.equipment  import EquipmentIn

# ───────────────────────────────────────────────
# READ
# ───────────────────────────────────────────────
def get_equipment_by_machine(
    db: Session,
    machine_id: str,
    site: str | None = None,          # ★ site 파라미터
) -> Optional[Equipment]:
    """
    machine_id 로 1행 조회
    • site 가 주어지면 동일 site 행만 찾는다.
      (대소문자 무시가 필요하면 func.lower 적용)
    """
    query = db.query(Equipment).filter(Equipment.machine_id == machine_id)
    if site:
        query = query.filter(Equipment.site == site)
        # 대소문자 무시는 ↓ 이런 식으로
        # query = query.filter(func.lower(Equipment.site) == site.lower())

    return query.first()


def get_all_equipment(db: Session, site: str | None = None) -> List[Equipment]:
    query = db.query(Equipment)
    if site:
        query = query.filter(Equipment.site == site)
    return query.order_by(Equipment.no.asc()).all()


# ───────────────────────────────────────────────
# CREATE / UPDATE / UPSERT
# ───────────────────────────────────────────────
def upsert_equipment(db: Session, data: EquipmentIn) -> Equipment:
    """
    machine_id + site 기준 UPSERT
    • 존재 → UPDATE
    • 미존재 → INSERT
    """
    equip = get_equipment_by_machine(db, data.machine_id, data.site)

    try:
        if equip is None:  # INSERT
            equip = Equipment(
                machine_id = data.machine_id,
                slot_code  = data.slot_code,
                site       = data.site,         # ★ INSERT 시 site 고정
            )
            db.add(equip)

        # 공통 필드 업데이트 (INSERT / UPDATE 공통)
        equip.progress       = data.progress
        equip.shipping_date  = data.shipping_date
        equip.customer       = data.customer
        equip.manager        = data.manager
        equip.note           = data.note
        equip.slot_code      = data.slot_code
        equip.site           = data.site        # ★ UPDATE 시에도 site 반영

        db.commit()
        db.refresh(equip)
        return equip

    except IntegrityError:
        db.rollback()
        raise
    except SQLAlchemyError:
        db.rollback()
        raise


# ───────────────────────────────────────────────
# DELETE (옵션)
# ───────────────────────────────────────────────
def delete_equipment(db: Session, machine_id: str, site: str | None = None) -> None:
    equip = get_equipment_by_machine(db, machine_id, site)
    if equip:
        db.delete(equip)
        db.commit()
