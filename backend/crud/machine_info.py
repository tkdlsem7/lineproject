# 📁 backend/crud/machine_info.py
from sqlalchemy.orm import Session
from backend.models.equip_progress import EquipProgress

def get_machines_by_site(db: Session, site: str):
    """선택 Site 의 장비 목록 반환 (site='' 이면 전체)"""
    q = db.query(EquipProgress)
    if site:
        q = q.filter(EquipProgress.site == site)
    return q.all()
