# ---------------------------------------------------------------
# 장비 API 라우터
#   • POST /api/equipment            : 신규 생성 or 업데이트(UPSERT)
#   • GET  /api/equipment/{machine_id} : machine_id 기준 단일 장비 조회
# ---------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.db.database import get_db                     # DB 세션 의존성
from backend.schemas.equipment import EquipmentIn, EquipmentOut
from backend.crud.equipment import (
    upsert_equipment,
    get_equipment_by_machine,          # ← 변경: 새 CRUD 함수명
)

# ────────────────────────────────────────────────────────────────
router = APIRouter(prefix="/equipment", tags=["equipment"])
# ────────────────────────────────────────────────────────────────


# ▶ POST /api/equipment  (신규/수정 공용)
@router.post("/", response_model=EquipmentOut)
def create_or_update_equipment(
    payload: EquipmentIn,
    db: Session = Depends(get_db),
):
    """
    Pydantic 스키마(EquipmentIn)로 검증된 데이터를 받아
    존재하면 UPDATE, 없으면 INSERT 후 결과(EquipmentOut) 반환
    """
    return upsert_equipment(db, payload)


# ▶ GET /api/equipment/{machine_id}  (폼 최초 진입 시 값 미리 채우기)
@router.get("/{machine_id}", response_model=EquipmentOut)
def read_equipment(
    machine_id: str,
    db: Session = Depends(get_db),
):
    """
    machine_id 로 장비 1건 조회
    없으면 404 반환
    """
    equip = get_equipment_by_machine(db, machine_id)  # ← 변경: 올바른 함수 호출
    if equip is None:
        raise HTTPException(status_code=404, detail="장비를 찾을 수 없습니다.")
    return equip

# (추후 필요 시 read_all_equipment, delete_equipment 등 추가)
