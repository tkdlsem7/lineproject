# 📁 backend/routers/equipment_progress.py
# ────────────────────────────────────────────────────────────────
# ▸ DELETE /api/equipment_progress/{machine_id}
#     - 기능 : machine_id 가 일치하는 행 1건 삭제
#     - 응답 : 204 No Content (성공) / 404 Not Found (행 없음)
# ────────────────────────────────────────────────────────────────

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.equip_progress import EquipProgress      # ⚙️ SQLAlchemy 모델

router = APIRouter(
    prefix="/equipment_log",      # 최종 경로: /api/equipment_progress
    tags=["equipment_log"],
)

@router.delete("/{machine_id}/delete", status_code=status.HTTP_204_NO_CONTENT)
def delete_progress_by_machine_id(
    machine_id: str,                  # ← Path 파라미터 (예: "j-01-03")
    db: Session = Depends(get_db),    # ← DB 세션 의존성
) -> Response:
    """
    1) machine_id 로 단일 행 조회
    2) 없으면 404, 있으면 DELETE → 204 No Content
    """
    # (1) 해당 행 검색
    row = (
        db.query(EquipProgress)
          .filter(EquipProgress.machine_id == machine_id)
          .first()
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"machine_id '{machine_id}'에 해당하는 레코드가 없습니다.",
        )

    # (2) 삭제 → 커밋
    db.delete(row)
    db.commit()

    # (3) 본문 없이 204 반환
    return Response(status_code=status.HTTP_204_NO_CONTENT)
