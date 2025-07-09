# backend/routers/progress.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db.database import SessionLocal
from models.Progress import Progress
from schemas.progress import ProgressCreate, ProgressOut
from typing import List

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ✅ 진척도 저장
@router.post("/", response_model=ProgressOut)
def create_progress(data: ProgressCreate, db: Session = Depends(get_db)):
    new_progress = Progress(**data.dict())
    db.add(new_progress)
    db.commit()
    db.refresh(new_progress)
    return new_progress

# ✅ 전체 진척도 조회
@router.get("/", response_model=List[ProgressOut])
def get_all_progress(db: Session = Depends(get_db)):
    return db.query(Progress).order_by(Progress.created_at.desc()).all()
