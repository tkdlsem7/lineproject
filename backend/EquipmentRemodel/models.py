from __future__ import annotations

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from backend.db.database import Base
from backend.Calender.models import EquipmentMaster, ScheduleEvent


class RemodelOptionMaster(Base):
    __tablename__ = "remodel_option_master"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)
    option_name = Column(Text, nullable=False, unique=True)

    checklist_items = relationship(
        "EquipmentRemodelChecklist",
        back_populates="option",
    )


class EquipmentRemodel(Base):
    __tablename__ = "equipment_remodel"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    machine_id = Column(Text, nullable=False, index=True)
    remodel_manager = Column(Text, nullable=True)
    remodel_time_text = Column(Text, nullable=True)  # 기존 컬럼 유지(하위 호환용)
    model = Column(Text, nullable=True)

    manager_feedback = Column(Text, nullable=True)
    delay_reason = Column(Text, nullable=True)

    result_status = Column(Text, nullable=True)
    improvement_status = Column(Text, nullable=True)
    remodel_progress_status = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    checklist_items = relationship(
        "EquipmentRemodelChecklist",
        back_populates="remodel",
        cascade="all, delete-orphan",
    )


class EquipmentRemodelChecklist(Base):
    __tablename__ = "equipment_remodel_checklist"

    id = Column(BigInteger, primary_key=True, autoincrement=True, index=True)

    remodel_id = Column(
        BigInteger,
        ForeignKey("equipment_remodel.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    option_id = Column(
        BigInteger,
        ForeignKey("remodel_option_master.id"),
        nullable=False,
        index=True,
    )

    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    remodel_time_text = Column(Text, nullable=True)

    is_completed = Column(Boolean, nullable=False, default=False)
    completed_at = Column(DateTime, nullable=True)

    delay_reason = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    remodel = relationship("EquipmentRemodel", back_populates="checklist_items")
    option = relationship("RemodelOptionMaster", back_populates="checklist_items")


__all__ = [
    "EquipmentMaster",
    "ScheduleEvent",
    "RemodelOptionMaster",
    "EquipmentRemodel",
    "EquipmentRemodelChecklist",
]
