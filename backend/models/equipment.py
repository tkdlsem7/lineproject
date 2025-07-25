# 📁 backend/models/equipment.py
from sqlalchemy import Column, Integer, String, Date, Float  # ← 수정: Float 사용
from backend.db.database import Base

class Equipment(Base):
    """
    equip_progress 테이블 ORM 매핑
    DB 실물 컬럼 기준으로만 정의해
    SELECT 시 UndefinedColumn 오류를 방지합니다.
    """
    __tablename__ = "equip_progress"
    __table_args__ = {"extend_existing": True}


    no = Column(Integer, primary_key=True, index=True)


    machine_id = Column(String, unique=True, index=True, nullable=False)  # ← 수정: machine_id 를 unique 키로
    slot_code  = Column(String, nullable=False)                           # ← 수정: unique 제거 (필요시 다시 추가)


    progress      = Column(Float, nullable=False, default=0.0)            # ← 수정: Integer → Float
    manager       = Column(String, nullable=False)
    shipping_date = Column(Date,   nullable=False)
    customer      = Column(String, nullable=False)
    note          = Column(String, nullable=True)                         # ← 수정: nullable=True (현재 DB 빈값 허용)
    site          = Column(String, nullable=True)
