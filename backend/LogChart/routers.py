# backend/LogChart/routers.py
from __future__ import annotations
from collections import defaultdict, Counter
from datetime import date, datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from backend.db.database import get_db
from .schemas import (
    LeadCycleStats, StepStats, StepStatItem,
    DefectStats, KeyCount, MonthlyFlow, MonthFlowItem, LeadStageStats,
)
from .models import (
    EquipProgress, EquipmentLog, EquipmentMoveLog, EquipmentProgressLog, EquipmentShipmentLog,
    EquipmentReceiptLog, EquipmentOption, User, Checklist, TaskOption, EquipmentChecklistResult,
    SetupSheetAll, TroubleShootEntry
)

router = APIRouter(prefix="/logcharts", tags=["LogCharts"])

# ─────────────────────────────────────────────
# 공통 유틸
# ─────────────────────────────────────────────
def pick_mid_column(model):
  for name in ("unit_no", "machine_no", "machine_id"):
    if hasattr(model, name):
      return getattr(model, name)
  return None

def month_range(month_ym: str) -> Tuple[date, date]:
  try:
    y, m = month_ym.split("-")
    y, m = int(y), int(m)
    start = date(y, m, 1)
    end = date(y + (m // 12), (m % 12) + 1, 1)
    return start, end
  except Exception:
    raise HTTPException(400, f"Invalid month: {month_ym} (use YYYY-MM)")

def ym_list(from_month: str, to_month: str) -> List[str]:
  s, _ = month_range(from_month)
  _, e = month_range(to_month)
  cur = s
  out: List[str] = []
  while cur < e:
    out.append(cur.strftime("%Y-%m"))
    cur = date(cur.year + (cur.month // 12), (cur.month % 12) + 1, 1)
  return out

def apply_site_slot_filters(stmt, model, site: str, building: str):
  conds = []
  if hasattr(model, "site") and site and site != "ALL":
    conds.append(getattr(model, "site") == site)
  if hasattr(model, "slot") and building and building != "ALL":
    conds.append(getattr(model, "slot").like(f"{building}%"))
  if hasattr(model, "slot_code") and building and building != "ALL":
    conds.append(getattr(model, "slot_code").like(f"{building}%"))
  if conds:
    stmt = stmt.where(and_(*conds))
  return stmt

def apply_mid_prefix(stmt, model, prefix: str):
  if not prefix:
    return stmt
  for col_name in ("machine_no", "unit_no", "machine_id"):
    if hasattr(model, col_name):
      col = getattr(model, col_name)
      return stmt.where(col.like(f"{prefix}-%"))
  return stmt

def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
  if dt is None:
    return None
  return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt

def date_to_naive(dt_date: date) -> datetime:
  return datetime(dt_date.year, dt_date.month, dt_date.day)

# ─────────────────────────────────────────────
# 1) 리드/사이클타임 (참고 KPI)
# ─────────────────────────────────────────────
@router.get("/leadcycle", response_model=LeadCycleStats)
def get_lead_cycle_stats(
  from_month: str = Query(..., description="YYYY-MM"),
  to_month: str = Query(..., description="YYYY-MM"),
  site: str = Query("ALL"),
  building: str = Query("ALL"),
  line: str = Query("ALL"),
  mid_prefix: str = Query("", description="machine_no 앞자리 (예: 'j')"),
  db: Session = Depends(get_db),
):
  s_from, _ = month_range(from_month)
  _, e_to = month_range(to_month)

  rec_stmt = select(EquipmentReceiptLog.machine_no, EquipmentReceiptLog.receive_date).where(
    and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to)
  )
  rec_stmt = apply_site_slot_filters(rec_stmt, EquipmentReceiptLog, site, building)
  rec_stmt = apply_mid_prefix(rec_stmt, EquipmentReceiptLog, mid_prefix)
  rec_rows = db.execute(rec_stmt).all()

  ship_stmt = select(EquipmentShipmentLog.machine_no, EquipmentShipmentLog.shipped_date).where(
    and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to)
  )
  ship_stmt = apply_site_slot_filters(ship_stmt, EquipmentShipmentLog, site, building)
  ship_stmt = apply_mid_prefix(ship_stmt, EquipmentShipmentLog, mid_prefix)
  ship_rows = db.execute(ship_stmt).all()

  prog_stmt = select(EquipmentProgressLog.machine_no, EquipmentProgressLog.updated_at).where(
    and_(EquipmentProgressLog.updated_at >= date_to_naive(s_from),
         EquipmentProgressLog.updated_at <  date_to_naive(e_to))
  )
  prog_stmt = apply_mid_prefix(prog_stmt, EquipmentProgressLog, mid_prefix)
  prog_rows = db.execute(prog_stmt).all()

  received_at: Dict[str, date] = {}
  shipped_at: Dict[str, date] = {}
  for mid, rdt in rec_rows:
    if mid and rdt and (mid not in received_at or rdt < received_at[mid]):
      received_at[str(mid)] = rdt
  for mid, sdt in ship_rows:
    if mid and sdt and (mid not in shipped_at or sdt < shipped_at[mid]):
      shipped_at[str(mid)] = sdt

  first_last: Dict[str, Tuple[Optional[datetime], Optional[datetime]]] = {}
  for mid, ts in prog_rows:
    if not mid or not ts: continue
    mid = str(mid)
    st, ed = first_last.get(mid, (None, None))
    if st is None or ts < st: st = ts
    if ed is None or ts > ed: ed = ts
    first_last[mid] = (st, ed)

  lead_days: List[float] = []
  for mid, rdt in received_at.items():
    if mid in shipped_at:
      st = date_to_naive(rdt)
      ed = date_to_naive(shipped_at[mid])
      lead_days.append((ed - st).total_seconds() / 86400.0)

  cycle_days: List[float] = []
  for mid, (st, ed) in first_last.items():
    if st and ed and ed >= st:
      st_n = to_naive_utc(st); ed_n = to_naive_utc(ed)
      cycle_days.append((ed_n - st_n).total_seconds() / 86400.0)

  def agg(vals: List[float]) -> Tuple[float, float, float]:
    if not vals: return (0.0, 0.0, 0.0)
    return (sum(vals)/len(vals), max(vals), min(vals))

  lead_avg, lead_max, lead_min = agg(lead_days)
  cycle_avg, cycle_max, cycle_min = agg(cycle_days)

  return LeadCycleStats(
    lead_avg_days=round(lead_avg, 2), lead_min_days=round(lead_min, 2), lead_max_days=round(lead_max, 2),
    cycle_avg_days=round(cycle_avg, 2), cycle_min_days=round(cycle_min, 2), cycle_max_days=round(cycle_max, 2),
  )

# ─────────────────────────────────────────────
# 2) Step별 작업 공수
# ─────────────────────────────────────────────
@router.get("/steps", response_model=StepStats)
def get_step_stats(
  from_month: str = Query(..., description="YYYY-MM"),
  to_month: str = Query(..., description="YYYY-MM"),
  mid_prefix: str = Query("", description="machine_no 앞자리 (예: 'j')"),
  db: Session = Depends(get_db),
):
  s_from, _ = month_range(from_month)
  _, e_to = month_range(to_month)

  stmt = select(
    SetupSheetAll.step_name,
    SetupSheetAll.setup_hours,
    SetupSheetAll.ts_hours,
    SetupSheetAll.created_at,
  ).where(and_(SetupSheetAll.created_at >= s_from, SetupSheetAll.created_at < e_to))
  stmt = apply_mid_prefix(stmt, SetupSheetAll, mid_prefix)
  rows = db.execute(stmt).all()

  total_hours = 0.0
  acc: Dict[str, List[float]] = defaultdict(list)
  for step_name, setup_h, ts_h, _created in rows:
    step = (step_name or "").strip()
    hours = None
    if setup_h is not None: hours = float(setup_h)
    elif ts_h is not None:  hours = float(ts_h)
    if hours is None: continue
    total_hours += hours
    acc[step].append(hours)

  def to_item(step: str, vals: List[float]) -> StepStatItem:
    if not vals: return StepStatItem(step=step, count=0, avg_hours=0.0, max_hours=0.0, min_hours=0.0)
    return StepStatItem(
      step=step, count=len(vals),
      avg_hours=round(sum(vals)/len(vals), 2),
      max_hours=round(max(vals), 2),
      min_hours=round(min(vals), 2),
    )

  items = [to_item(k or "UNKNOWN", v) for k, v in acc.items()]
  return StepStats(total_hours=round(total_hours, 2), steps=sorted(items, key=lambda x: -x.avg_hours))

# ─────────────────────────────────────────────
# 3) 불량 현황 — ★ 수정 포인트: 월 필터를 'created_at 날짜 구간'으로 고정
# ─────────────────────────────────────────────
@router.get("/defects", response_model=DefectStats)
def get_defect_stats(
  from_month: str = Query(..., description="YYYY-MM"),
  to_month: str = Query(..., description="YYYY-MM"),
  mid_prefix: str = Query("", description="machine_no 앞자리 (예: 'j')"),
  db: Session = Depends(get_db),
):
  s_from, _ = month_range(from_month)
  _, e_to = month_range(to_month)

  mid_col = pick_mid_column(TroubleShootEntry)
  if mid_col is None:
    raise HTTPException(500, "TroubleShootEntry에 unit_no/machine_no/machine_id 컬럼이 없습니다.")

  base_cols = [
    mid_col.label("mid"),
    TroubleShootEntry.ts_minutes,
    TroubleShootEntry.defect_category,
    TroubleShootEntry.location,
    TroubleShootEntry.defect,
    TroubleShootEntry.defect_type,
    TroubleShootEntry.created_at,
  ]

  # ✅ 항상 created_at 날짜 구간으로 필터 (date vs int 충돌 방지)
  ts_stmt = select(*base_cols).where(
    and_(TroubleShootEntry.created_at >= s_from, TroubleShootEntry.created_at < e_to)
  )
  ts_stmt = apply_mid_prefix(ts_stmt, TroubleShootEntry, mid_prefix)

  ts_rows = db.execute(ts_stmt).all()

  by_machine = defaultdict(lambda: {"cnt": 0, "ts_min": 0.0})
  cats = Counter(); locs = Counter(); items = Counter(); types = Counter()
  for mid, ts_min, cat, loc, dft, dft_type, _dt in ts_rows:
    if not mid: continue
    key = str(mid)
    by_machine[key]["cnt"] += 1
    if ts_min: by_machine[key]["ts_min"] += float(ts_min)
    if cat: cats[cat] += 1
    if loc: locs[loc] += 1
    if dft: items[dft] += 1
    if dft_type: types[dft_type] += 1

  per_counts = [v["cnt"] for v in by_machine.values()]
  per_ts_hours = [(v["ts_min"] / 60.0) for v in by_machine.values()]

  def agg(vals: list[float]) -> tuple[float, float, float]:
    if not vals: return (0.0, 0.0, 0.0)
    return (sum(vals)/len(vals), max(vals), min(vals))

  cnt_avg, cnt_max, cnt_min = agg(per_counts)
  ts_avg, _ts_max, _ts_min = agg(per_ts_hours)

  return DefectStats(
    per_unit_avg=round(cnt_avg, 2),
    per_unit_max=round(cnt_max, 2),
    per_unit_min=round(cnt_min, 2),
    ts_time_per_unit_avg_hours=round(ts_avg, 2),
    incoming_quality_avg=None,
    incoming_quality_max=None,
    incoming_quality_min=None,
    by_category=[KeyCount(key=k, count=v) for k, v in cats.most_common()],
    by_location=[KeyCount(key=k, count=v) for k, v in locs.most_common()],
    by_item=[KeyCount(key=k, count=v) for k, v in items.most_common()],
    by_type=[KeyCount(key=k, count=v) for k, v in types.most_common()],
  )

# ─────────────────────────────────────────────
# 4) 월별 입/출하 & 회전율
# ─────────────────────────────────────────────
@router.get("/flows", response_model=MonthlyFlow)
def get_monthly_flows(
  from_month: str = Query(..., description="YYYY-MM"),
  to_month: str = Query(..., description="YYYY-MM"),
  site: str = Query("ALL"),
  building: str = Query("ALL"),
  line: str = Query("ALL"),
  mid_prefix: str = Query("", description="machine_no 앞자리 (예: 'j')"),
  db: Session = Depends(get_db),
):
  s_from, _ = month_range(from_month)
  _, e_to = month_range(to_month)

  rec_stmt = select(
    EquipmentReceiptLog.receive_date, EquipmentReceiptLog.site, EquipmentReceiptLog.slot
  ).where(and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to))
  rec_stmt = apply_site_slot_filters(rec_stmt, EquipmentReceiptLog, site, building)
  rec_stmt = apply_mid_prefix(rec_stmt, EquipmentReceiptLog, mid_prefix)
  rec_rows = db.execute(rec_stmt).all()

  ship_stmt = select(
    EquipmentShipmentLog.shipped_date, EquipmentShipmentLog.site, EquipmentShipmentLog.slot
  ).where(and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to))
  ship_stmt = apply_site_slot_filters(ship_stmt, EquipmentShipmentLog, site, building)
  ship_stmt = apply_mid_prefix(ship_stmt, EquipmentShipmentLog, mid_prefix)
  ship_rows = db.execute(ship_stmt).all()

  rec_by_ym = Counter()
  for (dt, _site, _slot) in rec_rows:
    if dt: rec_by_ym[dt.strftime("%Y-%m")] += 1

  ship_by_ym = Counter()
  for (dt, _site, _slot) in ship_rows:
    if dt: ship_by_ym[dt.strftime("%Y-%m")] += 1

  months: List[MonthFlowItem] = []
  rates: List[float] = []
  total_r = 0
  total_s = 0
  for ym in ym_list(from_month, to_month):
    r = rec_by_ym.get(ym, 0)
    s = ship_by_ym.get(ym, 0)
    total_r += r; total_s += s
    rate = (s / r * 100.0) if r > 0 else None
    if rate is not None: rates.append(rate)
    months.append(MonthFlowItem(month=ym, receipts=r, shipments=s, turnover_rate=rate))

  avg_rate = (sum(rates)/len(rates)) if rates else None
  max_rate = max(rates) if rates else None
  min_rate = min(rates) if rates else None

  return MonthlyFlow(
    total_receipts=total_r,
    total_shipments=total_s,
    avg_turnover_rate=(round(avg_rate, 2) if avg_rate is not None else None),
    max_turnover_rate=(round(max_rate, 2) if max_rate is not None else None),
    min_turnover_rate=(round(min_rate, 2) if min_rate is not None else None),
    months=months,
  )

