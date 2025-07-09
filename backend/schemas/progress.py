# backend/schemas/progress.py
from pydantic import BaseModel
from datetime import datetime

class ProgressCreate(BaseModel):
    equipment_id: str
    progress: int
    created_by: str

class ProgressOut(ProgressCreate):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
