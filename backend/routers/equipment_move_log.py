from datetime import date
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.models.move_log import EquipmentMoveLog   # ← SQLAlchemy 모델
from backend.schemas.move_log import MoveLogIn

router = APIRouter(prefix='/equipment_move_log', tags=['equipment_move_log'])

@router.post('/bulk', status_code=status.HTTP_201_CREATED)
def bulk_insert(payload: list[MoveLogIn], db: Session = Depends(get_db)):
    for item in payload:
        db.add(
            EquipmentMoveLog(
                machine_no=item.machine_id,
                manager=item.manager,
                move_date=date.today(),
                from_slot=item.from_slot,
                to_slot=item.to_slot,
                from_site=item.from_site,
                to_site=item.to_site,
            )
        )
    db.commit()
    return {'inserted': len(payload)}
