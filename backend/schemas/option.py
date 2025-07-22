# backend/schemas/option.py
from pydantic import BaseModel

# ✅ 공통 필드 묶어서 기본형
class OptionBase(BaseModel):
    name: str
    # description: str | None = None   # 필드가 늘면 여기서 확장

# ✅ 생성용: 클라이언트가 POST 로 보낼 때 사용
class OptionCreate(OptionBase):
    pass  # 추가 필드 없으면 그대로 둡니다.

# ✅ 읽기용: DB → 클라이언트 응답
class OptionRead(OptionBase):
    class Config:
        orm_mode = True   # SQLAlchemy 객체 → Pydantic 자동 변환
