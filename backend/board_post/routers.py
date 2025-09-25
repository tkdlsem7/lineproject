# backend/board_post/routers.py
from __future__ import annotations
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from . import models, schemas

# 프로젝트 공용 get_db 사용
try:
    from ..db.database import get_db  # 권장: 이미 있으시면 이걸 사용
except ImportError:
    # 없으면 아래 간단 버전 사용
    from ..db.database import SessionLocal
    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

router = APIRouter(prefix="/board", tags=["board"])

@router.post("", response_model=schemas.BoardOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: schemas.BoardCreate, db: Session = Depends(get_db), request: Request = None):
    """
    글 등록: 프론트에서 보내는 {title, content, category} 를 받아 저장.
    author_name 은 로그인 연동 전까지 '미등록'으로 기록합니다.
    (JWT 연동이 있다면 current_user.name 으로 교체하세요.)
    """
    author_name = "미등록"

    post = models.BoardPost(
        title=payload.title.strip(),
        content=payload.content.strip(),
        category=payload.category.strip(),
        author_name=author_name,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("", response_model=List[schemas.BoardOut])
def list_posts(db: Session = Depends(get_db)):
    return (
        db.query(models.BoardPost)
        .order_by(models.BoardPost.no.desc())
        .all()
    )

# ✅ 상세
@router.get("/{no}", response_model=schemas.BoardOut)
def get_post(no: int, db: Session = Depends(get_db)):
    post = db.query(models.BoardPost).get(no)
    if not post:
        raise HTTPException(status_code=404, detail="not found")
    return post


# ✅ 수정
@router.put("/{no}", response_model=schemas.BoardOut)
def update_post(no: int, payload: schemas.BoardUpdate, db: Session = Depends(get_db)):
    post = db.query(models.BoardPost).get(no)
    if not post:
        raise HTTPException(status_code=404, detail="not found")
    post.title = payload.title.strip()
    post.content = payload.content.strip()
    post.category = payload.category.strip()
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{no}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(no: int, db: Session = Depends(get_db)):
    post = db.query(models.BoardPost).get(no)
    if not post:
        raise HTTPException(status_code=404, detail="not found")
    db.delete(post)
    db.commit()
    return