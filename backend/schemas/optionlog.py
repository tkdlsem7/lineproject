# 📁 backend/schemas/optionlog.py
from datetime import datetime
from pydantic import BaseModel

class OptionLogCreate(BaseModel):
    machine_no: str
    manager: str

class OptionLogOut(OptionLogCreate):
    id: int
    manager : str
    updated_at: datetime

    class Config:
        orm_mode = True        # ← SQLAlchemy 객체 → JSON 자동 변환
