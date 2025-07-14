# 📁 backend/routers/equip_progress.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.equip_progress import EquipProgress  # SQLAlchemy model
from backend.schemas._init_ import EquipProgressOut   # Pydantic schema

router = APIRouter(prefix="/equip-progress", tags=["EquipProgress"])

@router.get("/", response_model=list[EquipProgressOut])
def read_all_progress(db: Session = Depends(get_db)):
    rows = db.query(EquipProgress).all()
    return rows    #  ← rows 가 비어 있어도 [] 반환


