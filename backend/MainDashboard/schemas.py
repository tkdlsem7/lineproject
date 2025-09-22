# ------------------------------------------------------------
# Dashboard/schemas.py
# - Pydantic v1/v2 모두 호환
# - 필드 정규화(트림/대문자화/상태값 매핑) 포함
# - 옵션 콤마문자열 → 리스트 파싱 지원
# - 출하 로그(INSERT 용) 스키마 포함
# ------------------------------------------------------------
from __future__ import annotations
from datetime import date
from typing import Optional, List, Literal, TypeVar, Any

# ----- pydantic v1/v2 호환 처리 -----
try:
    # v2
    from pydantic import BaseModel, Field, ConfigDict
    from pydantic import field_validator as _field_validator  # type: ignore[attr-defined]
    _IS_V2 = True
except Exception:  # pragma: no cover
    # v1
    from pydantic import BaseModel, Field  # type: ignore
    from pydantic.class_validators import validator as _field_validator  # type: ignore
    _IS_V2 = False


# ----- 공통 타입 별칭 -----
# (DB/프론트 모두 문자열로 쓰므로 별칭만 둡니다)
MachineId = str
SlotCode   = str
SiteStr    = str
SerialStr  = str

# ----- 유틸: 문자열 정리 -----
def _clean_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    v2 = v.strip()
    return v2 if v2 != "" else None

def _upper(v: Optional[str]) -> Optional[str]:
    v = _clean_str(v)
    return v.upper() if v is not None else None

def _status_normalize(v: Optional[str]) -> Optional[Literal["ok", "hold", "가능", "불가능"]]:
    if v is None:
        return None
    s = v.strip().lower()
    if s in {"ok", "가능", "가능함", "가능해요", "가능합니다"}:
        return "ok"  # 저장은 일관되게 ok/hold 권장
    if s in {"hold", "보류", "불가", "불가능"}:
        return "hold"
    return None


# ============================================================
#  장비 정보 저장(수정) 요청
# ============================================================
class EquipmentSaveRequest(BaseModel):
    """대시보드의 장비 카드에서 정보 저장/수정 요청 바디"""

    machine_id: MachineId = Field(..., description="예: j-11-10")
    shipping_date: date
    manager: Optional[str] = ""
    customer: Optional[str] = ""
    slot_code: SlotCode = Field(..., description="예: B3, C7")
    site: Optional[SiteStr] = None
    serial_number: Optional[SerialStr] = None
    # 저장은 내부적으로 ok/hold 로 맞추는 것을 권장
    status: Optional[Literal["가능", "불가능", "ok", "hold"]] = "불가능"
    note: Optional[str] = None

    # 옵션(아이디 기반 저장 / 대체 여부)
    option_ids: Optional[List[int]] = None
    replace_options: Optional[bool] = None

    # ✅ 콤마 문자열로 받은 옵션(예: "hot, cold, t5825")
    option_codes_str: Optional[str] = None
    # ✅ 파싱된 옵션 코드 리스트(백엔드 로직에서 사용하기 편함)
    option_codes: Optional[List[str]] = None

    # ---------- 정규화(트림/대문자/상태) ----------
    @_field_validator("machine_id")
    def _v_machine_id(cls, v: str) -> str:
        v2 = v.strip()
        if not v2:
            raise ValueError("machine_id is empty")
        # 간단한 허용 문자 체크(영문/숫자/-, _)
        for ch in v2:
            if not (ch.isalnum() or ch in "-_"):
                raise ValueError("machine_id has invalid character")
        return v2

    @_field_validator("slot_code")
    def _v_slot_code(cls, v: str) -> str:
        v2 = _upper(v)
        if not v2:
            raise ValueError("slot_code is empty")
        # 예: A1, B10 형식(문자 1 + 숫자 1~2)만 강제하고 싶다면 주석 해제
        # import re
        # if not re.match(r"^[A-Z][0-9]{1,2}$", v2):
        #     raise ValueError("slot_code format invalid (expected like B3, C10)")
        return v2

    @_field_validator("manager", "customer", "site", "serial_number", "note")
    def _v_trim_optional(cls, v: Optional[str]) -> Optional[str]:
        return _clean_str(v)

    @_field_validator("status")
    def _v_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        norm = _status_normalize(v)
        # 저장 포맷은 ok/hold 로 통일
        return norm or "hold"

    @_field_validator("option_codes", mode="before")
    def _v_option_codes_before(cls, v: Any, values: Any) -> Any:
        """
        v2: mode="before" 로 option_codes_str → option_codes
        v1: 동일 데코레이터 사용 가능(동작은 입력 전 처리)
        """
        if v is not None:
            return v
        raw = values.get("option_codes_str")
        if raw and isinstance(raw, str):
            toks = [t.strip() for t in raw.split(",")]
            toks = [t for t in toks if t]
            return toks or None
        return None

    # v2 ORM 호환 / v1 orm_mode
    if _IS_V2:
        model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    else:  # pydantic v1
        class Config:
            orm_mode = True


# ============================================================
#  대시보드 슬롯 단건 응답
# ============================================================
class SlotOut(BaseModel):
    """대시보드 슬롯 응답 DTO"""
    id: str = Field(..., description="슬롯 식별자 (=slot_code)")
    slot_code: str
    machine_id: Optional[str] = None
    progress: float = 0
    shipping_date: Optional[date] = None
    manager: Optional[str] = None
    site: Optional[str] = None

    # 프리필에 필요한 필드들
    customer: Optional[str] = None
    serial_number: Optional[str] = None
    note: Optional[str] = None
    # 내부 저장 포맷: ok/hold 로 통일(표시는 자유)
    status: Optional[str] = None

    if _IS_V2:
        model_config = ConfigDict(from_attributes=True)
    else:  # pydantic v1
        class Config:
            orm_mode = True


# ============================================================
#  장비 이동 요청
# ============================================================
class MoveRequest(BaseModel):
    """장비 이동 요청 바디"""
    dst_slot_code: str = Field(
        ...,
        min_length=2,
        max_length=5,
        description="대상 슬롯 코드 (예: C7)",
    )

    @_field_validator("dst_slot_code")
    def _v_dst_slot(cls, v: str) -> str:
        v2 = _upper(v)
        if not v2:
            raise ValueError("dst_slot_code is empty")
        return v2


# ============================================================
#  출하 로그(INSERT 용) - equipment_shipment_log 테이블과 1:1
# ============================================================
class ShipmentCreate(BaseModel):
    """출하 처리 저장 요청 바디"""
    machine_no: str = Field(..., max_length=20)
    manager: str = Field(..., max_length=50)
    shipped_date: date
    site: str = Field(..., max_length=30)
    slot: Optional[str] = Field(default=None, max_length=5)
    customer: str = Field(..., max_length=50)

    @_field_validator("machine_no", "manager", "site", "slot", "customer")
    def _v_trim(cls, v: Optional[str]) -> Optional[str]:
        return _clean_str(v)

    if _IS_V2:
        model_config = ConfigDict(protected_namespaces=())
    else:
        class Config:
            anystr_strip_whitespace = True


class ShipmentOut(BaseModel):
    """출하 처리 응답"""
    id: int
    machine_no: str
    manager: str
    shipped_date: date
    site: str
    slot: Optional[str] = None
    customer: str

    if _IS_V2:
        model_config = ConfigDict(from_attributes=True)
    else:
        class Config:
            orm_mode = True


# ============================================================
#  단순 OK 응답
# ============================================================
class OK(BaseModel):
    status: str = "ok"
