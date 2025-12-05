# routers.py (또는 routers/setup_sheets.py)
from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from backend.db.database import get_db   # 프로젝트 경로에 맞게 수정
from .models import SetupSheetAll # ↑ 같은 경로 기준
from .schemas import SaveRequest, SaveResponse, RowRead

router = APIRouter(prefix="/setup-sheets", tags=["setup-sheets"])

def _next_sheet_id(db: Session) -> int:
    max_id = db.query(func.coalesce(func.max(SetupSheetAll.sheet_id), 0)).scalar() or 0
    return int(max_id + 1)

@router.post("/save", response_model=SaveResponse)
def save_setup_sheet(payload: SaveRequest, db: Session = Depends(get_db)):
    """
    - INSERT: payload.step.id 가 없으면 새 행 생성
    - UPDATE: payload.step.id 가 있으면 해당 행만 수정
    - sheetId 가 없으면 자동 증가(같은 sheetId 로 여러 행 저장 가능)
    """
    sheet_id = payload.sheetId if payload.sheetId is not None else _next_sheet_id(db)

    s = payload.step
    if s.id:  # UPDATE
        row = db.get(SetupSheetAll, s.id)
        if not row:
            raise HTTPException(status_code=404, detail="row not found")
        if row.sheet_id != sheet_id:
            # sheetId 변경은 허용 안 함(프론트도 동일 sheetId로만 저장)
            raise HTTPException(status_code=400, detail="sheetId mismatch")
    else:     # INSERT
        row = SetupSheetAll(sheet_id=sheet_id, step_name=s.step_name)
        db.add(row)
        db.flush()  # row.id 확보

    # 메타(헤더) 필드 채우기
    m = payload.meta
    row.machine_no = m.machine_no
    row.sn = m.sn
    row.chiller_sn = m.chiller_sn
    row.setup_start_date = m.setup_start_date
    row.setup_end_date = m.setup_end_date

    # 스텝 값
    row.step_name = s.step_name
    row.setup_hours = s.setup_hours
    row.defect_detail = s.defect_detail
    row.quality_score = s.quality_score
    row.ts_hours = s.ts_hours

    db.commit()
    return SaveResponse(sheetId=sheet_id, stepId=row.id)

@router.get("/search", response_model=list[RowRead])
def search_setup_sheets(
    sheet_id: int | None = Query(default=None),
    machine_no: str | None = Query(default=None),
    step_name: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    조건은 모두 옵션. 없으면 전체.
    - sheet_id:
    - machine_no: 부분 일치 (ilike)
    - step_name:
    """
    q = db.query(SetupSheetAll)
    if sheet_id is not None:
        q = q.filter(SetupSheetAll.sheet_id == sheet_id)
    if machine_no:
        like = f"%{machine_no}%"
        q = q.filter(SetupSheetAll.machine_no.ilike(like))
    if step_name:
        q = q.filter(SetupSheetAll.step_name == step_name)

    q = q.order_by(SetupSheetAll.sheet_id.asc(), SetupSheetAll.id.asc())
    return q.all()

@router.delete("/{id}", status_code=204)
def delete_setup_row(id: int, db: Session = Depends(get_db)):
    row = db.get(SetupSheetAll, id)
    if not row:
        raise HTTPException(status_code=404, detail="row not found")
    db.delete(row)
    db.commit()
    return None
