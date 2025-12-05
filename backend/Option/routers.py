# backend/Option/routers.py
# ------------------------------------------------------------
# /api/task-options
# - 목록(검색) / 단건조회 / 생성(대소문자 무시 중복) / 수정 / 삭제
# - 모든 import는 패키지 상대경로 사용
# ------------------------------------------------------------
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from .models import TaskOption
from .schemas import OptionCreate, OptionUpdate, OptionOut
from backend.deps import get_db  # ✅ 루트의 deps.py를 상대경로로

router = APIRouter(prefix="/task-options", tags=["Task Options"])

def _exists_name_ci(db: Session, name: str, except_id: int | None = None) -> bool:
    """이름 존재 여부(대소문자 무시), except_id는 자신 제외"""
    q = select(TaskOption).where(func.lower(TaskOption.name) == func.lower(name))
    if except_id is not None:
        q = q.where(TaskOption.id != except_id)
    return db.execute(q).scalars().first() is not None

@router.get("", response_model=List[OptionOut])
def list_options(
    db: Session = Depends(get_db),
    q: str = Query("", description="검색어(포함/대소문자 무시)"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
):
    stmt = select(TaskOption)
    if q:
        stmt = stmt.where(TaskOption.name.ilike(f"%{q}%"))
    stmt = stmt.order_by(TaskOption.id.desc()).limit(limit).offset(offset)
    rows = db.execute(stmt).scalars().all()
    return rows

@router.get("/{opt_id}", response_model=OptionOut)
def get_option(opt_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    row = db.get(TaskOption, opt_id)
    if not row:
        raise HTTPException(status_code=404, detail="옵션을 찾을 수 없습니다.")
    return row

@router.post("", response_model=OptionOut, status_code=status.HTTP_201_CREATED)
def create_option(payload: OptionCreate, db: Session = Depends(get_db)):
    if _exists_name_ci(db, payload.name):
        raise HTTPException(status_code=409, detail="이미 존재하는 옵션명입니다.")
    row = TaskOption(name=payload.name.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.put("/{opt_id}", response_model=OptionOut)
def update_option(
    opt_id: int = Path(..., ge=1),
    payload: OptionUpdate = ...,
    db: Session = Depends(get_db),
):
    row = db.get(TaskOption, opt_id)
    if not row:
        raise HTTPException(status_code=404, detail="옵션을 찾을 수 없습니다.")

    if _exists_name_ci(db, payload.name, except_id=opt_id):
        raise HTTPException(status_code=409, detail="이미 존재하는 옵션명입니다.")

    row.name = payload.name.strip()
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.delete("/{opt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_option(opt_id: int = Path(..., ge=1), db: Session = Depends(get_db)):
    row = db.get(TaskOption, opt_id)
    if not row:
        raise HTTPException(status_code=404, detail="옵션을 찾을 수 없습니다.")
    db.delete(row)
    db.commit()
    return None
