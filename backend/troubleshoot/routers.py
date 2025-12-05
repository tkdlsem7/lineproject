# app/routers/troubleshoot.py
from fastapi import APIRouter, Depends, Query, HTTPException, Response
from sqlalchemy.orm import Session
from datetime import date, datetime

from .models import TroubleShootEntry
from .schemas import TroubleShootCreate, TroubleShootRead, TroubleShootUpdate

# get_db 의존성
try:
    from ..db.database import get_db
except Exception:
    from ..db.database import SessionLocal
    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

router = APIRouter(prefix="/troubleshoot", tags=["TroubleShoot"])

# ─────────────────────────────────────────────
# 유틸: month(int) ↔ date(YYYY-MM-01) 변환
# ─────────────────────────────────────────────
def _month_int_to_date(month_int: int, base_dt: datetime | None = None) -> date:
    """월 숫자(1~12)를 YYYY-MM-01 date로 변환. 연도는 base_dt(없으면 현재)에서 가져옴."""
    m = max(1, min(12, int(month_int)))
    y = (base_dt or datetime.utcnow()).year
    return date(y, m, 1)

def _to_read(obj: TroubleShootEntry) -> dict:
    """DB 객체 → API 응답(dict). month는 int로 되돌려준다."""
    return {
        "id": obj.id,
        "month": obj.month.month if obj.month else None,  # date -> int
        "machine_no": obj.machine_no,
        "hw_sw": obj.hw_sw,
        "step": obj.step,
        "defect_category": obj.defect_category,
        "location": obj.location,
        "defect": obj.defect,
        "defect_type": obj.defect_type,
        "detail": obj.detail,
        "photo_ref": obj.photo_ref,
        "ts_minutes": obj.ts_minutes,
        "reporter": obj.reporter,
        "created_at": obj.created_at,
    }

@router.post("/", response_model=TroubleShootRead)
def create_troubleshoot(payload: TroubleShootCreate, db: Session = Depends(get_db)):
    data = payload.dict()
    # month(int) -> date 저장
    data["month"] = _month_int_to_date(payload.month)
    obj = TroubleShootEntry(**data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_read(obj)

# ✅ machine_no 단일 파라미터로 조회 (응답에서 month를 int로 내려줌)
@router.get("/search", response_model=list[TroubleShootRead])
def search_by_machine_no(
    machine_no: str = Query(..., description="장비번호(machine_no)"),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(TroubleShootEntry)
        .filter(TroubleShootEntry.machine_no == machine_no)
        .order_by(TroubleShootEntry.created_at.desc())
        .all()
    )
    return [_to_read(r) for r in rows]

@router.get("/{id}", response_model=TroubleShootRead)
def get_one(id: int, db: Session = Depends(get_db)):
    obj = db.get(TroubleShootEntry, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Troubleshoot not found")
    return _to_read(obj)

@router.put("/{id}", response_model=TroubleShootRead)
def update_one(id: int, payload: TroubleShootUpdate, db: Session = Depends(get_db)):
    obj = db.get(TroubleShootEntry, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Troubleshoot not found")

    # Pydantic v2/v1 호환
    try:
        data = payload.model_dump(exclude_unset=True)
    except Exception:
        data = payload.dict(exclude_unset=True)

    # month(int) 갱신 오면 date로 변환 (연도는 기존 created_at 기준)
    if "month" in data and data["month"] is not None:
        data["month"] = _month_int_to_date(int(data["month"]), base_dt=obj.created_at)

    for k, v in data.items():
        setattr(obj, k, v)

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return _to_read(obj)

@router.delete("/{id}", status_code=204)
def delete_one(id: int, db: Session = Depends(get_db)):
    obj = db.get(TroubleShootEntry, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Troubleshoot not found")
    db.delete(obj)
    db.commit()
    return Response(status_code=204)
