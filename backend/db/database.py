# 📁 backend/db/db.py
"""
SQLAlchemy 엔진·세션 공용 모듈
- .env 에서 DATABASE_URL 을 읽어와 Engine 생성
- FastAPI Depends 용 get_db() 제공
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Generator, Annotated

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# ──────────────────────────────────────────────────────────────
# 1. .env 로드
#    - backend/db/db.py → parent.parent = backend/       (.env 위치)
#    - 루트(lineproject)에 .env 를 두었다면 경로 수정
# ──────────────────────────────────────────────────────────────
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=False)

# ──────────────────────────────────────────────────────────────
# 2. DATABASE_URL 가져오기
#    예: postgresql+psycopg2://user:password@localhost:5432/mesdb
# ──────────────────────────────────────────────────────────────
DATABASE_URL: str | None = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "❌ DATABASE_URL 환경변수를 찾을 수 없습니다.\n"
        f"   • .env 위치: {ENV_PATH}\n"
        "   • 예시:\n"
        "     DATABASE_URL=postgresql+psycopg2://user:password@localhost:5432/mesdb\n"
    )

# ──────────────────────────────────────────────────────────────
# 3. SQLAlchemy 엔진 및 세션 설정
#    - pool_pre_ping=True : DB 연결 끊김 자동 감지
#    - echo=False         : 필요시 True 로 바꿔 SQL 로그 확인
# ──────────────────────────────────────────────────────────────
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    echo=False,
    future=True,          # SQLAlchemy 2.x 스타일
)

SessionLocal: sessionmaker = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)

# 베이스 모델 (ORM 클래스 선언 시 상속)
Base = declarative_base()

# ──────────────────────────────────────────────────────────────
# 4. FastAPI Depends 용 세션 제너레이터
#    - 라우터에서:  db: Session = Depends(get_db)
# ──────────────────────────────────────────────────────────────
from sqlalchemy.orm import Session  # 순환 import 방지를 위해 맨 끝에

def get_db() -> Generator[Session, None, None]:
    """SQLAlchemy 세션을 생성·반납하는 의존성 함수"""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# __all__ 로 공개 객체 명시 (선택)
__all__ = ["engine", "SessionLocal", "Base", "get_db"]
