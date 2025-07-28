# 📁 backend/routers/equipment_move.py
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.equip_progress import EquipProgress

router = APIRouter(prefix="/equipment", tags=["equipment"])

class MoveItem(BaseModel):
    machine_id: str
    site: str
    slot_code: str

@router.post("/move", status_code=200)
def move_equipments(items: List[MoveItem], db: Session = Depends(get_db)):
    # 1) 충돌 검사
    duplicates = []
    for it in items:
        exists = (
            db.query(EquipProgress)
            .filter(
                EquipProgress.site == it.site,
                EquipProgress.slot_code == it.slot_code,
                EquipProgress.machine_id != it.machine_id,  # 본인 제외
            )
            .first()
        )
        if exists:
            duplicates.append(f"{it.site}-{it.slot_code}")

    if duplicates:
        dup_str = ', '.join(duplicates)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"다음 위치는 이미 사용 중입니다: {dup_str}",
        )

    # 2) 업데이트 실행
    for it in items:
        row = db.query(EquipProgress).filter_by(machine_id=it.machine_id).first()
        if row:
            row.site = it.site
            row.slot_code = it.slot_code
    db.commit()
    return {"moved": len(items)}
