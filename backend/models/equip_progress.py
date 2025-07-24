# ▶ SQLAlchemy ORM 클래스 예시
from sqlalchemy import Column, Integer, String, Date
from backend.db.database import Base  # ❗️ Base는 db/database.py에서 가져옵니다

class EquipProgress(Base):
    __tablename__ = "equip_progress"  # 실제 DB 테이블 이름

    no           = Column(Integer, primary_key=True, index=True)         # 고유 번호
    slot_code    = Column(String, unique=True, index=True)               # 슬롯 위치 코드 (예: B6)
    manager    = Column(String, nullable=False)
    machine_id   = Column(String, nullable=False)                        # 장비 ID (예: J-07-02)
    progress     = Column(Integer, nullable=False)                       # 진척도 (%)
    shipping_date = Column(Date, nullable=False)                         # 출하 예정일 (YYYY-MM-DD)

    # (선택) created_at, updated_at 등을 넣고 싶다면 여기 추가 가능
