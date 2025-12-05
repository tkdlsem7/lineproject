# backend/LogBrowser/routers.py
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import inspect, MetaData, Table, select, or_, and_, func, String
from backend.deps import get_db
from .schemas import TableMeta, RowsResponse

router = APIRouter(prefix="/logs", tags=["LogBrowser"])

DATE_CANDIDATES = ["updated_at", "created_at", "moved_at",
                   "receipt_date", "shipping_date", "logged_at", "timestamp"]

def _insp(db: Session):
    return inspect(db.bind)

def _reflect(db: Session, schema: str, name: str) -> Table:
    md = MetaData()
    return Table(name, md, autoload_with=db.bind, schema=schema)

@router.get("/tables", response_model=List[TableMeta])
def list_tables(
    schema: str = Query("public", description="스키마명 (기본: public)"),
    db: Session = Depends(get_db),
):
    insp = _insp(db)
    table_names = set(insp.get_table_names(schema=schema))
    view_names  = set(insp.get_view_names(schema=schema))  # 뷰도 포함
    names = sorted(table_names | view_names)

    out: List[TableMeta] = []
    for name in names:
        cols_meta = insp.get_columns(name, schema=schema)  # 테이블/뷰 모두 동작
        column_names = [c["name"] for c in cols_meta]
        date_fields = [c for c in DATE_CANDIDATES if c in column_names]
        out.append(TableMeta(name=name, columns=column_names, date_fields=date_fields))
    return out

@router.get("/rows", response_model=RowsResponse)
def get_rows(
    table: str = Query(..., description="테이블/뷰 이름"),
    schema: str = Query("public", description="스키마명 (기본: public)"),
    q: Optional[str] = Query(None, description="간단 검색(텍스트 컬럼 대상 ilike)"),
    date_from: Optional[str] = Query(None, description="YYYY-MM-DD"),
    date_to: Optional[str] = Query(None, description="YYYY-MM-DD (포함)"),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    insp = _insp(db)
    names = set(insp.get_table_names(schema=schema)) | set(insp.get_view_names(schema=schema))
    if table not in names:
        raise HTTPException(status_code=404, detail=f"{schema}.{table} 없음")

    tbl = _reflect(db, schema, table)
    cols_meta = insp.get_columns(table, schema=schema)
    col_names = [c["name"] for c in cols_meta]

    # 날짜/텍스트 컬럼
    date_col = next((c for c in DATE_CANDIDATES if c in col_names), None)
    def is_text(cmeta) -> bool:
        return any(k in str(cmeta["type"]).upper() for k in ("CHAR", "TEXT", "VARCHAR"))
    text_cols = [c["name"] for c in cols_meta if is_text(c)]

    # 조건
    conds = []
    if q and text_cols:
        conds.append(or_(*[tbl.c[c].cast(String).ilike(f"%{q}%") for c in text_cols]))
    if date_col and (date_from or date_to):
        d = getattr(tbl.c, date_col)
        if date_from: conds.append(d >= date_from)
        if date_to:   conds.append(d <= date_to)
    where_clause = and_(*conds) if conds else None

    # 정렬
    if date_col:
        order_by = getattr(tbl.c, date_col).desc()
    elif "id" in col_names:
        order_by = tbl.c.id.desc()
    elif "no" in col_names:
        order_by = tbl.c.no.desc()
    else:
        order_by = getattr(tbl.c, col_names[0]).desc()

    # total(필터 포함)
    count_stmt = select(func.count()).select_from(tbl)
    if where_clause is not None:
        count_stmt = count_stmt.where(where_clause)
    total = db.execute(count_stmt).scalar_one()

    # 데이터
    stmt = select(tbl)
    if where_clause is not None:
        stmt = stmt.where(where_clause)
    stmt = stmt.order_by(order_by).limit(limit).offset(offset)
    rows = [dict(r) for r in db.execute(stmt).mappings().all()]

    return RowsResponse(columns=col_names, rows=rows, total=total)
