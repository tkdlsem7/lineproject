# backend/db/db.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# .env 로드
load_dotenv()

# DATABASE_URL 가져오기
DATABASE_URL = os.getenv("DATABASE_URL")

# SQLAlchemy 엔진 및 세션 구성
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 모델 정의 시 사용할 베이스
Base = declarative_base()
