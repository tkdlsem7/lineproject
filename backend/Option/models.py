# backend/Option/models.py
from sqlalchemy import Column, Integer, String

# ✅ 공용 Base (프로젝트의 db.database에 있는 Base 사용)
from backend.db.database import Base

class TaskOption(Base):
    __tablename__ = "task_option"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    # 스키마와 일치: 1~20자, 유니크
    name = Column(String(20), nullable=False, unique=True, index=True)

    def __repr__(self) -> str:
        return f"<TaskOption id={self.id} name={self.name!r}>"
