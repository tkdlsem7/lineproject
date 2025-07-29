# 📁 backend/routers/optionlog.py
from datetime import datetime
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

# ──────────────────────────────────────────────────────────
from backend.db.database     import get_db
from backend.models.optionlog import optionlog         # 🔄 PascalCase 로 수정
from backend.schemas.optionlog import (
    OptionLogCreate,
    OptionLogOut,
)

router = APIRouter(prefix="/optionlog", tags=["optionlog"])

# ▶ POST /optionlog/input
@router.post(
    "/input",
    response_model=OptionLogOut,          # 응답으로 Pydantic 스키마 사용
    status_code=status.HTTP_201_CREATED,
)
def create_option_log(
    payload: OptionLogCreate,             # ✔️ 요청 바디 검증용 Pydantic
    db: Session = Depends(get_db),
):
    """
    옵션 체크리스트 저장 로그 생성
    - JSON Body → OptionLogCreate 로 검증
    - SQLAlchemy 모델(OptionLog) 인스턴스 생성 후 DB 저장
    - 저장된 ORM 객체를 그대로 반환(→ Pydantic이 자동 직렬화)
    """
    # ① SQLAlchemy 모델 인스턴스 생성
    new_log = optionlog(                  # 🔄 ORM 사용
        machine_no=payload.machine_no,
        manager=payload.manager,
        updated_at=datetime.utcnow(),     # DB 컬럼이 TIMESTAMP(UTC) 라고 가정
    )

    # ② DB 세션 작업
    db.add(new_log)
    db.commit()
    db.refresh(new_log)                   # PK(id)·타임스탬프 반영

    # ③ ORM 객체 반환 → OptionLogOut(orm_mode=True) 가 JSON 직렬화
    return new_log
