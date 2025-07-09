from sqlalchemy import Column, Integer, String
from db.database import Base

class User(Base):
    __tablename__ = "users"  # ✅ 테이블 이름과 정확히 일치

    no = Column(Integer, primary_key=True, index=True)
    id = Column(String, unique=True, nullable=False)
    pw = Column(String, nullable=False)
    name = Column(String, nullable=False)
