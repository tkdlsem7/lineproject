# ---------------------------------------------------------------
# 장비 API 라우터 (/api/equipment)
#   • POST /api/equipment               : UPSERT
#   • GET  /api/equipment/{machine_id}  : 단일 장비 조회 (site 필터 지원)
# ---------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.db.database         import get_db
from backend.schemas.equipment   import EquipmentIn, EquipmentOut
from backend.crud.equipment      import (
    upsert_equipment,
    get_equipment_by_machine,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])

# ──────────────────────────────────────────────────────────────
# POST: 신규 / 수정 (UPSERT)
# ──────────────────────────────────────────────────────────────
@router.post("/", response_model=EquipmentOut)
def create_or_update_equipment(
    payload: EquipmentIn,
    db: Session = Depends(get_db),
):
    """
    • payload.site 까지 포함해 INSERT / UPDATE
    """
    return upsert_equipment(db, payload)


# ──────────────────────────────────────────────────────────────
# GET: machine_id + (선택) site 로 단일 조회
# ──────────────────────────────────────────────────────────────
@router.get("/{machine_id}", response_model=EquipmentOut)
def read_equipment(
    machine_id: str,
    site: str | None = Query(
        default=None,
        description="본사 / 부항리 / 진우리 중 하나 (생략 시 모든 site 중 검색)",
        examples={"본사": {"summary": "본사 장비 조회", "value": "본사"}},
    ),
    db: Session = Depends(get_db),
):
    equip = get_equipment_by_machine(db, machine_id, site)
    if equip is None:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다.")
    return equip
