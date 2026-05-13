from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from backend.deps import get_db
from .models import EquipmentRemodel, EquipmentRemodelChecklist, RemodelOptionMaster
from .schemas import (
    EquipmentRemodelLogDashboardOut,
    EquipmentRemodelLogFilterOptionsOut,
    EquipmentRemodelManageDetailOut,
    EquipmentRemodelManageListOut,
    EquipmentRemodelManageMessageOut,
    EquipmentRemodelManageUpdateRequest,
)

router = APIRouter(
    prefix="/equipment-remodel-logs",
    tags=["EquipmentRemodelLog"],
)


# ---------------------------------------------------------
# 공통 유틸
# ---------------------------------------------------------
def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = str(value).strip()
    return value if value else None


def _to_date_start(value: Optional[date]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.combine(value, time.min)


def _to_date_end_exclusive(value: Optional[date]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.combine(value + timedelta(days=1), time.min)


def _format_minutes_text(minutes: Optional[float]) -> str:
    if minutes is None:
        return "-"

    minutes_int = int(round(minutes))
    hours = minutes_int // 60
    mins = minutes_int % 60

    if hours > 0 and mins > 0:
        return f"{hours}시간 {mins}분"
    if hours > 0:
        return f"{hours}시간"
    return f"{mins}분"


def _parse_time_to_minutes(value: Optional[str]) -> Optional[float]:
    """
    지원 예시:
    - 2시간 30분
    - 90분
    - 5h
    - 2.5h
    - 01:30
    - 150
    """
    if value is None:
        return None

    text = str(value).strip().lower()
    if not text:
        return None

    hhmm = re.fullmatch(r"(\d{1,2}):(\d{1,2})", text)
    if hhmm:
        h = int(hhmm.group(1))
        m = int(hhmm.group(2))
        return float(h * 60 + m)

    total = 0.0
    matched = False

    hour_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:시간|hour|hours|hr|hrs|h)", text)
    if hour_match:
        total += float(hour_match.group(1)) * 60
        matched = True

    minute_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:분|min|mins|minute|minutes|m)", text)
    if minute_match:
        total += float(minute_match.group(1))
        matched = True

    if matched:
        return total

    only_number = re.fullmatch(r"\d+(?:\.\d+)?", text)
    if only_number:
        return float(text)

    return None


def _apply_common_filters(
    query,
    *,
    start_date: Optional[date],
    end_date: Optional[date],
    q: Optional[str] = None,
    model: Optional[str] = None,
    manager: Optional[str] = None,
    option_id: Optional[int] = None,
):
    start_dt = _to_date_start(start_date)
    end_dt = _to_date_end_exclusive(end_date)

    if start_dt is not None:
        query = query.filter(EquipmentRemodel.created_at >= start_dt)

    if end_dt is not None:
        query = query.filter(EquipmentRemodel.created_at < end_dt)

    q = _clean_text(q)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(
                EquipmentRemodel.machine_id.ilike(like),
                EquipmentRemodel.remodel_manager.ilike(like),
            )
        )

    model = _clean_text(model)
    if model:
        query = query.filter(EquipmentRemodel.model == model)

    manager = _clean_text(manager)
    if manager:
        query = query.filter(EquipmentRemodel.remodel_manager == manager)

    if option_id is not None:
        query = query.filter(
            EquipmentRemodel.checklist_items.any(
                EquipmentRemodelChecklist.option_id == option_id
            )
        )

    return query


def _format_option_names(row: EquipmentRemodel) -> list[str]:
    items = sorted(
        row.checklist_items or [],
        key=lambda x: (x.sort_order or 0, x.id or 0),
    )

    result: list[str] = []
    for item in items:
        option_name = ""
        if item.option and item.option.option_name:
            option_name = item.option.option_name.strip()

        if option_name:
            result.append(option_name)

    return result


