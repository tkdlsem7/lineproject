# backend/models/setup_sheet_all.py
from __future__ import annotations
from datetime import date, datetime
from sqlalchemy import Column, BigInteger, Text, Date, Numeric, Integer, DateTime, func
from ..db.database import Base  # 프로젝트의 공용 Base

class SetupSheetAll(Base):
    __tablename__ = "setup_sheet_all"

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    sheet_id = Column(BigInteger, nullable=False, index=True)

    # NULL = 헤더(공통), 값 있으면 스텝행
    step_name = Column(Text, nullable=True)

    # 공통 정보(헤더용)
    model_name = Column(Text, nullable=True)
    car_no = Column(Text, nullable=True)
    machine_no = Column(Text, nullable=True)
    sn = Column(Text, nullable=True)
    chiller_sn = Column(Text, nullable=True)
    setup_start_date = Column(Date, nullable=True)
    setup_end_date = Column(Date, nullable=True)

    # 스텝별 입력
    setup_hours = Column(Numeric(6, 2), nullable=True)   # >= 0 권장(제약은 테이블에 설정돼 있음)
    defect_detail = Column(Text, nullable=True)          # NULL/빈칸 허용
    quality_score = Column(Integer, nullable=True)       # 0~100 권장
    ts_hours = Column(Numeric(6, 2), nullable=True)      # >= 0 권장

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
