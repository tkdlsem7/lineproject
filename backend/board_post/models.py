# backend/board_post/models.py
from __future__ import annotations
from datetime import datetime
from sqlalchemy import Column, BigInteger, String, Text, DateTime, func
from backend.db.database import Base  # 프로젝트에 있는 공용 Base 사용

class BoardPost(Base):
    """
    board_posts 테이블 매핑
    no(bigint, identity) | title(varchar200) | content(text)
    author_name(varchar100) | created_at(timestamptz, default now())
    category(varchar30)
    """
    __tablename__ = "board_posts"

    no = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    content = Column(Text, nullable=False)
    author_name = Column(String(100), nullable=False, default="미등록")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    category = Column(String(30), nullable=False, default="일반")
