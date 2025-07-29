# 📁 backend/routers/auth.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.db.database import SessionLocal
from backend.models.user import User

router = APIRouter()

# ───────────────────────────────
# 요청 · 응답 스키마
# ───────────────────────────────
class LoginRequest(BaseModel):
    id: str
    pw: str

class LoginResponse(BaseModel):
    token: str
    user_no: int
    manager: str          # ✅ 담당자 이름만 보내기


# 🔐 로그인 라우터
@router.post("/login", response_model=LoginResponse)
def login(request: LoginRequest):
    db: Session = SessionLocal()

    # 사용자 조회
    user = db.query(User).filter(User.id == request.id).first()
    if not user or user.pw != request.pw:
        raise HTTPException(
            status_code=401,
            detail="아이디 또는 비밀번호가 올바르지 않습니다."
        )

    # 응답: token·user_no·manager
    return {
        "token": "your_jwt_token_here",   # JWT 적용 전 임시 값
        "user_no": user.no,
        "manager": user.name,             # ✅ 프런트에서 필요로 하는 필드
    }
