# backend/Main/models.py
# ------------------------------------------------------------
# 메인 전용 라우터에서 사용할 모델을 "재정의 없이" 재사용합니다.
# (중복 선언을 피하기 위해 기존 MainDashboard.models 를 import 후 재수출)
# ------------------------------------------------------------
from backend.MainDashboard.models import EquipProgress, EquipmentLog
from backend.EquipmentInfo.models import EquipmentReceiptLog

__all__ = ["EquipProgress", "EquipmentLog", "EquipmentReceiptLog"]