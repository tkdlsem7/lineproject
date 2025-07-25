# 📁 backend/schemas/equipment.py
# DB 테이블: equip_progress
# ────────────────────────────────────────────────────────────────
# no | machine_id | progress | manager | shipping_date |
# customer | slot_code | note
# ────────────────────────────────────────────────────────────────
from datetime import date
from pydantic import BaseModel, Field, ConfigDict   # Pydantic v2 용
# v1 을 쓰신다면: from pydantic import BaseModel, Field

# ────────────────────────────────────────────────────────────────
# 공통 스키마 (DB ↔ API)
# ────────────────────────────────────────────────────────────────
class _EquipmentBase(BaseModel):
    # DB 컬럼과 1:1 대응 ─ CamelCase <-> snake_case 변환은 alias 로 해결
    machine_id: str = Field(alias="machineId")
    progress: float = Field(ge=0, le=100)
    shipping_date: date = Field(alias="shippingDate")
    customer: str | None = None
    manager: str | None = None
    slot_code: str | None = Field(default=None, alias="slotCode")
    note: str | None = None
    site : str | None = None

    # Pydantic v2 설정
    model_config = ConfigDict(
        populate_by_name=True,   # alias 이름으로도 직렬화/역직렬화
        from_attributes=True,    # ORM 객체 → 모델 변환 허용
        str_strip_whitespace=True,
    )
    # ── Pydantic v1 을 사용한다면 위 model_config 블록을 지우고
    # class Config:
    #     orm_mode = True
    #     allow_population_by_field_name = True
    # 로 교체하세요. 🟡

# ────────────────────────────────────────────────────────────────
# ▶ 요청용  (POST /api/equipment)  ─ EquipmentIn
# ────────────────────────────────────────────────────────────────
class EquipmentIn(_EquipmentBase):
    """
    INSERT·UPDATE 공통 입력 모델
    - primary key(no) 는 클라이언트가 보내지 않음
    """
    pass


# ────────────────────────────────────────────────────────────────
# ▶ 응답용  (GET /api/equipment/{machine_id})  ─ EquipmentOut
# ────────────────────────────────────────────────────────────────
class EquipmentOut(_EquipmentBase):
    # DB primary key 'no' 컬럼을 API 응답에서는 id 로 노출
    id: int = Field(alias="no")

    # created_at / updated_at 컬럼이 👉 **현재 DB에 없으므로 제거**
    # 추후 타임스탬프 컬럼을 추가하면 여기에 다시 넣고
    # Alembic 마이그레이션으로 DB도 확장하면 됩니다.
