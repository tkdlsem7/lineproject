# backend/board_post/schemas.py
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field
from typing import List

class BoardCreate(BaseModel):
    title: str = Field(..., max_length=200)
    content: str
    category: str = Field(..., max_length=30)


class BoardUpdate(BaseModel):
    title: str = Field(..., max_length=200)
    content: str
    category: str = Field(..., max_length=30)

class BoardOut(BaseModel):
    no: int
    title: str
    content: str
    author_name: str
    created_at: datetime
    category: str

    class Config:
        from_attributes = True  # (pydantic v2) = orm_mode

# ✅ 메인 요약 카드용: 필요한 필드만 슬림하게
class BoardBrief(BaseModel):
    no: int
    title: str
    author_name: str
    created_at: datetime
    category: str
    class Config:
        from_attributes = True

# ✅ 응답 모양: notices / changes에 따로 담아서 반환
class BoardSummary(BaseModel):
    notices: List[BoardBrief]
    changes: List[BoardBrief]