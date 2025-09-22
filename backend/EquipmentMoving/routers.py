from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import asc

from ..db.database import get_db
from ..MainDashboard.models import EquipProgress, EquipmentMoveLog   # ✅ 기존 모델 재사용
from .schemas import (
    EquipmentListOut, EquipmentRowOut,
    MoveBatchIn, MoveBatchOut, AllowedSite, ConflictOut,   # ✅ ConflictOut import
)
from .models import EquipmentMoveLog
from fastapi.responses import JSONResponse


router = APIRouter(prefix="/move", tags=["equipment-move"])

@router.get("/equipments", response_model=EquipmentListOut)
def list_equipments(
    site: AllowedSite = Query(..., description="본사/진우리/부항리"),
    db: Session = Depends(get_db),
):
  rows = (
      db.query(EquipProgress)
        .filter(EquipProgress.site == site)
        .order_by(asc(EquipProgress.slot_code))
        .all()
  )
  items = [
      EquipmentRowOut(
          machine_id=r.machine_id or "",
          site=r.site or "",
          slot=r.slot_code or "",
          manager=r.manager,
          progress=float(r.progress or 0),
      ) for r in rows if (r.machine_id or "").strip()
  ]
  return EquipmentListOut(site=site, items=items)

@router.post("/apply", response_model=MoveBatchOut)
def apply_move(payload: MoveBatchIn, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="이동 항목이 비어 있습니다.")

    # 1) 대상 위치 점유 여부 먼저 검사
    conflicts: List[ConflictOut] = []
    not_found: List[str] = []
    updates: list[tuple[str, str, str]] = []  # (machine_id, to_site, to_slot)

    for item in payload.items:
        slot_up = item.to_slot.upper()
        # 대상 장비 존재 여부
        row = db.query(EquipProgress).filter(EquipProgress.machine_id == item.machine_id).one_or_none()
        if not row:
            not_found.append(item.machine_id)
            continue

        # 같은 위치에 다른 장비가 있으면 충돌
        at_target = (
            db.query(EquipProgress)
              .filter(
                  EquipProgress.site == item.to_site,
                  EquipProgress.slot_code == slot_up,
              )
              .one_or_none()
        )
        if at_target and (at_target.machine_id or "").strip() and at_target.machine_id != item.machine_id:
            conflicts.append(ConflictOut(site=item.to_site, slot=slot_up, current_machine_id=at_target.machine_id))
            continue

        updates.append((item.machine_id, item.to_site, slot_up))

    # 충돌이 하나라도 있으면 전체 적용을 막고 409로 상세 반환
    if conflicts:
        return JSONResponse(
            status_code=409,
            content=MoveBatchOut(ok=False, updated=0, not_found=not_found, conflicts=conflicts).model_dump(),
        )

    updated = 0
    for mid, to_site, slot_up in updates:
        row = db.query(EquipProgress).filter(EquipProgress.machine_id == mid).one()

        # 업데이트 전에 기존 위치 저장
        old_site = row.site or ""
        old_slot = row.slot_code or ""
        mgr      = row.manager or ""   # manager NOT NULL 대응

        # 위치 업데이트
        row.site = to_site
        row.slot_code = slot_up
        updated += 1

        # 이동 로그 적재
        db.add(
            EquipmentMoveLog(
                machine_id = row.machine_id or "",   # ✅ machine_no → machine_id
                manager    = mgr,
                from_site  = old_site,
                to_site    = to_site,
                from_slot  = old_slot or "",
                to_slot    = slot_up or "",
            )
        )

    db.commit()
    return MoveBatchOut(ok=True, updated=updated, not_found=not_found, conflicts=[])