def _serialize_manage_detail(row: EquipmentRemodel) -> dict:
    items = sorted(
        row.checklist_items or [],
        key=lambda x: (x.sort_order or 0, x.id or 0),
    )

    checklist = []
    for item in items:
        option_name = item.option.option_name if item.option else ""
        checklist.append(
            {
                "id": item.id,
                "option_id": item.option_id,
                "option_name": option_name or "",
                "remodel_time_text": item.remodel_time_text,
                "delay_reason": item.delay_reason,
                "sort_order": item.sort_order or 0,
            }
        )

    return {
        "id": row.id,
        "machine_id": row.machine_id,
        "remodel_manager": row.remodel_manager,
        "model": row.model,
        "manager_feedback": row.manager_feedback,
        "delay_reason": row.delay_reason,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "checklist": checklist,
    }


# ---------------------------------------------------------
# 기본 확인
# ---------------------------------------------------------
@router.get("/ping")
def ping():
    return {"ok": True, "where": "EquipmentRemodelLog"}


# ---------------------------------------------------------
# 필터 정보
# ---------------------------------------------------------
@router.get("/filters", response_model=EquipmentRemodelLogFilterOptionsOut)
def get_filters(db: Session = Depends(get_db)):
    option_rows = (
        db.query(RemodelOptionMaster)
        .order_by(RemodelOptionMaster.option_name.asc())
        .all()
    )

    model_rows = (
        db.query(EquipmentRemodel.model)
        .filter(EquipmentRemodel.model.isnot(None))
        .filter(func.length(func.trim(EquipmentRemodel.model)) > 0)
        .distinct()
        .order_by(EquipmentRemodel.model.asc())
        .all()
    )

    manager_rows = (
        db.query(EquipmentRemodel.remodel_manager)
        .filter(EquipmentRemodel.remodel_manager.isnot(None))
        .filter(func.length(func.trim(EquipmentRemodel.remodel_manager)) > 0)
        .distinct()
        .order_by(EquipmentRemodel.remodel_manager.asc())
        .all()
    )

    min_dt = db.query(func.min(EquipmentRemodel.created_at)).scalar()
    max_dt = db.query(func.max(EquipmentRemodel.created_at)).scalar()

    return {
        "models": [row[0] for row in model_rows if row[0]],
        "managers": [row[0] for row in manager_rows if row[0]],
        "options": [
            {
                "id": row.id,
                "option_name": row.option_name,
            }
            for row in option_rows
        ],
        "min_date": min_dt.date().isoformat() if min_dt else None,
        "max_date": max_dt.date().isoformat() if max_dt else None,
    }


