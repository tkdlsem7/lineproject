# backend/board_post/schemas.py
from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel, Field

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
