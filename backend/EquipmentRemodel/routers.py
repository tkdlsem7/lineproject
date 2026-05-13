from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session, joinedload

from backend.deps import get_db
from .models import (
    EquipmentMaster,
    EquipmentRemodel,
    EquipmentRemodelChecklist,
    RemodelOptionMaster,
    ScheduleEvent,
)
from .schemas import (
    EquipmentRemodelChecklistItemOut,
    EquipmentRemodelDetailOut,
    EquipmentRemodelSaveRequest,
    EquipmentRemodelSaveResponse,
    RemodelOptionCreateRequest,
    RemodelOptionOut,
    RemodelOptionUpdateRequest,
)

router = APIRouter(
    prefix="/equipment-remodel",
    tags=["EquipmentRemodel"],
)


@router.get("/ping")
def ping():
    return {"ok": True, "where": "EquipmentRemodel"}


def _empty_to_none(value: Optional[str]):
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def _validate_option_ids(db: Session, option_ids: list[int]) -> None:
    if not option_ids:
        return

    found_rows = (
        db.query(RemodelOptionMaster.id)
        .filter(RemodelOptionMaster.id.in_(option_ids))
        .all()
    )
    found_ids = {row[0] for row in found_rows}
    missing_ids = [oid for oid in option_ids if oid not in found_ids]

    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"존재하지 않는 option_id가 있습니다: {missing_ids}",
        )


def _build_detail_out(row: EquipmentRemodel) -> EquipmentRemodelDetailOut:
    items = sorted(
        row.checklist_items or [],
        key=lambda x: (x.sort_order or 0, x.id or 0),
    )

    checklist = [
        EquipmentRemodelChecklistItemOut(
            id=item.id,
            option_id=item.option_id,
            option_name=(item.option.option_name if item.option else ""),
            start_date=item.start_date,
            end_date=item.end_date,
            remodel_time_text=item.remodel_time_text,
            is_completed=item.is_completed,
            completed_at=item.completed_at,
            delay_reason=item.delay_reason,
            sort_order=item.sort_order,
        )
        for item in items
    ]

    return EquipmentRemodelDetailOut(
        id=row.id,
        machine_id=row.machine_id,
        remodel_manager=row.remodel_manager or "",
        remodel_time_text=row.remodel_time_text or "",
        model=row.model or "",
        manager_feedback=row.manager_feedback,
        delay_reason=row.delay_reason,
        result_status=row.result_status or None,
        improvement_status=row.improvement_status,
        remodel_progress_status=row.remodel_progress_status,
        created_at=row.created_at,
        updated_at=row.updated_at,
        checklist_count=len(checklist),
        checklist=checklist,
    )


def _get_or_create_equipment_master(
    db: Session,
    *,
    machine_no: str,
    model: Optional[str] = None,
) -> EquipmentMaster:
    row = (
        db.query(EquipmentMaster)
        .filter(EquipmentMaster.machine_no == machine_no)
        .first()
    )
    if row:
        if model and not row.model:
            row.model = model
        return row

    row = EquipmentMaster(
        machine_no=machine_no,
        model=model or None,
    )
    db.add(row)
    db.flush()
    return row


def _delete_manual_schedule_events(
    db: Session,
    *,
    equipment_id: int,
    remodel_id: int,
) -> None:
    (
        db.query(ScheduleEvent)
        .filter(
            ScheduleEvent.equipment_id == equipment_id,
            ScheduleEvent.source_type == "remodel_manual",
            ScheduleEvent.extra_data["remodel_id"].astext == str(remodel_id),
        )
        .delete(synchronize_session=False)
    )


