# 📁 backend/routers/equipment_log.py
from datetime import date
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from backend.db.database          import get_db
from backend.models.equip_progress import EquipProgress
from backend.models.equipment_log  import EquipmentLog
from backend.schemas.equipment_log import EquipmentLogOut
from pydantic import BaseModel       # ← 새로 추가

router = APIRouter(
    prefix="/equipment_log",
    tags=["equipment_log"],
)

class EquipmentInput(BaseModel):
    machine_no: str
    manager:    str | None = None



# ───────────────────────────────────────────────────────────
# ▶ POST /equipment_log/{machine_no}/ship
#    - 요청 : URL path 로 machine_no
#    - 동작 : manager 조회 → INSERT ONLY
#    - 응답 : 방금 저장된 레코드
# ───────────────────────────────────────────────────────────
@router.post(
    "/{machine_no}/ship",
    response_model=EquipmentLogOut,
    status_code=status.HTTP_201_CREATED,
)
def ship_equipment(machine_no: str, db: Session = Depends(get_db)):
    """
    • equip_progress 에 등록된 담당자(manager) 찾음
      → 없으면 None 으로 두고 그대로 진행
    • equipment_log 테이블에 새 레코드 INSERT
      - receive_date = NULL
      - ship_date    = 오늘 날짜
    """
    ep = (
        db.query(EquipProgress)
          .filter(EquipProgress.machine_id == machine_no)
          .first()
    )
    manager_name = ep.manager if ep else None   # 담당자 없으면 NULL

    new_log = EquipmentLog(
        machine_no   = machine_no,
        manager      = manager_name,
        receive_date = None,
        ship_date    = date.today(),
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log


@router.post(
    "/input",
    summary="장비 입고 처리",
    response_model=EquipmentLogOut,
    status_code=status.HTTP_201_CREATED,
)
def input_equipment(payload: EquipmentInput, db: Session = Depends(get_db)):
    """
    1) payload.manager 가 있으면 그대로 사용,
       없으면 equip_progress 에서 manager 조회 (없으면 NULL).
    2) equipment_log 테이블에 INSERT
       - receive_date = 오늘
       - ship_date    = NULL
    """
    # ① manager 결정
    manager_name = payload.manager
    if manager_name is None:
        ep = (
            db.query(EquipProgress)
              .filter(EquipProgress.machine_id == payload.machine_no)
              .first()
        )
        manager_name = ep.manager if ep else None

    # ② INSERT
    new_log = EquipmentLog(
        machine_no   = payload.machine_no,
        manager      = manager_name,
        receive_date = date.today(),
        ship_date    = None,
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)
    return new_log