from sqlalchemy import Column, Integer, String, Date, Float  # ← 수정: Float 사용
from backend.db.database import Base


class EquipmentMoveLog(Base):
    __tablename__ = 'equipment_move_log'

    id         = Column(Integer, primary_key=True, autoincrement=True)
    machine_no = Column(String, nullable=False)
    manager    = Column(String, nullable=True)
    move_date  = Column(Date)
    from_slot  = Column(String)
    to_slot    = Column(String)
    from_site  = Column(String)
    to_site    = Column(String)
