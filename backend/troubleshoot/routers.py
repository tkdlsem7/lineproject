# app/routers/troubleshoot.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from .models import TroubleShootEntry
from .schemas import TroubleShootCreate, TroubleShootRead

# get_db 의존성: 프로젝트에 이미 있으면 그걸 쓰고,
# 없으면 아래 fallback을 사용하세요.
try:
    from ..db.database import get_db  # 기존 프로젝트에 있을 가능성 높음
except Exception:
    from ..db.database import SessionLocal
    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

router = APIRouter(prefix="/troubleshoot", tags=["TroubleShoot"])

@router.post("/", response_model=TroubleShootRead)
def create_troubleshoot(payload: TroubleShootCreate, db: Session = Depends(get_db)):
    obj = TroubleShootEntry(**payload.dict())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.get("/search", response_model=list[TroubleShootRead])
def search_by_model_diff_unit(
    model: str = Query(..., description="모델"),
    diff: int = Query(..., description="차분"),
    unit_no: int = Query(..., description="호기"),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(TroubleShootEntry)
        .filter(
            TroubleShootEntry.model == model,
            TroubleShootEntry.diff == diff,
            TroubleShootEntry.unit_no == unit_no,
        )
        .order_by(TroubleShootEntry.created_at.desc())
        .all()
    )
    return rows
