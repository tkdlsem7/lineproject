from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..db.database import get_db
from .models import SetupSheetAll
from .schemas import SaveRequest, SaveResponse

router = APIRouter(prefix="/setup-sheets", tags=["setup-sheets"])

def _next_sheet_id(db: Session) -> int:
    return int((db.query(func.coalesce(func.max(SetupSheetAll.sheet_id), 0)).scalar() or 0) + 1)

@router.post("/save", response_model=SaveResponse)
def save_setup_sheet(payload: SaveRequest, db: Session = Depends(get_db)):
    # 1) sheet_id 결정
    sheet_id = payload.sheetId if payload.sheetId is not None else _next_sheet_id(db)

    # 2) 행 생성 or 업데이트
    s = payload.step
    if s.id:  # ← 행 id가 오면 그 행을 업데이트
        row = db.query(SetupSheetAll).get(s.id)
        if row is None:
            raise HTTPException(status_code=404, detail="row not found")
        if row.sheet_id != sheet_id:
            raise HTTPException(status_code=400, detail="sheetId mismatch")
    else:
        # ← id가 없으면 무조건 새 행 INSERT (이게 포인트)
        row = SetupSheetAll(sheet_id=sheet_id, step_name=s.step_name)
        db.add(row)
        db.flush()  # row.id 확보

    # 메타 + 스텝 값 채우기(한 줄에 저장)
    m = payload.meta
    row.model_name = m.model_name
    row.car_no = m.car_no
    row.machine_no = m.machine_no
    row.sn = m.sn
    row.chiller_sn = m.chiller_sn
    row.setup_start_date = m.setup_start_date
    row.setup_end_date = m.setup_end_date

    row.step_name = s.step_name
    row.setup_hours = s.setup_hours
    row.defect_detail = s.defect_detail
    row.quality_score = s.quality_score
    row.ts_hours = s.ts_hours

    db.commit()
    return SaveResponse(sheetId=sheet_id, headerId=row.id, stepId=row.id)
