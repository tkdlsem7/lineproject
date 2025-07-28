# 📁 backend/schemas/machine_info.py
from pydantic import BaseModel

class MachineInfoOut(BaseModel):
    machine_id: str
    site: str
    slot_code: str

    class Config:
        orm_mode = True
