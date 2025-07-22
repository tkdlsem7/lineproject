from pydantic import BaseModel


# ✅ 공통 필드
class ChecklistBase(BaseModel):
    option: str
    step: int
    item: str
    hours: float


# ✅ 생성(POST)용 – PK 제외
class ChecklistCreate(ChecklistBase):
    pass


# ✅ 읽기(GET)용 – PK 포함
class ChecklistRead(ChecklistBase):
    no: int

    class Config:
        orm_mode = True
