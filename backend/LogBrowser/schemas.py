# backend/LogBrowser/schemas.py
try:
    from pydantic import BaseModel, Field, ConfigDict
    _V2 = True
except Exception:  # pydantic v1 호환
    from pydantic import BaseModel, Field  # type: ignore
    _V2 = False

class TableMeta(BaseModel):
    name: str
    columns: list[str]
    date_fields: list[str] = []

    if _V2:
        model_config = ConfigDict(from_attributes=True)
    else:
        class Config: orm_mode = True

class RowsResponse(BaseModel):
    columns: list[str]
    rows: list[dict]
    total: int
