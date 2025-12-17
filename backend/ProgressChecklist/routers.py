# backend/ProgressChecklist/routers.py
from __future__ import annotations

import re
from typing import List, Dict, Set, Tuple

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

# ✅ 옵션 분리 규칙:
# - "옵션 목록"은 콤마(,), 슬래시(/), 파이프(|), 세미콜론(;) 으로만 구분
# - 공백은 옵션명 내부에 허용 (예: "SE COLD" 가능)
_SPLIT_RE = re.compile(r"\s*(?:,|/|\||;)\s*")
_WS_RE = re.compile(r"\s+")


def _canon_option(opt: str) -> str:
    """옵션명 정규화: 앞뒤 공백 제거 + 연속 공백 1개 + 대문자 통일."""
    opt = (opt or "").strip()
    opt = _WS_RE.sub(" ", opt)
    return opt.upper()


def _split_options(raw: str) -> List[str]:
    """
    EquipmentOption.option_id 등에 들어있는 '옵션 목록' 문자열을 분리해
    옵션 리스트로 반환 (중복 제거, 순서 유지).
    """
    if not raw:
        return []

    parts = (s.strip() for s in _SPLIT_RE.split(raw))
    out: List[str] = []
    seen: Set[str] = set()

    for p in parts:
        if not p:
            continue
        p2 = _canon_option(p)
        k = p2.lower()
        if k in seen:
            continue
        seen.add(k)
        out.append(p2)

    return out


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

    raw = ",".join((r[0] or "") for r in opt_rows)
    opts = _split_options(raw)
    if not opts:
        _upsert_progress(machine_id, 0.0, db)
        return 0.0

    # 저장 결과 미리 로드 (option_lower -> checked_steps[])
    res_rows = (
        db.query(EquipmentChecklistResult.option, EquipmentChecklistResult.checked_steps)
        .filter(EquipmentChecklistResult.machine_id == machine_id)
        .all()
    )
    saved_map: Dict[str, List[int]] = {
        (opt or "").lower(): (steps or []) for opt, steps in res_rows
    }

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

        saved = set(saved_map.get(key, []) or [])
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

    raw = ",".join((r[0] or "") for r in rows)
    opt_list = _split_options(raw)
    if not opt_list:
        return ChecklistByMachineOut(machine_id=machine_id, options=[], pages=[])

    pages: List[ChecklistPageOut] = []

    for opt in opt_list:
        key = opt.lower()

        # 체크리스트 항목
        items = (
            db.query(Checklist)
            .filter(func.lower(Checklist.option) == key)
            .order_by(Checklist.step.asc(), Checklist.no.asc())
            .all()
        )

        # 저장된 체크 목록 (대소문자/공백 차이에도 안전하게 lower 비교 + 최신값 우선)
        saved = (
            db.query(EquipmentChecklistResult.checked_steps)
            .filter(
                EquipmentChecklistResult.machine_id == machine_id,
                func.lower(EquipmentChecklistResult.option) == key,
            )
            .order_by(EquipmentChecklistResult.updated_at.desc(), EquipmentChecklistResult.no.desc())
            .first()
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
    machine_id = (payload.machine_id or "").strip()
    opt = _canon_option(payload.option)

    steps = sorted(set(int(x) for x in (payload.checked_steps or [])))

    # 이 옵션의 유효 checklist.no만 허용
    valid_nos = {
        n for (n,) in db.query(Checklist.no)
        .filter(func.lower(Checklist.option) == opt.lower())
        .all()
    }
    steps = [n for n in steps if n in valid_nos]

    # 동일 option(대소문자 다름) 중복이 있을 수 있으니 최신 1개를 사용하고 나머지는 정리
    existing_rows = (
        db.query(EquipmentChecklistResult)
        .filter(
            EquipmentChecklistResult.machine_id == machine_id,
            func.lower(EquipmentChecklistResult.option) == opt.lower(),
        )
        .order_by(EquipmentChecklistResult.updated_at.desc(), EquipmentChecklistResult.no.desc())
        .all()
    )

    if existing_rows:
        row = existing_rows[0]
        row.option = opt
        row.checked_steps = steps

        # 중복이 있으면 나머지는 삭제(유니크 정상화)
        if len(existing_rows) > 1:
            dup_ids = [r.no for r in existing_rows[1:]]
            db.query(EquipmentChecklistResult) \
              .filter(EquipmentChecklistResult.no.in_(dup_ids)) \
              .delete(synchronize_session=False)
    else:
        db.add(EquipmentChecklistResult(
            machine_id=machine_id,
            option=opt,
            checked_steps=steps,
        ))

    prog = _recompute_machine_progress(machine_id, db)
    _log_progress_update(machine_id, prog, db)

    db.commit()
    return SaveChecklistOut(ok=True)


# ------------------------- 저장(배치, 추천) -------------------------

@router.post("/checklist/result/batch", response_model=SaveChecklistBatchOut)
def save_checklist_result_batch(payload: SaveChecklistBatchIn, db: Session = Depends(get_db)):
    machine_id = (payload.machine_id or "").strip()

    # 옵션별 valid no 캐시 + payload 중복 옵션 병합
    valid_cache: Dict[str, Set[int]] = {}
    merged_steps: Dict[str, Set[int]] = {}

    def get_valid_nos(opt_lower: str) -> Set[int]:
        if opt_lower in valid_cache:
            return valid_cache[opt_lower]
        nos = {
            n for (n,) in db.query(Checklist.no)
            .filter(func.lower(Checklist.option) == opt_lower)
            .all()
        }
        valid_cache[opt_lower] = nos
        return nos

    for item in (payload.items or []):
        opt = _canon_option(item.option)
        key = opt.lower()
        valid = get_valid_nos(key)

        cleaned = {int(x) for x in (item.checked_steps or [])}
        cleaned = {n for n in cleaned if n in valid}

        merged_steps.setdefault(opt, set()).update(cleaned)

    # 기존 결과 전체 삭제
    db.query(EquipmentChecklistResult) \
      .filter(EquipmentChecklistResult.machine_id == machine_id) \
      .delete(synchronize_session=False)

    # 새 insert
    new_rows: List[EquipmentChecklistResult] = []
    for opt, steps_set in merged_steps.items():
        new_rows.append(EquipmentChecklistResult(
            machine_id=machine_id,
            option=opt,
            checked_steps=sorted(steps_set),
        ))

    if new_rows:
        db.add_all(new_rows)

    db.flush()  # 진행률 계산 전에 flush
    prog = _recompute_machine_progress(machine_id, db)
    _log_progress_update(machine_id, prog, db)

    db.commit()
    return SaveChecklistBatchOut(ok=True, saved=len(new_rows))
