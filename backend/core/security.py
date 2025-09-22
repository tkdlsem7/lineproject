# backend/core/security.py
# ─────────────────────────────────────────────────────────────
# 비밀번호 해시/검증, JWT 발급/검증 유틸
# ─────────────────────────────────────────────────────────────
import os
from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import jwt

# bcrypt 해시 컨텍스트
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 환경변수 또는 기본값(개발용) - .env에 넣는 것을 권장
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG    = os.getenv("JWT_ALG", "HS256")
JWT_EX_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))

def hash_password(plain: str) -> str:
    """평문 비밀번호를 bcrypt로 해시"""
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    """평문과 해시를 비교 검증"""
    return pwd_context.verify(plain, hashed)

def create_access_token(subject: str, extra: Optional[dict] = None) -> str:
    """
    JWT 생성
    - subject: 토큰 소유자(예: 로그인 id)
    - extra: name 등 추가 클레임
    """
    to_encode = {"sub": subject, "exp": datetime.utcnow() + timedelta(minutes=JWT_EX_MIN)}
    if extra:
        to_encode.update(extra)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)
