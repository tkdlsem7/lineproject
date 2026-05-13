# backend/Calender/models.py
from sqlalchemy import (
    Column,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from backend.db.database import Base


# -------------------------------------------------------------------
# 기존 코드 호환용
# - EquipmentInfo / setup 쪽에서 아직 EquipmentSchedule 을 import 함
# - 그래서 이 클래스는 반드시 남겨둠
# -------------------------------------------------------------------
class EquipmentSchedule(Base):
    __tablename__ = "equipment_schedule"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    machine_no = Column(Text, nullable=False, index=True)

    # 기존 일정 조회/설정 로직 호환용으로 가장 많이 쓰는 날짜 컬럼만 유지
    start_date = Column(Date, nullable=True, index=True)
    end_date = Column(Date, nullable=True, index=True)

    note = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )


# -------------------------------------------------------------------
# 새 일정 허브용 장비 마스터
# -------------------------------------------------------------------
class EquipmentMaster(Base):
    __tablename__ = "equipment_master"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    machine_no = Column(Text, nullable=False, unique=True, index=True)
    model = Column(Text, nullable=True)
    customer_name = Column(Text, nullable=True)
    stage_sn = Column(Text, nullable=True)
    loader_sn = Column(Text, nullable=True)
    cold_type = Column(Text, nullable=True)
    mani_type = Column(Text, nullable=True)
    current_status = Column(Text, nullable=True)
    is_shipped = Column(Boolean, nullable=False, server_default=text("false"))

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    events = relationship(
        "ScheduleEvent",
        back_populates="equipment",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# -------------------------------------------------------------------
# 업로드 파일 이력
# -------------------------------------------------------------------
class UploadFile(Base):
    __tablename__ = "upload_files"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    team_name = Column(Text, nullable=False)
    file_name = Column(Text, nullable=False)
    file_path = Column(Text, nullable=False)
    uploaded_by = Column(Text, nullable=True)
    upload_status = Column(
        Text,
        nullable=False,
        server_default=text("'uploaded'"),
    )
    message = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )


# -------------------------------------------------------------------
# 원본 행 저장
# -------------------------------------------------------------------
class ImportRawRow(Base):
    __tablename__ = "import_raw_rows"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    upload_file_id = Column(
        BigInteger,
        ForeignKey("upload_files.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sheet_name = Column(Text, nullable=False)
    row_no = Column(Integer, nullable=False)
    machine_no = Column(Text, nullable=True, index=True)
    raw_data = Column(JSONB, nullable=False)
    parse_status = Column(
        Text,
        nullable=False,
        server_default=text("'pending'"),
    )
    error_message = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )


# -------------------------------------------------------------------
# 통합 일정 이벤트
# -------------------------------------------------------------------
class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    equipment_id = Column(
        BigInteger,
        ForeignKey("equipment_master.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_type = Column(Text, nullable=False, index=True)   # production / shipment / remodel / interface / mani / opus / chiller
    event_type = Column(Text, nullable=False)                # setting_start / qc_end / interface_in ...
    event_name = Column(Text, nullable=False)                # 화면 표시용 이름
    event_date = Column(Date, nullable=False, index=True)

    status = Column(Text, nullable=True)                     # 예정 / 완료 / 변경 / 지연
    team_name = Column(Text, nullable=True)
    mo_no = Column(Text, nullable=True)
    extra_data = Column(JSONB, nullable=True)

    source_file_id = Column(BigInteger, nullable=True)
    source_sheet_name = Column(Text, nullable=True)
    source_row_no = Column(Integer, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )
    updated_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    equipment = relationship("EquipmentMaster", back_populates="events")


# -------------------------------------------------------------------
# 일정 변경 이력
# -------------------------------------------------------------------
class ScheduleEventHistory(Base):
    __tablename__ = "schedule_event_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)

    equipment_id = Column(
        BigInteger,
        ForeignKey("equipment_master.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source_type = Column(Text, nullable=False, index=True)
    event_type = Column(Text, nullable=False)
    event_name = Column(Text, nullable=False)

    team_name = Column(Text, nullable=True)
    mo_no = Column(Text, nullable=True)
    change_type = Column(
        Text,
        nullable=False,
        server_default=text("'updated'"),
    )

    before_event_date = Column(Date, nullable=True)
    before_status = Column(Text, nullable=True)
    before_extra_data = Column(JSONB, nullable=True)
    before_source_file_id = Column(BigInteger, nullable=True)
    before_source_sheet_name = Column(Text, nullable=True)
    before_source_row_no = Column(Integer, nullable=True)

    after_event_date = Column(Date, nullable=True)
    after_status = Column(Text, nullable=True)
    after_extra_data = Column(JSONB, nullable=True)
    after_source_file_id = Column(BigInteger, nullable=True)
    after_source_sheet_name = Column(Text, nullable=True)
    after_source_row_no = Column(Integer, nullable=True)

    changed_by = Column(Text, nullable=True)
    change_reason = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        nullable=False,
        server_default=text("CURRENT_TIMESTAMP"),
    )

    equipment = relationship("EquipmentMaster")


__all__ = [
    "EquipmentSchedule",
    "EquipmentMaster",
    "UploadFile",
    "ImportRawRow",
    "ScheduleEvent",
    "ScheduleEventHistory",
]