from sqlalchemy import Column, String,Integer
from backend.db.database import Base

class options(Base) :
    __tablename__ = "task_option"

    id  = Column(Integer, primary_key=True, index=True)
    name =  Column(String, nullable=False)