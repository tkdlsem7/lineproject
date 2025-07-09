# models.py
from sqlalchemy import Column, Integer, String
from database import Base

class User(Base):
    __tablename__ = "users"

    no = Column(Integer, primary_key=True, index=True)
    id = Column(String, unique=True, index=True)
    pw = Column(String)  # 비밀번호는 해시 저장이 안전
    name = Column(String)
