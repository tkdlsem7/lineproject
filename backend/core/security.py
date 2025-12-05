# backend/core/security.py
# ─────────────────────────────────────────────────────────────
# 비밀번호 해시/검증, JWT 발급/검증 유틸
# ─────────────────────────────────────────────────────────────
import os
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from passlib.context import CryptContext
from jose import jwt

# ─────────────────────────────────────────────
# 비밀번호 해시: pbkdf2_sha256 사용
#  - bcrypt 는 서버 환경에서 버그나서 500 터졌음
# ─────────────────────────────────────────────
pwd_context = CryptContext(
    schemes=["pbkdf2_sha256"],  # 🔴 bcrypt 대신 이거 하나만 사용
    deprecated="auto",
)

# ─────────────────────────────────────────────
# JWT 설정
# ─────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG    = os.getenv("JWT_ALG", "HS256")
JWT_EX_MIN = int(os.getenv("JWT_EXPIRE_MINUTES", "120"))


def hash_password(plain: str) -> str:
    """평문 비밀번호를 해시"""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """평문과 해시를 비교 검증"""
    return pwd_context.verify(plain, hashed)


def create_access_token(subject: str, extra: Optional[Dict[str, Any]] = None) -> str:
    """
    JWT 생성
    - subject: 토큰 소유자(예: 로그인 id)
    - extra: name 등 추가 클레임
    """
    to_encode: Dict[str, Any] = {
        "sub": subject,
        "exp": datetime.utcnow() + timedelta(minutes=JWT_EX_MIN),
    }
    if extra:
        to_encode.update(extra)
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)
