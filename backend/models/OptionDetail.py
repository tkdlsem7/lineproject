from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from backend.db.database import Base


class Checklist(Base):
    __tablename__ = "checklist"

    no = Column(Integer, primary_key=True, index=True, autoincrement=True)
    option = Column(
        String, 
        index=True,
        nullable=False,
    )
    step = Column(Integer, nullable=False)
    item = Column(String, nullable=False)
    hours = Column(Float, nullable=False)

    def __repr__(self) -> str:
        return f"<Checklist no={self.no} option={self.option} step={self.step}>"
