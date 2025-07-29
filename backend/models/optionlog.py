from sqlalchemy import Column, String,Integer,Date
from backend.db.database import Base

class optionlog(Base) :
    __tablename__ = "equipment_progress_log"

    id = Column(Integer, primary_key=True, index=True)
    machine_no = Column(String, nullable = False)
    manager =  Column(String, nullable = False)
    updated_at = Column(Date, nullable = False)