def _sync_manual_schedule_events(
    db: Session,
    *,
    equipment: EquipmentMaster,
    remodel: EquipmentRemodel,
    checklist_payload,
    option_name_map: dict[int, str],
    previous_map: dict[tuple[int, int], EquipmentRemodelChecklist],
) -> None:
    for idx, item in enumerate(checklist_payload):
        option_name = option_name_map.get(item.option_id, f"option_{item.option_id}")
        sort_order = item.sort_order if item.sort_order is not None else idx

        prev_item = previous_map.get((item.option_id, sort_order))
        prev_start = prev_item.start_date.isoformat() if prev_item and prev_item.start_date else None
        prev_end = prev_item.end_date.isoformat() if prev_item and prev_item.end_date else None

        item_delay_reason = _empty_to_none(item.delay_reason)
        changed_reason = item_delay_reason or remodel.delay_reason or remodel.manager_feedback

        common_extra = {
            "remodel_id": remodel.id,
            "machine_id": remodel.machine_id,
            "option_id": item.option_id,
            "option_name": option_name,
            "sort_order": sort_order,
            "start_date": item.start_date.isoformat() if item.start_date else None,
            "end_date": item.end_date.isoformat() if item.end_date else None,
            "remodel_time_text": _empty_to_none(item.remodel_time_text),
            "previous_start_date": prev_start,
            "previous_end_date": prev_end,
            "is_completed": item.is_completed,
            "completed_at": item.completed_at.isoformat() if item.completed_at else None,
            "delay_reason": item_delay_reason,
            "changed_reason": changed_reason,
            "result_status": remodel.result_status,
            "improvement_status": remodel.improvement_status,
            "remodel_progress_status": remodel.remodel_progress_status,
            "saved_at": datetime.now().isoformat(),
        }

        event_status = "변경"

        if item.start_date:
            db.add(
                ScheduleEvent(
                    equipment_id=equipment.id,
                    source_type="remodel_manual",
                    event_type="remodel_schedule_start",
                    event_name=f"{option_name} 시작",
                    event_date=item.start_date,
                    status=event_status,
                    team_name="remodel_manual",
                    extra_data={
                        **common_extra,
                        "event_phase": "start",
                    },
                )
            )

        if item.end_date:
            db.add(
                ScheduleEvent(
                    equipment_id=equipment.id,
                    source_type="remodel_manual",
                    event_type="remodel_schedule_end",
                    event_name=f"{option_name} 종료",
                    event_date=item.end_date,
                    status=event_status,
                    team_name="remodel_manual",
                    extra_data={
                        **common_extra,
                        "event_phase": "end",
                    },
                )
            )


@router.get("/options", response_model=List[RemodelOptionOut])
def get_remodel_options(db: Session = Depends(get_db)):
    return (
        db.query(RemodelOptionMaster)
        .order_by(RemodelOptionMaster.id.asc())
        .all()
    )