# ---------------------------------------------------------
# 대시보드 집계
# ---------------------------------------------------------
@router.get("/dashboard", response_model=EquipmentRemodelLogDashboardOut)
def get_dashboard(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    model: Optional[str] = Query(None),
    manager: Optional[str] = Query(None),
    option_id: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db),
):
    query = (
        db.query(EquipmentRemodel)
        .options(
            joinedload(EquipmentRemodel.checklist_items).joinedload(
                EquipmentRemodelChecklist.option
            )
        )
        .order_by(EquipmentRemodel.created_at.asc(), EquipmentRemodel.id.asc())
    )

    query = _apply_common_filters(
        query,
        start_date=start_date,
        end_date=end_date,
        model=model,
        manager=manager,
        option_id=option_id,
    )

    rows = query.all()

    # 1) 모델 + 옵션별 시간 통계
    time_buckets: dict[tuple[str, str], dict[str, list[float] | int]] = defaultdict(
        lambda: {"all_count": 0, "time_values": []}
    )

    # 2) 전체 / 담당자별 부적합
    total_jobs = len(rows)
    defect_jobs = 0
    manager_buckets: dict[str, dict[str, int]] = defaultdict(
        lambda: {"total_jobs": 0, "defect_jobs": 0}
    )

    # 3) 월별 모델 + 옵션 항목 건수
    monthly_buckets: dict[tuple[str, str, str], int] = defaultdict(int)

    for row in rows:
        model_value = _clean_text(row.model) or "-"
        manager_value = _clean_text(row.remodel_manager) or "-"
        created_month = row.created_at.strftime("%Y-%m") if row.created_at else "-"

        manager_buckets[manager_value]["total_jobs"] += 1
        if (row.result_status or "").strip() == "부적합":
            defect_jobs += 1
            manager_buckets[manager_value]["defect_jobs"] += 1

        checklist_items = sorted(
            row.checklist_items or [],
            key=lambda x: (x.sort_order or 0, x.id or 0),
        )

        for item in checklist_items:
            if option_id is not None and item.option_id != option_id:
                continue

            option_name = "-"
            if item.option and item.option.option_name:
                option_name = item.option.option_name.strip() or "-"

            bucket = time_buckets[(model_value, option_name)]
            bucket["all_count"] += 1

            minutes = _parse_time_to_minutes(item.remodel_time_text or row.remodel_time_text)
            if minutes is not None:
                bucket["time_values"].append(minutes)

            monthly_buckets[(created_month, model_value, option_name)] += 1

    model_option_times = []
    all_avg_minutes: list[float] = []

    for (model_value, option_name), payload in sorted(
        time_buckets.items(),
        key=lambda x: (x[0][0], x[0][1]),
    ):
        time_values: list[float] = payload["time_values"]  # type: ignore[assignment]
        item_count: int = int(payload["all_count"])  # type: ignore[arg-type]
        time_input_count = len(time_values)

        avg_minutes: Optional[int] = None
        min_minutes: Optional[float] = None
        max_minutes: Optional[float] = None

        if time_values:
            avg_raw = sum(time_values) / len(time_values)
            min_minutes = min(time_values)
            max_minutes = max(time_values)
            avg_minutes = int(round(avg_raw))
            all_avg_minutes.append(avg_raw)

        model_option_times.append(
            {
                "model": model_value,
                "option_name": option_name,
                "item_count": item_count,
                "time_input_count": time_input_count,
                "avg_minutes": avg_minutes,
                "avg_time_text": _format_minutes_text(avg_minutes),
                "min_time_text": _format_minutes_text(min_minutes),
                "max_time_text": _format_minutes_text(max_minutes),
            }
        )

    result_summary_by_manager = []
    for manager_value, stat in sorted(manager_buckets.items(), key=lambda x: x[0]):
        total = stat["total_jobs"]
        defect = stat["defect_jobs"]
        rate = round((defect / total) * 100, 1) if total > 0 else 0.0

        result_summary_by_manager.append(
            {
                "remodel_manager": manager_value,
                "total_jobs": total,
                "defect_jobs": defect,
                "defect_rate": rate,
            }
        )

    monthly_model_option_counts = []
    for (month, model_value, option_name), count in sorted(
        monthly_buckets.items(),
        key=lambda x: (x[0][0], x[0][1], x[0][2]),
    ):
        monthly_model_option_counts.append(
            {
                "month": month,
                "model": model_value,
                "option_name": option_name,
                "item_count": count,
            }
        )

    overall_defect_rate = round((defect_jobs / total_jobs) * 100, 1) if total_jobs > 0 else 0.0

    return {
        "applied_filters": {
            "start_date": start_date.isoformat() if start_date else None,
            "end_date": end_date.isoformat() if end_date else None,
            "model": _clean_text(model),
            "manager": _clean_text(manager),
            "option_id": option_id,
        },
        "model_option_times": model_option_times,
        "result_summary_overall": {
            "total_jobs": total_jobs,
            "defect_jobs": defect_jobs,
            "defect_rate": overall_defect_rate,
        },
        "result_summary_by_manager": result_summary_by_manager,
        "monthly_model_option_counts": monthly_model_option_counts,
    }


