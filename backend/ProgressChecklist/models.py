# backend/ProgressChecklist/models.py
from __future__ import annotations

from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.sql import func
from backend.db.database import Base

# checklist 테이블은 Modifyoption.models의 것을 재사용
from backend.Modifyoption.models import Checklist

__all__ = ["Checklist", "EquipmentChecklistResult"]


class EquipmentChecklistResult(Base):
    __tablename__ = "equipment_checklist_result"

    no = Column(Integer, primary_key=True, autoincrement=True)  # PK면 index=True 불필요
    machine_id = Column(String(20), nullable=False, index=True)
    option = Column(String(50), nullable=False, index=True)
    # ARRAY 기본값은 서버 기본식으로 주는 게 안전합니다.
    checked_steps = Column(ARRAY(Integer), nullable=False, server_default=text("'{}'"))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    __table_args__ = (
        UniqueConstraint("machine_id", "option", name="uq_ecr_machine_option"),
    )
