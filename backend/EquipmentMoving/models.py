# backend/EquipmentMoving/models.py
# equip_progress는 MainDashboard에서 이미 선언되어 있으므로 재사용
from backend.MainDashboard.models import EquipProgress
from sqlalchemy import Column, Integer, String, DateTime, text
from backend.db.database import Base
from backend.MainDashboard.models import EquipmentMoveLog

__all__ = ["EquipProgress"]


__all__ = ["EquipmentMoveLog"]