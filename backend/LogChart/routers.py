# backend/LogChart/routers.py
from __future__ import annotations
from collections import defaultdict, Counter
from datetime import date, datetime, timezone
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from ..db.database import get_db
from .schemas import (
    LeadCycleStats, StepStats, StepStatItem,
    DefectStats, KeyCount, MonthlyFlow, MonthFlowItem, LeadStageStats,
)

# ── 실제 모델들 (프로젝트 구조에 맞춰 import)
from ..MainDashboard.models import EquipProgress, EquipmentProgressLog, EquipmentShipmentLog
from ..EquipmentInfo.models import EquipmentReceiptLog
from ..setup.models import SetupSheetAll
from ..troubleshoot.models import TroubleShootEntry

router = APIRouter(prefix="/logcharts", tags=["LogCharts"])


# ─────────────────────────────────────────────
# 공통 유틸
# ─────────────────────────────────────────────
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
    """옵션: site/building 필터를 갖는 엔드포인트에서만 사용"""
    conds = []
    if hasattr(model, "site") and site and site != "ALL":
        conds.append(getattr(model, "site") == site)
    # building은 슬롯 앞글자(A/B/I)로 판단
    if hasattr(model, "slot") and building and building != "ALL":
        conds.append(getattr(model, "slot").like(f"{building}%"))
    if hasattr(model, "slot_code") and building and building != "ALL":
        conds.append(getattr(model, "slot_code").like(f"{building}%"))
    if conds:
        stmt = stmt.where(and_(*conds))
    return stmt


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """aware datetime → UTC로 변환 후 naive로, naive면 그대로"""
    if dt is None:
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def date_to_naive(dt_date: date) -> datetime:
    """date → 같은 날 00:00:00 naive datetime"""
    return datetime(dt_date.year, dt_date.month, dt_date.day)


# ─────────────────────────────────────────────
# 1) 리드타임/사이클타임(기존 KPI)
#    - 리드타임 = receive_date → shipped_date
#    - 사이클타임 = progress_log updated_at min → max (해당 월 범위 내)
# ─────────────────────────────────────────────
@router.get("/leadcycle", response_model=LeadCycleStats)
def get_lead_cycle_stats(
    from_month: str = Query(..., description="YYYY-MM"),
    to_month: str = Query(..., description="YYYY-MM"),
    site: str = Query("ALL"),
    building: str = Query("ALL"),
    line: str = Query("ALL"),
    db: Session = Depends(get_db),
):
    s_from, _ = month_range(from_month)
    _, e_to = month_range(to_month)

    # --- 입고 ---
    rec_stmt = select(EquipmentReceiptLog.machine_no, EquipmentReceiptLog.receive_date).where(
        and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to)
    )
    rec_stmt = apply_site_slot_filters(rec_stmt, EquipmentReceiptLog, site, building)
    rec_rows = db.execute(rec_stmt).all()

    receipt_at: Dict[str, date] = {}
    for mid, rdt in rec_rows:
        if mid and rdt and (mid not in receipt_at or rdt < receipt_at[mid]):
            receipt_at[mid] = rdt

    # --- 출하 ---
    ship_stmt = select(EquipmentShipmentLog.machine_no, EquipmentShipmentLog.shipped_date).where(
        and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to)
    )
    ship_stmt = apply_site_slot_filters(ship_stmt, EquipmentShipmentLog, site, building)
    ship_rows = db.execute(ship_stmt).all()

    shipped_at: Dict[str, date] = {}
    for mid, sdt in ship_rows:
        if mid and sdt and (mid not in shipped_at or sdt < shipped_at[mid]):
            shipped_at[mid] = sdt

    # --- 리드타임 계산(일) ---
    lead_days: List[float] = []
    for mid, rdt in receipt_at.items():
        sdt = shipped_at.get(mid)
        if sdt and sdt >= rdt:
            lead_days.append(float((sdt - rdt).days))

    # --- 사이클타임 (progress_log.updated_at의 월 내 min~max) ---
    allow_mids: Optional[set[str]] = None
    if site != "ALL" or building != "ALL":
        allow_stmt = select(EquipProgress.machine_id)
        allow_stmt = apply_site_slot_filters(allow_stmt, EquipProgress, site, building)
        allow_mids = {row[0] for row in db.execute(allow_stmt).all() if row[0]}

    prog_stmt = select(EquipmentProgressLog.machine_no, EquipmentProgressLog.updated_at).where(
        and_(EquipmentProgressLog.updated_at >= s_from, EquipmentProgressLog.updated_at < e_to)
    )
    if allow_mids:
        prog_stmt = prog_stmt.where(EquipmentProgressLog.machine_no.in_(allow_mids))
    prog_rows = db.execute(prog_stmt).all()

    first_last: Dict[str, Tuple[Optional[datetime], Optional[datetime]]] = defaultdict(lambda: (None, None))
    for mid, ts in prog_rows:
        if not mid or not ts:
            continue
        st, ed = first_last[mid]
        if st is None or ts < st:
            st = ts
        if ed is None or ts > ed:
            ed = ts
        first_last[mid] = (st, ed)

    cycle_days: List[float] = []
    for mid, (st, ed) in first_last.items():
        if st and ed and ed >= st:
            # aware/naive 혼합 방지
            st_n = to_naive_utc(st)
            ed_n = to_naive_utc(ed)
            cycle_days.append((ed_n - st_n).total_seconds() / 86400.0)

    def agg(vals: List[float]) -> Tuple[float, float, float]:
        if not vals:
            return (0.0, 0.0, 0.0)
        return (sum(vals) / len(vals), max(vals), min(vals))

    lead_avg, lead_max, lead_min = agg(lead_days)
    cycle_avg, cycle_max, cycle_min = agg(cycle_days)

    return LeadCycleStats(
        lead_avg_days=round(lead_avg, 2),
        lead_min_days=round(lead_min, 2),
        lead_max_days=round(lead_max, 2),
        cycle_avg_days=round(cycle_avg, 2),
        cycle_min_days=round(cycle_min, 2),
        cycle_max_days=round(cycle_max, 2),
    )


