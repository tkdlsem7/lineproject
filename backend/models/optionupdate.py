# backend/models/Option.py
from sqlalchemy import Column, String, Float
from backend.db.database import Base

class Option(Base):
    __tablename__ = "options"

    # 고유 식별자 (예: UUID 또는 이름 기반 키)
    id = Column(String, primary_key=True, index=True)
    # 옵션명 (사용자에게 보여주는 이름)
    name = Column(String, nullable=False)
    # 진척도 퍼센트 (0.0 ~ 100.0)
    percent = Column(Float, default=0.0, nullable=False)

    def __repr__(self):
        return f"<Option id={self.id!r} name={self.name!r} percent={self.percent!r}>"