# ─────────────────────────────────────────────
# 5) 리드 스테이지 평균
# ─────────────────────────────────────────────
@router.get("/leadstages", response_model=LeadStageStats)
def get_lead_stage_stats(
  from_month: str = Query(..., description="YYYY-MM"),
  to_month: str = Query(..., description="YYYY-MM"),
  mid_prefix: str = Query("", description="machine_no 앞자리 (예: 'j')"),
  db: Session = Depends(get_db),
):
  s_from, _ = month_range(from_month)
  _, e_to = month_range(to_month)

  rec_stmt = select(EquipmentReceiptLog.machine_no, EquipmentReceiptLog.receive_date).where(
    and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to)
  )
  rec_stmt = apply_mid_prefix(rec_stmt, EquipmentReceiptLog, mid_prefix)
  rec_rows = db.execute(rec_stmt).all()
  received_at: Dict[str, date] = {}
  for mid, rdt in rec_rows:
    if mid and rdt and (mid not in received_at or rdt < received_at[mid]):
      received_at[str(mid)] = rdt

  prog_stmt = select(
    EquipmentProgressLog.machine_no, EquipmentProgressLog.updated_at, EquipmentProgressLog.progress
  ).where(and_(EquipmentProgressLog.updated_at >= date_to_naive(s_from),
               EquipmentProgressLog.updated_at <  date_to_naive(e_to)))
  prog_stmt = apply_mid_prefix(prog_stmt, EquipmentProgressLog, mid_prefix)
  prog_rows = db.execute(prog_stmt).all()
  first_ts: Dict[str, datetime] = {}
  first_100_ts: Dict[str, datetime] = {}
  for mid, ts, prog in prog_rows:
    if not mid or not ts: continue
    mid = str(mid)
    if mid not in first_ts or ts < first_ts[mid]: first_ts[mid] = ts
    p = float(prog) if prog is not None else None
    if p is not None and p >= 100.0:
      if mid not in first_100_ts or ts < first_100_ts[mid]:
        first_100_ts[mid] = ts

  ship_stmt = select(EquipmentShipmentLog.machine_no, EquipmentShipmentLog.shipped_date).where(
    and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to)
  )
  ship_stmt = apply_mid_prefix(ship_stmt, EquipmentShipmentLog, mid_prefix)
  ship_rows = db.execute(ship_stmt).all()
  shipped_at: Dict[str, date] = {}
  for mid, sdt in ship_rows:
    if mid and sdt and (mid not in shipped_at or sdt < shipped_at[mid]):
      shipped_at[str(mid)] = sdt

  rt_s_days: List[float] = []
  s_c_days: List[float] = []
  c_sh_days: List[float] = []

  for mid, rdt in received_at.items():
    mid = str(mid)
    st = first_ts.get(mid)
    cp = first_100_ts.get(mid)
    sh = shipped_at.get(mid)

    if rdt and st:
      rt_s_days.append((to_naive_utc(st) - date_to_naive(rdt)).total_seconds() / 86400.0)
    if st and cp and cp >= st:
      s_c_days.append((to_naive_utc(cp) - to_naive_utc(st)).total_seconds() / 86400.0)
    if cp and sh:
      c_sh_days.append((date_to_naive(sh) - to_naive_utc(cp)).total_seconds() / 86400.0)

  def agg(vals: List[float]) -> Tuple[float, float, float]:
    if not vals: return (0.0, 0.0, 0.0)
    return (sum(vals) / len(vals), max(vals), min(vals))

  a_avg, a_max, a_min = agg(rt_s_days)
  b_avg, b_max, b_min = agg(s_c_days)
  c_avg, c_max, c_min = agg(c_sh_days)

  return LeadStageStats(
    receipt_to_start_avg_days=round(a_avg, 2),
    start_to_complete_avg_days=round(b_avg, 2),
    complete_to_ship_avg_days=round(c_avg, 2),
    receipt_to_start_min_days=round(a_min, 2),
    receipt_to_start_max_days=round(a_max, 2),
    start_to_complete_min_days=round(b_min, 2),
    start_to_complete_max_days=round(b_max, 2),
    complete_to_ship_min_days=round(c_min, 2),
    complete_to_ship_max_days=round(c_max, 2),
    n_receipt_to_start=len(rt_s_days),
    n_start_to_complete=len(s_c_days),
    n_complete_to_ship=len(c_sh_days),
  )