# ─────────────────────────────────────────────
# 2) Step별 작업 공수(Rowdata)
#   - step_name 기준, 시간은 setup_hours(없으면 ts_hours)
#   - 기간: created_at
# ─────────────────────────────────────────────
@router.get("/steps", response_model=StepStats)
def get_step_stats(
    from_month: str = Query(..., description="YYYY-MM"),
    to_month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    s_from, _ = month_range(from_month)
    _, e_to = month_range(to_month)

    rows = db.execute(
        select(
            SetupSheetAll.step_name,
            SetupSheetAll.setup_hours,
            SetupSheetAll.ts_hours,
            SetupSheetAll.setup_start_date,
            SetupSheetAll.setup_end_date,
            SetupSheetAll.created_at,
        ).where(and_(SetupSheetAll.created_at >= s_from, SetupSheetAll.created_at < e_to))
    ).all()

    by_step_minutes: Dict[str, List[float]] = defaultdict(list)
    total_minutes = 0.0

    for step, setup_h, ts_h, st_d, ed_d, _created in rows:
        name = step or "UNKNOWN"
        hours: Optional[float] = None
        if setup_h is not None:
            hours = float(setup_h)
        elif ts_h is not None:
            hours = float(ts_h)
        elif st_d and ed_d and ed_d >= st_d:
            hours = (
                (date_to_naive(ed_d) - date_to_naive(st_d)).total_seconds()
                / 3600.0
            )

        if hours is not None and hours >= 0:
            by_step_minutes[name].append(hours * 60.0)
            total_minutes += hours * 60.0

    items: List[StepStatItem] = []
    for name, mins in by_step_minutes.items():
        hrs = [m / 60.0 for m in mins]
        items.append(
            StepStatItem(
                step=name,
                count=len(mins),
                avg_hours=round(sum(hrs) / len(hrs), 2),
                max_hours=round(max(hrs), 2),
                min_hours=round(min(hrs), 2),
            )
        )
    items.sort(key=lambda x: x.step)
    return StepStats(total_hours=round(total_minutes / 60.0, 2), steps=items)


# ─────────────────────────────────────────────
# 3) 불량 현황
#   - TS: troubleshoot_entry
#   - 입고 품질 점수: setup_sheet_all.quality_score로 집계
# ─────────────────────────────────────────────
@router.get("/defects", response_model=DefectStats)
def get_defect_stats(
    from_month: str = Query(..., description="YYYY-MM"),
    to_month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    s_from, _ = month_range(from_month)
    _, e_to = month_range(to_month)

    ts_rows = db.execute(
        select(
            TroubleShootEntry.unit_no,
            TroubleShootEntry.ts_minutes,
            TroubleShootEntry.defect_category,
            TroubleShootEntry.location,
            TroubleShootEntry.defect,
            TroubleShootEntry.defect_type,
            TroubleShootEntry.created_at,
        ).where(and_(TroubleShootEntry.created_at >= s_from, TroubleShootEntry.created_at < e_to))
    ).all()

    by_machine = defaultdict(lambda: {"cnt": 0, "ts_min": 0.0})
    cats = Counter(); locs = Counter(); items = Counter(); types = Counter()
    for unit_no, ts_min, cat, loc, dft, dft_type, _dt in ts_rows:
        if not unit_no:
            continue
        by_machine[str(unit_no)]["cnt"] += 1
        if ts_min:
            by_machine[str(unit_no)]["ts_min"] += float(ts_min)
        if cat: cats[cat] += 1
        if loc: locs[loc] += 1
        if dft: items[dft] += 1
        if dft_type: types[dft_type] += 1

    per_counts = [v["cnt"] for v in by_machine.values()]
    per_ts_hours = [(v["ts_min"] / 60.0) for v in by_machine.values()]

    def agg(vals: List[float]) -> Tuple[float, float, float]:
        if not vals:
            return (0.0, 0.0, 0.0)
        return (sum(vals) / len(vals), max(vals), min(vals))

    per_avg, per_max, per_min = agg(per_counts)
    ts_avg = sum(per_ts_hours) / len(per_ts_hours) if per_ts_hours else 0.0

    qs_rows = db.execute(
        select(SetupSheetAll.quality_score).where(
            and_(SetupSheetAll.created_at >= s_from, SetupSheetAll.created_at < e_to)
        )
    ).all()
    qs_vals = [float(v[0]) for v in qs_rows if v[0] is not None]
    iq_avg = round(sum(qs_vals) / len(qs_vals), 2) if qs_vals else None
    iq_max = round(max(qs_vals), 2) if qs_vals else None
    iq_min = round(min(qs_vals), 2) if qs_vals else None

    def kc(cnt: Counter) -> List[KeyCount]:
        return [KeyCount(key=str(k), count=int(v)) for k, v in cnt.most_common(20)]

    return DefectStats(
        per_unit_avg=round(per_avg, 2),
        per_unit_max=round(per_max, 2),
        per_unit_min=round(per_min, 2),
        ts_time_per_unit_avg_hours=round(ts_avg, 2),
        incoming_quality_avg=iq_avg,
        incoming_quality_max=iq_max,
        incoming_quality_min=iq_min,
        by_category=kc(cats),
        by_location=kc(locs),
        by_item=kc(items),
        by_type=kc(types),
    )


# ─────────────────────────────────────────────
# 4) 월별 입·출하 & 회전율
# ─────────────────────────────────────────────
@router.get("/flows", response_model=MonthlyFlow)
def get_monthly_flows(
    from_month: str = Query(..., description="YYYY-MM"),
    to_month: str = Query(..., description="YYYY-MM"),
    site: str = Query("ALL"),
    building: str = Query("ALL"),
    line: str = Query("ALL"),
    db: Session = Depends(get_db),
):
    s_from, _ = month_range(from_month)
    _, e_to = month_range(to_month)

    rec_stmt = select(EquipmentReceiptLog.receive_date, EquipmentReceiptLog.site, EquipmentReceiptLog.slot).where(
        and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to)
    )
    rec_stmt = apply_site_slot_filters(rec_stmt, EquipmentReceiptLog, site, building)
    rec_rows = db.execute(rec_stmt).all()

    ship_stmt = select(EquipmentShipmentLog.shipped_date, EquipmentShipmentLog.site, EquipmentShipmentLog.slot).where(
        and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to)
    )
    ship_stmt = apply_site_slot_filters(ship_stmt, EquipmentShipmentLog, site, building)
    ship_rows = db.execute(ship_stmt).all()

    rec_by_ym = Counter()
    for (dt, _site, _slot) in rec_rows:
        if dt:
            rec_by_ym[dt.strftime("%Y-%m")] += 1

    ship_by_ym = Counter()
    for (dt, _site, _slot) in ship_rows:
        if dt:
            ship_by_ym[dt.strftime("%Y-%m")] += 1

    months: List[MonthFlowItem] = []
    rates: List[float] = []
    total_r = 0
    total_s = 0
    for ym in ym_list(from_month, to_month):
        r = rec_by_ym.get(ym, 0)
        s = ship_by_ym.get(ym, 0)
        total_r += r
        total_s += s
        rate = (s / r * 100.0) if r > 0 else None
        months.append(MonthFlowItem(month=ym, receipts=r, shipments=s, turnover_rate=round(rate, 2) if rate is not None else None))
        if rate is not None:
            rates.append(rate)

    avg_rate = round(sum(rates) / len(rates), 2) if rates else None
    max_rate = round(max(rates), 2) if rates else None
    min_rate = round(min(rates), 2) if rates else None

    return MonthlyFlow(
        total_receipts=total_r,
        total_shipments=total_s,
        avg_turnover_rate=avg_rate,
        max_turnover_rate=max_rate,
        min_turnover_rate=min_rate,
        months=months,
    )


