# backend/ProgressChecklist/routers.py
from __future__ import annotations

import re
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.db.database import get_db

# ORM
from ..EquipmentInfo.models import EquipmentOption
from ..MainDashboard.models import EquipProgress, EquipmentProgressLog
from .models import Checklist, EquipmentChecklistResult

# Schemas
from .schemas import (
    ChecklistItemOut,
    ChecklistPageOut,
    ChecklistByMachineOut,
    SaveChecklistIn,
    SaveChecklistOut,
    SaveChecklistBatchIn,
    SaveChecklistBatchOut,
)

router = APIRouter(prefix="/progress", tags=["progress-checklist"])

# 쉼표/공백/슬래시/파이프/세미콜론으로 구분
_SPLIT_RE = re.compile(r"[,\s/|;]+")


def _split_options(raw: str) -> List[str]:
    if not raw:
        return []
    return [t for t in (s.strip() for s in _SPLIT_RE.split(raw)) if t]


def _upsert_progress(machine_id: str, progress: float, db: Session) -> None:
    """equip_progress.progress 갱신(행이 없으면 생성하지 않음)."""
    row = (
        db.query(EquipProgress)
        .filter(EquipProgress.machine_id == machine_id)
        .one_or_none()
    )
    if row:
        row.progress = progress


def _recompute_machine_progress(machine_id: str, db: Session) -> float:
    """
    machine_id 기준 전체 진행률(0~100) 재계산 후 equip_progress.progress 반영.
    진행률 = (저장된 항목 공수합 / 전체 공수합) * 100
    """
    # 옵션 목록 모으기
    opt_rows = (
        db.query(EquipmentOption.option_id)
        .filter(EquipmentOption.machine_id == machine_id)
        .all()
    )
    if not opt_rows:
        _upsert_progress(machine_id, 0.0, db)
        return 0.0

    opts = _split_options(",".join(r[0] for r in opt_rows))
    if not opts:
        _upsert_progress(machine_id, 0.0, db)
        return 0.0

    # 저장 결과 미리 로드 (option -> checked_steps[])
    res_rows = (
        db.query(EquipmentChecklistResult.option, EquipmentChecklistResult.checked_steps)
        .filter(EquipmentChecklistResult.machine_id == machine_id)
        .all()
    )
    saved_map = {opt: (steps or []) for opt, steps in res_rows}

    grand_total = 0.0
    done_total = 0.0

    for opt in opts:
        key = opt.lower()

        items = (
            db.query(Checklist.no, Checklist.hours)
            .filter(func.lower(Checklist.option) == key)
            .all()
        )
        if not items:
            continue

        total_hours = sum(float(h) for _, h in items)
        grand_total += total_hours

        saved = set(saved_map.get(opt, []) or [])
        if saved:
            done_hours = sum(float(h) for no, h in items if no in saved)
            done_total += done_hours

    progress = round((done_total / grand_total * 100.0), 2) if grand_total > 0 else 0.0
    _upsert_progress(machine_id, progress, db)
    return progress


def _log_progress_update(machine_id: str, progress: float, db: Session) -> None:
    """
    저장 성공 시 equipment_progress_log에 한 줄 기록.
    manager는 equip_progress.manager 우선, 없으면 'system'.
    """
    mgr = (
        db.query(EquipProgress.manager)
        .filter(EquipProgress.machine_id == machine_id)
        .scalar()
    ) or "system"

    db.add(EquipmentProgressLog(machine_no=machine_id, manager=mgr, progress=progress))


# ------------------------- 조회 -------------------------

