# 📁 backend/routers/equip_progress.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func                          # ← 대소문자 무시용(선택)
from backend.db.database import get_db
from backend.models.equip_progress import EquipProgress
from backend.schemas.schema import EquipProgressBase

router = APIRouter(prefix="/equip-progress", tags=["EquipProgress"])

# ────────────────────────────────────────────────────────────
# ▶ GET /equip-progress/
#    - ?site=본사  → site == '본사' 인 행만
#    - 파라미터 없음 → 전체
# ────────────────────────────────────────────────────────────
@router.get("/", response_model=list[EquipProgressBase])
def read_progress(
    site: str | None = Query(
        default=None,
        description="본사 / 부항리 / 진우리 중 하나(없으면 전체)",
        examples={"본사": {"summary": "본사 조회", "value": "본사"}},
    ),
    db: Session = Depends(get_db),
):
    """
    • site 파라미터가 주어지면 EquipProgress.site 컬럼과 **완전 일치**하는
      행만 필터링해서 반환한다.
    • site가 없거나 빈 문자열이면 모든 레코드를 반환한다.
    """

    # 1) 기본 쿼리
    query = db.query(EquipProgress)

    # 2) 필터링 (site 값이 있을 때만)
    if site:
        # ───────────── Case-Insensitive 매칭을 원한다면 아래 주석 해제 ─────────────
        # query = query.filter(func.lower(EquipProgress.site) == site.lower())
        # ────────────────────────────────────────────────────────────────────
        query = query.filter(EquipProgress.site == site)

    rows = query.all()

    # (선택) 존재하지 않는 site를 요청했을 때 404 대신 빈 배열을 주려면 그대로 반환
    # if site and not rows:
    #     raise HTTPException(status_code=404, detail=f"'{site}' 섹션에 데이터가 없습니다.")

    return rows  # rows 가 없으면 []
