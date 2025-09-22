# app/models/troubleshoot.py
from sqlalchemy import Column, Integer, String, Text, SmallInteger, DateTime, func
from ..db.database import Base  # 프로젝트 공용 Base 사용

class TroubleShootEntry(Base):
    __tablename__ = "troubleshoot_entry"

    id = Column(Integer, primary_key=True, index=True)
    month = Column(SmallInteger, nullable=False)
    model = Column(String(20), nullable=False)
    diff = Column(Integer, nullable=False)
    unit_no = Column(Integer, nullable=False)

    hw_sw = Column(String(10), nullable=False)              # 'H/W' | 'S/W'
    step = Column(String(40), nullable=False)               # 콤보 값
    defect_category = Column(String(40), nullable=False)    # 콤보 값

    location = Column(String(50), nullable=False)
    defect = Column(String(50), nullable=False)
    defect_type = Column(String(50), nullable=False)
    detail = Column(Text, nullable=True)
    photo_ref = Column(String(50), nullable=True)

    ts_minutes = Column(Integer, nullable=False, default=0)
    reporter = Column(String(50), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
