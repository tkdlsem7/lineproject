# backend/routers/options.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from backend.db.database import get_db
# equip_progress 모델 임포트
from backend.models.equip_progress import EquipProgress

router = APIRouter(
    prefix="/options",
    tags=["options"],
)

# 요청 바디 스키마: 업데이트할 progress 값
class ProgressUpdate(BaseModel):
    percent: float

# 응답 스키마: 업데이트된 progress 반환
class ProgressResponse(BaseModel):
    id: str
    percent: float

@router.patch("/{machine_id}/percent", response_model=ProgressResponse)
def update_progress(
    machine_id: str,
    payload: ProgressUpdate,
    db: Session = Depends(get_db),
):
    """
    특정 장비(machine_id)의 progress 필드를 업데이트합니다.
    - 요청: PATCH /api/options/{machine_id}/percent
    - Body: { percent: float }
    - 반환: { id: machine_id, percent: updated_progress }
    """
    # 1) 다운로드될 equip_progress 레코드 조회
    record = (
        db.query(EquipProgress)
        .filter(EquipProgress.machine_id == machine_id)
        .first()
    )
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"EquipProgress with machine_id '{machine_id}' not found",
        )

    # 2) progress 업데이트
    record.progress = payload.percent
    db.commit()
    db.refresh(record)

    # 3) 응답
    return ProgressResponse(id=machine_id, percent=record.progress)

# main.py 또는 app.py에서 라우터 등록 예시:
# app.include_router(router, prefix="/api")  # prefix '/api/options' 최종 경로
