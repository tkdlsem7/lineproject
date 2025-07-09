# backend/create_db.py
from backend.db.database import Base, engine
from models.Progress import Progress

# 모든 테이블 생성
Base.metadata.create_all(bind=engine)
