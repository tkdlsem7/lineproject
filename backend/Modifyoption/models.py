from sqlalchemy import Column, Integer, String, Float
from ..db.database import Base

class Checklist(Base):
    __tablename__ = "checklist"  # 🟣 실제 테이블명과 동일하게

    no = Column(Integer, primary_key=True, index=True, autoincrement=True)
    option = Column(String(20), nullable=False, index=True)
    step = Column(Integer, nullable=False, index=True)
    item = Column(String(200), nullable=False)
    hours = Column(Float, nullable=False)
