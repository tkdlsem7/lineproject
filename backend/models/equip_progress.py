# ▶ SQLAlchemy ORM 클래스 예시
from sqlalchemy import Column, Integer, String
from backend.db.database import Base            # ❗️ Base는 db/database.py에서 가져옵니다

class EquipProgress(Base):
    __tablename__ = "equip_progress"            # 실제 DB 테이블 이름

    no         = Column(Integer, primary_key=True, index=True)
    slot_code  = Column(String,  unique=True, index=True)
    machine_id = Column(String, nullable=False)

    # (선택) created_at, updated_at 등 추가 가능
