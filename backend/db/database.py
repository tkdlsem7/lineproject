# 📄 backend/db/database.py  (db.py도 동일 내용으로 교체)
# ─────────────────────────────────────────────────────────────
# 이 모듈은 더 이상 엔진/세션/베이스를 "생성"하지 않습니다.
# deps.py와 Login.models 에서 이미 생성된 것을 재노출만 합니다.
# ─────────────────────────────────────────────────────────────
from ..deps import engine, SessionLocal        # ✅ engine/세션은 deps.py 단일 출처
from ..Login.models import Base                # ✅ Base도 한 곳(로그인 모델의 Base)을 사용

from sqlalchemy.orm import Session

def get_db() -> "Session":
    """FastAPI Depends용 세션 팩토리 (기존 사용처 호환)"""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

__all__ = ["engine", "SessionLocal", "Base", "get_db"]
