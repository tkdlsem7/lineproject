from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from db.database import SessionLocal  # ✅ 현재 구조에서 올바른 경로
from models.user import User          # ✅ models도 마찬가지로 직접 import



router = APIRouter()

class LoginRequest(BaseModel):
    id: str
    pw: str

# 🔐 로그인 라우터
@router.post("/login")
def login(request: LoginRequest):
    db: Session = SessionLocal()

    # ✅ 이 코드가 여기 들어가야 함
    user = db.query(User).filter(User.id == request.id).first()

    if not user or user.pw != request.pw:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    return {
        "token": "your_jwt_token_here",  # 향후 JWT 적용 시
        "user_no": user.no,              # 실제 필드에 맞게
        "username": user.name,
    }

