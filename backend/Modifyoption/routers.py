# backend/Checklist/routers.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from backend.deps import get_db
from .models import Checklist
from .schemas import ChecklistOut, ChecklistCreate, ChecklistUpdate

router = APIRouter(prefix="/checklist", tags=["Checklist"])

@router.get("", response_model=List[ChecklistOut])
def list_checklist(
    option: Optional[str] = Query(None, description="옵션명 (예: hot)"),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    stmt = select(Checklist)
    if option:
        stmt = stmt.where(func.lower(Checklist.option) == func.lower(option))
    stmt = stmt.order_by(Checklist.step.asc(), Checklist.no.asc()).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()
    return rows

@router.post("", response_model=ChecklistOut, status_code=status.HTTP_201_CREATED)
def create_checklist(payload: ChecklistCreate, db: Session = Depends(get_db)):
    row = Checklist(
        option=payload.option.strip(),
        step=payload.step,
        item=payload.item.strip(),
        hours=float(payload.hours),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.put("/{no}", response_model=ChecklistOut)
def update_checklist(
    no: int = Path(..., ge=1),
    payload: ChecklistUpdate = ...,
    db: Session = Depends(get_db),
):
    row = db.get(Checklist, no)
    if not row:
        raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")

    row.step = payload.step
    row.item = payload.item.strip()
    row.hours = float(payload.hours)

    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.delete("/{no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist(no: int = Path(..., ge=1), db: Session = Depends(get_db)):
    row = db.get(Checklist, no)
    if not row:
        raise HTTPException(status_code=404, detail="대상을 찾을 수 없습니다.")
    db.delete(row)
    db.commit()
    return None
