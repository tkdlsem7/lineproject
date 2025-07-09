# backend/models/progress.py
from sqlalchemy import Column, Integer, String, DateTime
from db.database import Base
from datetime import datetime

class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(String, index=True)
    progress = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String)
