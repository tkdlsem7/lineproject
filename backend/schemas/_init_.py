# 📁 backend/schemas.py (추가)
from pydantic import BaseModel
class EquipProgressOut(BaseModel):
    slot_code: str
    machine_id: str
    class Config:
        orm_mode = True