@router.post(
    "/options",
    response_model=RemodelOptionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_remodel_option(
    payload: RemodelOptionCreateRequest,
    db: Session = Depends(get_db),
):
    option_name = payload.option_name.strip()

    exists = (
        db.query(RemodelOptionMaster)
        .filter(RemodelOptionMaster.option_name == option_name)
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 옵션명입니다.",
        )

    row = RemodelOptionMaster(option_name=option_name)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.put("/options/{option_id}", response_model=RemodelOptionOut)
def update_remodel_option(
    payload: RemodelOptionUpdateRequest,
    option_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    row = (
        db.query(RemodelOptionMaster)
        .filter(RemodelOptionMaster.id == option_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="해당 옵션이 없습니다.")

    option_name = payload.option_name.strip()

    exists = (
        db.query(RemodelOptionMaster)
        .filter(
            RemodelOptionMaster.option_name == option_name,
            RemodelOptionMaster.id != option_id,
        )
        .first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 존재하는 옵션명입니다.",
        )

    row.option_name = option_name
    db.commit()
    db.refresh(row)
    return row


@router.delete("/options/{option_id}")
def delete_remodel_option(
    option_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
):
    row = (
        db.query(RemodelOptionMaster)
        .filter(RemodelOptionMaster.id == option_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="해당 옵션이 없습니다.")

    used = (
        db.query(EquipmentRemodelChecklist.id)
        .filter(EquipmentRemodelChecklist.option_id == option_id)
        .first()
    )
    if used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 체크리스트에서 사용 중인 옵션이라 삭제할 수 없습니다.",
        )

    db.delete(row)
    db.commit()
    return {"message": "삭제 완료"}


@router.get("/detail/{remodel_id}", response_model=EquipmentRemodelDetailOut)
def get_remodel_detail(
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
        raise HTTPException(status_code=404, detail="해당 개조 입력 데이터가 없습니다.")

    return _build_detail_out(row)


@router.get("/by-machine/{machine_id}", response_model=EquipmentRemodelDetailOut)
def get_latest_remodel_by_machine(
    machine_id: str,
    db: Session = Depends(get_db),
):
    machine_id = machine_id.strip()
    if not machine_id:
        raise HTTPException(status_code=422, detail="machine_id가 필요합니다.")

    row = (
        db.query(EquipmentRemodel)
        .options(
            joinedload(EquipmentRemodel.checklist_items).joinedload(
                EquipmentRemodelChecklist.option
            )
        )
        .filter(EquipmentRemodel.machine_id == machine_id)
        .order_by(EquipmentRemodel.id.desc())
        .first()
    )

    if not row:
        raise HTTPException(status_code=404, detail="해당 장비의 개조 입력 데이터가 없습니다.")

    return _build_detail_out(row)


@router.post("/save", response_model=EquipmentRemodelSaveResponse)
def save_equipment_remodel(
    payload: EquipmentRemodelSaveRequest,
    db: Session = Depends(get_db),
):
    option_ids = [item.option_id for item in payload.checklist]
    _validate_option_ids(db, option_ids)

    option_rows = (
        db.query(RemodelOptionMaster)
        .filter(RemodelOptionMaster.id.in_(option_ids))
        .all()
    )
    option_name_map = {row.id: row.option_name for row in option_rows}

    mode: str
    previous_map: dict[tuple[int, int], EquipmentRemodelChecklist] = {}

    if payload.remodel_id:
        row = (
            db.query(EquipmentRemodel)
            .options(joinedload(EquipmentRemodel.checklist_items))
            .filter(EquipmentRemodel.id == payload.remodel_id)
            .first()
        )
        if not row:
            raise HTTPException(status_code=404, detail="수정할 개조 입력 데이터가 없습니다.")
        mode = "update"

        previous_map = {
            (item.option_id, item.sort_order): item
            for item in (row.checklist_items or [])
        }
    else:
        row = EquipmentRemodel()
        db.add(row)
        mode = "insert"

    row.machine_id = payload.machine_id.strip()
    row.remodel_manager = (payload.remodel_manager or "").strip()
    row.remodel_time_text = (payload.remodel_time_text or "").strip()
    row.model = (payload.model or "").strip()
    row.manager_feedback = _empty_to_none(payload.manager_feedback)
    row.delay_reason = _empty_to_none(payload.delay_reason)
    row.result_status = payload.result_status or None
    row.improvement_status = payload.improvement_status
    row.remodel_progress_status = payload.remodel_progress_status

    try:
        db.flush()

        equipment = _get_or_create_equipment_master(
            db,
            machine_no=row.machine_id,
            model=row.model or None,
        )

        if mode == "update":
            (
                db.query(EquipmentRemodelChecklist)
                .filter(EquipmentRemodelChecklist.remodel_id == row.id)
                .delete(synchronize_session=False)
            )

        _delete_manual_schedule_events(
            db,
            equipment_id=equipment.id,
            remodel_id=row.id,
        )

        for idx, item in enumerate(payload.checklist):
            completed_at = item.completed_at
            if item.is_completed and completed_at is None:
                completed_at = datetime.now()
            if not item.is_completed:
                completed_at = None

            db.add(
                EquipmentRemodelChecklist(
                    remodel_id=row.id,
                    option_id=item.option_id,
                    start_date=item.start_date,
                    end_date=item.end_date,
                    remodel_time_text=_empty_to_none(item.remodel_time_text),
                    is_completed=item.is_completed,
                    completed_at=completed_at,
                    delay_reason=_empty_to_none(item.delay_reason),
                    sort_order=item.sort_order if item.sort_order is not None else idx,
                )
            )

        _sync_manual_schedule_events(
            db,
            equipment=equipment,
            remodel=row,
            checklist_payload=payload.checklist,
            option_name_map=option_name_map,
            previous_map=previous_map,
        )

        db.commit()
        db.refresh(row)

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"저장 실패: {e}",
        )

    return EquipmentRemodelSaveResponse(
        mode=mode,
        remodel_id=row.id,
        checklist_count=len(payload.checklist),
        message="저장 완료",
    )