# ---------------------------------------------------------
# 관리 - 목록
# ---------------------------------------------------------
@router.get("/manage/list", response_model=EquipmentRemodelManageListOut)
def get_manage_list(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = (
        db.query(EquipmentRemodel)
        .options(
            joinedload(EquipmentRemodel.checklist_items).joinedload(
                EquipmentRemodelChecklist.option
            )
        )
        .order_by(EquipmentRemodel.id.desc())
    )

    query = _apply_common_filters(
        query,
        start_date=start_date,
        end_date=end_date,
        q=q,
    )

    rows = query.all()

    items = []
    for row in rows:
        option_names = _format_option_names(row)
        items.append(
            {
                "id": row.id,
                "machine_id": row.machine_id,
                "remodel_manager": row.remodel_manager,
                "model": row.model,
                "manager_feedback": row.manager_feedback,
                "delay_reason": row.delay_reason,
                "option_names": option_names,
                "option_summary": ", ".join(option_names) if option_names else "",
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
        )

    return {
        "total_count": len(items),
        "items": items,
    }


# ---------------------------------------------------------
# 관리 - 상세
# ---------------------------------------------------------
@router.get("/manage/{remodel_id}", response_model=EquipmentRemodelManageDetailOut)
def get_manage_detail(
    remodel_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    row = (
        db.query(EquipmentRemodel)
        .options(
            joinedload(EquipmentRemodel.checklist_items).joinedload(
                EquipmentRemodelChecklist.option
            )
        )
        .filter(EquipmentRemodel.id == remodel_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="해당 개조 로그가 없습니다.")

    return _serialize_manage_detail(row)


# ---------------------------------------------------------
# 관리 - 수정
# ---------------------------------------------------------
@router.put("/manage/{remodel_id}", response_model=EquipmentRemodelManageMessageOut)
def update_manage_detail(
    remodel_id: int = Path(..., ge=1),
    payload: EquipmentRemodelManageUpdateRequest = ...,
    db: Session = Depends(get_db),
):
    row = (
        db.query(EquipmentRemodel)
        .options(joinedload(EquipmentRemodel.checklist_items))
        .filter(EquipmentRemodel.id == remodel_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="수정할 개조 로그가 없습니다.")

    row.machine_id = payload.machine_id
    row.remodel_manager = _clean_text(payload.remodel_manager)
    row.manager_feedback = _clean_text(payload.manager_feedback)
    row.delay_reason = _clean_text(payload.delay_reason)

    option_ids = []
    seen_option_ids = set()

    for item in payload.checklist:
        option_id_value = int(item.option_id)

        if option_id_value in seen_option_ids:
            raise HTTPException(
                status_code=400,
                detail="같은 옵션 항목은 중복 저장할 수 없습니다.",
            )

        seen_option_ids.add(option_id_value)
        option_ids.append(option_id_value)

    if option_ids:
        valid_ids = {
            row_[0]
            for row_ in db.query(RemodelOptionMaster.id)
            .filter(RemodelOptionMaster.id.in_(option_ids))
            .all()
        }
        missing_ids = [oid for oid in option_ids if oid not in valid_ids]
        if missing_ids:
            raise HTTPException(
                status_code=400,
                detail=f"존재하지 않는 option_id가 있습니다: {missing_ids}",
            )

    try:
        (
            db.query(EquipmentRemodelChecklist)
            .filter(EquipmentRemodelChecklist.remodel_id == row.id)
            .delete(synchronize_session=False)
        )

        for idx, item in enumerate(payload.checklist):
            db.add(
                EquipmentRemodelChecklist(
                    remodel_id=row.id,
                    option_id=int(item.option_id),
                    remodel_time_text=_clean_text(item.remodel_time_text),
                    delay_reason=_clean_text(item.delay_reason),
                    sort_order=int(item.sort_order if item.sort_order is not None else idx),
                )
            )

        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"수정 실패: {e}",
        )

    return {
        "message": "수정 완료",
        "remodel_id": row.id,
    }


# ---------------------------------------------------------
# 관리 - 삭제
# ---------------------------------------------------------
@router.delete("/manage/{remodel_id}")
def delete_manage_detail(
    remodel_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    row = (
        db.query(EquipmentRemodel)
        .filter(EquipmentRemodel.id == remodel_id)
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="삭제할 개조 로그가 없습니다.")

    try:
        db.delete(row)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"삭제 실패: {e}",
        )

    return {"message": "삭제 완료"}