# Dashboard/models.py
from __future__ import annotations

from decimal import Decimal
from sqlalchemy import Column, Integer, String, Numeric, Date, Text, func, DateTime, text
from backend.db.database import Base

# ✅ equipment_remodel 테이블 재사용
#    경로가 다르면 이 import 경로만 실제 프로젝트 구조에 맞게 바꿔주세요.
from backend.EquipmentRemodel.models import EquipmentRemodel


class EquipProgress(Base):
    __tablename__ = "equip_progress"

    no = Column(Integer, primary_key=True, index=True, autoincrement=True)

    machine_id = Column(String(20), nullable=True, index=True)
    progress = Column(Numeric(5, 2), nullable=False, default=Decimal("0.00"))
    manager = Column(String(50), nullable=True)
    shipping_date = Column(Date, nullable=True)
    customer = Column(String(50), nullable=True)
    slot_code = Column(String(5), nullable=False, index=True)
    note = Column(Text, nullable=True)
    site = Column(String(30), nullable=True)
    serial_number = Column(String(50), nullable=True)
    status = Column(String(20), nullable=True)
    chiller_serial_number = Column(String(50), nullable=True)

    def __repr__(self) -> str:
        return (
            f"<EquipProgress slot={self.slot_code} "
            f"machine={self.machine_id} status={getattr(self, 'status', None)}>"
        )


class EquipmentLog(Base):
    __tablename__ = "equipment_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    action = Column(String(20), nullable=False)
    slot_code = Column(String(10), nullable=False)
    machine_id = Column(String(20), nullable=True)
    at = Column(Date, nullable=False, server_default=func.now())


class EquipmentMoveLog(Base):
    __tablename__ = "equipment_move_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column("machine_no", String(20), nullable=False)
    manager = Column(String(50), nullable=False, default="")
    move_date = Column(DateTime(timezone=False), nullable=False, server_default=func.now())
    from_slot = Column(String(10), nullable=False)
    to_slot = Column(String(10), nullable=False)
    from_site = Column(String(50), nullable=True)
    to_site = Column(String(50), nullable=True)


class EquipmentProgressLog(Base):
    __tablename__ = "equipment_progress_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_no = Column(String(20), nullable=False)
    manager = Column(String(50), nullable=False)
    progress = Column(Numeric(5, 2), nullable=False, server_default=text("0"))
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EquipmentShipmentLog(Base):
    __tablename__ = "equipment_shipment_log"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_no = Column(String(20), nullable=False)
    manager = Column(String(50), nullable=False)
    shipped_date = Column(Date, nullable=False)
    site = Column(String(30), nullable=False)
    slot = Column(String(5), nullable=True)
    customer = Column(String(50), nullable=False)
    progress = Column(Numeric(5, 2), nullable=True)
    serial_number = Column(String(50), nullable=True)


__all__ = [
    "EquipProgress",
    "EquipmentLog",
    "EquipmentMoveLog",
    "EquipmentProgressLog",
    "EquipmentShipmentLog",
    "EquipmentRemodel",
]
