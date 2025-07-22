"""
✅ Checklist 라우터
    - GET /api/checklist/{option_name}  : 옵션별 전체 체크리스트 조회
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.models.OptionDetail import Checklist
from backend.schemas.OptionDetail import ChecklistRead

router = APIRouter(
    prefix="/checklist",      # 최종 경로: /api/checklist/...
    tags=["checklist"],
)


@router.get("/{option_name}", response_model=list[ChecklistRead])
def read_checklist_by_option(
    option_name: str,
    db: Session = Depends(get_db),
):  
    print(f"[DEBUG] 요청된 option_name: {option_name}")
    """
    특정 옵션(option_name)의 모든 체크리스트 항목을 조회합니다.
    - 정렬: step ➜ no
    - 결과가 없으면 404
    """
    items = (
        db.query(Checklist)
        .filter(Checklist.option == option_name)
        .order_by(Checklist.step, Checklist.no)
        .all()
    )

    if not items:
        return []  # → HTTP 200 + 빈 배열 반환

    return items