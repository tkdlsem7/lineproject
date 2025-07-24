# 📁 backend/models/equipment_log.py
from sqlalchemy import Column, Integer, String, Date
from backend.db.database import Base

class EquipmentLog(Base):
    """
    장비 입·출고 이력(equipment_log) 테이블
    """
    __tablename__ = "equipment_log"

    id           = Column(Integer, primary_key=True, index=True)
    machine_no   = Column(String,  index=True, nullable=False)  # ex) "J-07-02"
    manager      = Column(String,  nullable=False)              # 담당자
    receive_date = Column(Date,    nullable=True)               # 입고일
    ship_date    = Column(Date,    nullable=True)               # 출하일