@router.get("/checklist/{machine_id}", response_model=ChecklistByMachineOut)
def get_checklist_by_machine(machine_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(EquipmentOption.option_id)
        .filter(EquipmentOption.machine_id == machine_id)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="equipment_option not found for machine")

    opt_list = _split_options(",".join(r[0] for r in rows))
    if not opt_list:
        return ChecklistByMachineOut(machine_id=machine_id, options=[], pages=[])

    pages: List[ChecklistPageOut] = []
    seen = set()

    for opt in opt_list:
        key = opt.lower()
        if key in seen:
            continue
        seen.add(key)

        # 체크리스트 항목
        items = (
            db.query(Checklist)
            .filter(func.lower(Checklist.option) == key)
            .order_by(Checklist.step.asc(), Checklist.no.asc())
            .all()
        )

        # 저장된 체크 목록
        saved = (
            db.query(EquipmentChecklistResult.checked_steps)
            .filter(
                EquipmentChecklistResult.machine_id == machine_id,
                EquipmentChecklistResult.option == opt,
            )
            .one_or_none()
        )
        checked_steps = list(saved[0]) if saved and saved[0] else []

        total_hours = float(sum(float(it.hours) for it in items)) if items else 0.0
        items_out = [
            ChecklistItemOut(
                no=it.no,
                step=it.step,
                item=it.item,
                hours=float(it.hours),
                percent=round((float(it.hours) / total_hours * 100.0), 1) if total_hours > 0 else 0.0,
            )
            for it in items
        ]

        pages.append(
            ChecklistPageOut(
                option=opt,
                total_hours=round(total_hours, 1),
                item_count=len(items_out),
                items=items_out,
                checked_steps=checked_steps,
            )
        )

    return ChecklistByMachineOut(
        machine_id=machine_id,
        options=[p.option for p in pages],
        pages=pages,
    )


# ------------------------- 저장(단건, 호환용) -------------------------

@router.post("/checklist/result", response_model=SaveChecklistOut)
def save_checklist_result(payload: SaveChecklistIn, db: Session = Depends(get_db)):
    steps = sorted(set(int(x) for x in payload.checked_steps))

    # 이 옵션의 유효 checklist.no만 허용
    valid_nos = {
        n for (n,) in db.query(Checklist.no)
        .filter(func.lower(Checklist.option) == payload.option.lower())
        .all()
    }
    steps = [n for n in steps if n in valid_nos]

    row = (
        db.query(EquipmentChecklistResult)
        .filter(
            EquipmentChecklistResult.machine_id == payload.machine_id,
            EquipmentChecklistResult.option == payload.option,
        )
        .one_or_none()
    )
    if row:
        row.checked_steps = steps
    else:
        db.add(EquipmentChecklistResult(
            machine_id=payload.machine_id,
            option=payload.option,
            checked_steps=steps,
        ))

    prog = _recompute_machine_progress(payload.machine_id, db)
    _log_progress_update(payload.machine_id, prog, db)

    db.commit()
    return SaveChecklistOut(ok=True)


# ------------------------- 저장(배치, 추천) -------------------------

@router.post("/checklist/result/batch", response_model=SaveChecklistBatchOut)
def save_checklist_result_batch(payload: SaveChecklistBatchIn, db: Session = Depends(get_db)):
    machine_id = payload.machine_id

    # 옵션별 유효 no 준비
    valid_map: dict[str, set[int]] = {}
    for item in payload.items:
        key = item.option.lower()
        nos = {
            n for (n,) in db.query(Checklist.no)
            .filter(func.lower(Checklist.option) == key)
            .all()
        }
        valid_map[item.option] = nos

    # 기존 결과 전체 삭제
    db.query(EquipmentChecklistResult) \
      .filter(EquipmentChecklistResult.machine_id == machine_id) \
      .delete(synchronize_session=False)

    # 새 insert
    new_rows: list[EquipmentChecklistResult] = []
    for item in payload.items:
        steps = sorted({int(x) for x in item.checked_steps if int(x) in valid_map[item.option]})
        new_rows.append(EquipmentChecklistResult(
            machine_id=machine_id,
            option=item.option,
            checked_steps=steps,
        ))
    if new_rows:
        db.add_all(new_rows)

    db.flush()  # 진행률 계산 전에 flush
    prog = _recompute_machine_progress(machine_id, db)
    _log_progress_update(machine_id, prog, db)

    db.commit()
    return SaveChecklistBatchOut(ok=True, saved=len(new_rows))