# ─────────────────────────────────────────────
# 5) 입고→시작 / 시작→완료(진척 100) / 완료→출하 구간 평균
# ─────────────────────────────────────────────
@router.get("/leadstages", response_model=LeadStageStats)
def get_lead_stage_stats(
    from_month: str = Query(..., description="YYYY-MM"),
    to_month: str = Query(..., description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    s_from, _ = month_range(from_month)
    _, e_to = month_range(to_month)

    # 1) 입고(날짜)
    rec_rows = db.execute(
        select(EquipmentReceiptLog.machine_no, EquipmentReceiptLog.receive_date)
        .where(and_(EquipmentReceiptLog.receive_date >= s_from, EquipmentReceiptLog.receive_date < e_to))
    ).all()
    receipt_at: Dict[str, date] = {}
    for mid, rdt in rec_rows:
        if mid and rdt and (mid not in receipt_at or rdt < receipt_at[mid]):
            receipt_at[str(mid)] = rdt

    # 2) 생산로그(시작/완료시각)
    prog_rows = db.execute(
        select(EquipmentProgressLog.machine_no, EquipmentProgressLog.updated_at, EquipmentProgressLog.progress)
        .where(and_(EquipmentProgressLog.updated_at >= s_from, EquipmentProgressLog.updated_at < e_to))
    ).all()
    first_ts: Dict[str, Optional[datetime]] = {}
    first_100_ts: Dict[str, Optional[datetime]] = {}
    last_ts: Dict[str, Optional[datetime]] = {}

    for mid, ts, prog in prog_rows:
        if not mid or not ts:
            continue
        mid = str(mid)
        # 시작(가장 빠른 로그)
        if mid not in first_ts or ts < first_ts[mid]:
            first_ts[mid] = ts
        # 마지막(백업용)
        if mid not in last_ts or ts > last_ts[mid]:
            last_ts[mid] = ts
        # 100% 최초 시각
        try:
            p = float(prog) if prog is not None else None
        except Exception:
            p = None
        if p is not None and p >= 100.0:
            if mid not in first_100_ts or ts < first_100_ts[mid]:
                first_100_ts[mid] = ts

    # 3) 출하(날짜)
    ship_rows = db.execute(
        select(EquipmentShipmentLog.machine_no, EquipmentShipmentLog.shipped_date)
        .where(and_(EquipmentShipmentLog.shipped_date >= s_from, EquipmentShipmentLog.shipped_date < e_to))
    ).all()
    shipped_at: Dict[str, date] = {}
    for mid, sdt in ship_rows:
        if mid and sdt and (mid not in shipped_at or sdt < shipped_at[mid]):
            shipped_at[str(mid)] = sdt

    # --- 세 구간 산출 ---
    rt_s_days: List[float] = []  # receipt -> start
    s_c_days: List[float] = []   # start -> complete(=first_100)
    c_sh_days: List[float] = []  # complete -> ship

    for mid, rdt in receipt_at.items():
        st = first_ts.get(mid)
        comp = first_100_ts.get(mid) or None
        ship = shipped_at.get(mid)

        # receipt -> start
        if rdt and st and st.date() >= rdt:
            st_n = to_naive_utc(st)
            rdt_n = date_to_naive(rdt)
            rt_s_days.append((st_n - rdt_n).total_seconds() / 86400.0)

        # start -> complete (완료가 없으면 스킵; 마지막 로그를 완료로 간주하려면 comp = comp or last_ts.get(mid))
        if st and comp and comp >= st:
            st_n = to_naive_utc(st)
            comp_n = to_naive_utc(comp)
            s_c_days.append((comp_n - st_n).total_seconds() / 86400.0)

        # complete -> ship
        if comp and ship and ship >= comp.date():
            comp_n = to_naive_utc(comp)
            ship_n = date_to_naive(ship)
            c_sh_days.append((ship_n - comp_n).total_seconds() / 86400.0)

    def agg(vals: List[float]) -> tuple[float, float, float]:
        if not vals:
            return (0.0, 0.0, 0.0)
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
