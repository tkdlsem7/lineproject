from __future__ import annotations
from typing import List, Optional
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import asc, or_, func

# --- DB 세션 (프로젝트 구조에 맞춰 임포트 경로 보완) ---
try:
    from backend.db.database import get_db  # ex) backend/db/database.py
except ImportError:
    from backend.db.database import get_db     # ex) backend/database.py

# --- 모델 (MainDashboard 쪽 테이블 재사용 예상) ---
try:
    from ..MainDashboard.models import EquipProgress, EquipmentMoveLog
except ImportError:
    from .models import EquipProgress, EquipmentMoveLog  # 폴백

# --- 스키마 ---
from .schemas import (
    EquipmentListOut, EquipmentRowOut,
    MoveBatchIn, MoveBatchOut, AllowedSite, ConflictOut,
    PasteParseIn, PasteParseOut, PasteParsedRow,
)

router = APIRouter(prefix="/move", tags=["move"])

# ─────────────────────────────────────────────────────────────
# 유틸: 컬럼/값 정규화
# ─────────────────────────────────────────────────────────────
def _get_slot_col():
    """
    EquipProgress 슬롯 컬럼 자동 인식: slot_code 우선, 없으면 slot
    """
    return getattr(EquipProgress, "slot_code", None) or getattr(EquipProgress, "slot", None)

def _mid(row) -> str:
    """
    프로젝트별 장비 식별자 컬럼명이 다를 수 있어 공용 접근자 제공
    """
    return (
        (getattr(row, "machine_id", None)
         or getattr(row, "machine_no", None)
         or getattr(row, "equip_id", None)
         or "")
    ).strip()

def _norm_site(s: str) -> str:
    """
    사이트 표준화: '본사라인' → '본사', '진우리 라인' → '진우리'
    """
    s = (s or "").strip()
    s = s.replace(" ", "")
    s = s.replace("라인", "")
    return s

def _norm_slot(s: str) -> str:
    """
    슬롯 문자열 정규화 (표준형: 'HEAD-XX[-YY]…' 대문자, 2자리 패딩, 하이픈 유지):
      - (e) 제거
      - 특수 대시(–—−) → '-' 통일
      - 공백 제거
      - 대문자화
      - 예: a1 → A-01, a01 → A-01, j1401 → J-14-01, j-11-12 → J-11-12
    """
    s = (s or "").strip().upper()
    s = re.sub(r'\(E\)', '', s, flags=re.I)
    s = s.replace('–', '-').replace('—', '-').replace('−', '-')
    s = re.sub(r'\s+', '', s)

    m = re.match(r'^([A-Z]+)[-]?([0-9\-]*)$', s)
    if not m:
        return s
    head, tail = m.group(1), m.group(2)

    if '-' in tail:
        parts = [p for p in tail.split('-') if p != ""]
        parts = [p.zfill(2) for p in parts]
    else:
        digits = re.sub(r'\D', '', tail)
        if len(digits) == 0:
            parts = []
        elif len(digits) == 1:
            parts = [digits.zfill(2)]
        elif len(digits) == 2:
            parts = [digits]
        elif len(digits) == 3:
            parts = [digits[:1], digits[1:]]
            parts = [p.zfill(2) for p in parts]
        else:
            parts = [digits[:2], digits[2:4]]
            parts = [p.zfill(2) for p in parts]

    return head + ('-' + '-'.join(parts) if parts else '')

def _to_compact_slot(s: str) -> str:
    """
    저장용 '컴팩트' 슬롯: 하이픈 제거 + 앞자리 0 제거, 대문자 유지
      - 'D-01'   → 'D1'
      - 'J-14-01'→ 'J1401'
      - 'A'      → 'A'
    """
    norm = _norm_slot(s)
    parts = norm.split('-')
    head, nums = parts[0], parts[1:] if len(parts) > 1 else []
    if not nums:
        return head
    compact = head + ''.join(str(int(p)) for p in nums if p != "")
    return compact

def _slot_aliases_all(s: str) -> tuple[List[str], List[str]]:
    """
    모든 조합 별칭 생성:
      - 각 숫자 파트의 '2자리(원본)'과 '선행 0 제거' 버전 생성
      - 하이픈 제거 버전도 생성 (DB가 'J1401' 식일 때 대비)
    return: (with_hyphen_list, no_hyphen_list)
    """
    parts = s.split('-')
    head, nums = parts[0], parts[1:] if len(parts) > 1 else []
    if not nums:
        return [s], [head]

    # 각 숫자 파트에 대해 [2자리, 0제거] 옵션 생성
    options: List[List[str]] = []
    for p in nums:
      base = p.zfill(2)
      no0 = str(int(p))
      options.append(sorted({base, no0}))

    # 카르테시안 곱으로 모든 조합 생성
    with_hyphen_set = set()
    def dfs(i: int, acc: List[str]):
        if i == len(options):
            with_hyphen_set.add(head + "-" + "-".join(acc))
            return
        for v in options[i]:
            dfs(i + 1, acc + [v])
    dfs(0, [])
    with_hyphen = sorted(with_hyphen_set)

    # 하이픈 제거 버전
    no_hyphen = []
    for w in with_hyphen:
        _, *rest = w.split('-')
        no_hyphen.append(head + "".join(rest))
    return with_hyphen, no_hyphen

def _extract_sites(text: str) -> tuple[str, str]:
    """
    '진우리 -> 본사라인' 같은 방향 줄을 찾아 (from_site, to_site) 반환.
    뒤의 '라인' 단어는 있어도 되고 없어도 됨.
    """
    for raw in text.splitlines():
        s = raw.strip()
        m = re.search(r'(본사|진우리|부항리)\s*->\s*(본사|진우리|부항리)(?:라인)?', s)
        if m:
            return _norm_site(m.group(1)), _norm_site(m.group(2))
    raise HTTPException(status_code=400, detail="붙여넣기에서 '진우리 -> 본사' 같은 방향을 찾을 수 없습니다.")

# ─────────────────────────────────────────────────────────────
# GET /equipments : 사이트별 장비 목록
# ─────────────────────────────────────────────────────────────
@router.get("/equipments", response_model=EquipmentListOut)
def get_equipments(
    site: AllowedSite = Query("본사", description="사이트(본사/진우리/부항리)"),
    db: Session = Depends(get_db),
):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    rows = (
        db.query(EquipProgress)
        .filter(EquipProgress.site == site)
        .order_by(asc(slot_col))
        .all()
    )

    items: List[EquipmentRowOut] = []
    for r in rows:
        items.append(EquipmentRowOut(
            machine_id=_mid(r),
            site=getattr(r, "site", ""),
            slot=getattr(r, slot_col.key, ""),
            manager=getattr(r, "manager", None),
            progress=getattr(r, "progress", None),
        ))
    return EquipmentListOut(site=site, items=items)

# ─────────────────────────────────────────────────────────────
# POST /apply : 장비 이동 일괄 적용 (장비별 목적지 지정)
# ─────────────────────────────────────────────────────────────
@router.post("/apply", response_model=MoveBatchOut)
def apply_move(payload: MoveBatchIn, db: Session = Depends(get_db)):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    conflicts: List[ConflictOut] = []
    not_found: List[str] = []
    updated = 0

    for item in payload.items:
        to_site_norm = _norm_site(item.to_site)
        to_slot_norm = _norm_slot(item.to_slot)
        to_slot_comp = _to_compact_slot(item.to_slot)  # ✅ 저장은 컴팩트(D1/J1401)로

        # 대상 장비(원본) 조회
        conds = []
        for col_name in ("machine_id", "machine_no", "equip_id"):
            col = getattr(EquipProgress, col_name, None)
            if col is not None:
                conds.append(col == item.machine_id)
        if not conds:
            raise HTTPException(status_code=500, detail="EquipProgress에 machine_id/machine_no/equip_id 컬럼이 없습니다.")
        src = db.query(EquipProgress).filter(or_(*conds)).one_or_none()

        if not src:
            not_found.append(item.machine_id)
            continue

        # 목적지 점유 여부 확인 (하이픈/패딩 별칭 포함)
        to_aliases, to_aliases_nohy = _slot_aliases_all(to_slot_norm)
        tgt = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == to_site_norm)
            .filter(or_(
                slot_col.in_(to_aliases),
                func.replace(slot_col, '-', '').in_(to_aliases_nohy),
            ))
            .one_or_none()
        )
        if tgt and _mid(tgt) and _mid(tgt) != _mid(src):
            conflicts.append(ConflictOut(site=to_site_norm, slot=to_slot_norm, current_machine_id=_mid(tgt)))
            continue

        # 이동 수행 (저장은 컴팩트)
        prev_site = getattr(src, "site", None)
        prev_slot = getattr(src, slot_col.key, None)

        setattr(src, "site", to_site_norm)
        setattr(src, slot_col.key, to_slot_comp)
        updated += 1

        # 이동 로그
        try:
            db.add(EquipmentMoveLog(
                machine_id=_mid(src) or "",
                manager=getattr(src, "manager", None),
                from_site=prev_site,
                to_site=to_site_norm,
                from_slot=prev_slot,
                to_slot=to_slot_comp,
            ))
        except Exception:
            pass

    if updated > 0:
        db.commit()

    out = MoveBatchOut(ok=(updated > 0 and len(conflicts) == 0),
                       updated=updated,
                       not_found=not_found,
                       conflicts=conflicts)
    if conflicts:
        return JSONResponse(status_code=409, content=out.dict())
    return out

# ─────────────────────────────────────────────────────────────
# POST /paste-parse : (디자인만 사용 예정이므로 유지)
# ─────────────────────────────────────────────────────────────
@router.post("/paste-parse", response_model=PasteParseOut)
def paste_parse(payload: PasteParseIn, db: Session = Depends(get_db)):
    from_site, to_site = _extract_sites(payload.text)

    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    items: List[PasteParsedRow] = []
    ok = not_found = conflict = 0

    for raw in payload.text.splitlines():
        line = raw.strip()
        if not line:
            continue

        # 제목/날짜/방향/설명 같은 줄은 스킵
        if "->" in line or "현황" in line or "공유" in line or "라인이동" in line or line == "라인":
            continue

        # 공백 2토큰 기준으로 파싱 (대소문자/특수대시 사전 정리)
        t = re.sub(r'\(E\)', '', line, flags=re.I)
        t = t.replace('–', '-').replace('—', '-').replace('−', '-')
        t = re.sub(r'\s+', ' ', t).strip()
        parts = re.split(r'\s+', t)
        if len(parts) != 2:
            continue

        from_slot = _norm_slot(parts[0])
        to_slot   = _norm_slot(parts[1])

        # 원위치 후보(별칭 + 하이픈 제거) 생성
        from_aliases, from_aliases_nohy = _slot_aliases_all(from_slot)

        # 원위치에서 장비 찾기
        src = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == from_site)
            .filter(or_(
                slot_col.in_(from_aliases),
                func.replace(slot_col, '-', '').in_(from_aliases_nohy),
            ))
            .one_or_none()
        )

        if not src or not _mid(src):
            items.append(PasteParsedRow(
                from_site=from_site, from_slot=from_slot,
                to_site=to_site, to_slot=to_slot,
                machine_id=None, status="not_found"
            ))
            not_found += 1
            continue

        # 목적지 점유 여부 확인 (별칭 + 하이픈 제거)
        to_aliases, to_aliases_nohy = _slot_aliases_all(to_slot)
        tgt = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == to_site)
            .filter(or_(
                slot_col.in_(to_aliases),
                func.replace(slot_col, '-', '').in_(to_aliases_nohy),
            ))
            .one_or_none()
        )
        if tgt and _mid(tgt) and _mid(tgt) != _mid(src):
            items.append(PasteParsedRow(
                from_site=from_site, from_slot=from_slot,
                to_site=to_site, to_slot=to_slot,
                machine_id=_mid(src), status="conflict"
            ))
            conflict += 1
            continue

        items.append(PasteParsedRow(
            from_site=from_site, from_slot=from_slot,
            to_site=to_site, to_slot=to_slot,
            machine_id=_mid(src), status="ok"
        ))
        ok += 1

    return PasteParseOut(items=items, ok_count=ok, not_found_count=not_found, conflict_count=conflict)

# ─────────────────────────────────────────────────────────────
# POST /apply-by-slot : 슬롯 기준 일괄 적용 (메신저 완성 시 사용)
# ─────────────────────────────────────────────────────────────
class MoveBySlotItemIn(BaseModel):
    from_slot: str   # 예: "j-02-01", "J0201" 등 (정규화됨)
    to_slot: str     # 예: "a4", "A-04" 등 (정규화됨)

class MoveBySlotBatchIn(BaseModel):
    from_site: AllowedSite
    to_site: AllowedSite
    items: List[MoveBySlotItemIn]

@router.post("/apply-by-slot", response_model=MoveBatchOut)
def apply_move_by_slot(payload: MoveBySlotBatchIn, db: Session = Depends(get_db)):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    from_site = _norm_site(payload.from_site)
    to_site   = _norm_site(payload.to_site)

    conflicts: List[ConflictOut] = []
    not_found: List[str] = []
    updated = 0

    for it in payload.items:
        from_slot_norm = _norm_slot(it.from_slot)   # j0201 → J-02-01
        to_slot_norm   = _norm_slot(it.to_slot)     # a4   → A-04
        to_slot_comp   = _to_compact_slot(it.to_slot)

        # 별칭 세트 준비 (하이픈 있는/없는 모든 조합)
        from_aliases, from_aliases_nohy = _slot_aliases_all(from_slot_norm)
        to_aliases,   to_aliases_nohy   = _slot_aliases_all(to_slot_norm)

        # 1) 원본 행 찾기: from_site + (별칭들) + (하이픈 없는 비교)
        src = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == from_site)
            .filter(or_(
                slot_col.in_(from_aliases),
                func.replace(slot_col, '-', '').in_(from_aliases_nohy),
            ))
            .one_or_none()
        )
        if not src:
            not_found.append(f"{from_site}/{from_slot_norm}")
            continue

        # 2) 목적지 점유 확인
        tgt = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == to_site)
            .filter(or_(
                slot_col.in_(to_aliases),
                func.replace(slot_col, '-', '').in_(to_aliases_nohy),
            ))
            .one_or_none()
        )
        if tgt is not None and tgt is not src and _mid(tgt):
            conflicts.append(ConflictOut(site=to_site, slot=to_slot_norm, current_machine_id=_mid(tgt)))
            continue

        # 3) 업데이트 수행 (site, slot 둘 다 변경; 저장은 컴팩트)
        prev_site = getattr(src, "site", None)
        prev_slot = getattr(src, slot_col.key, None)

        setattr(src, "site", to_site)
        setattr(src, slot_col.key, to_slot_comp)
        updated += 1

        # 이동 로그
        try:
            db.add(EquipmentMoveLog(
                machine_id=_mid(src) or "",
                manager=getattr(src, "manager", None),
                from_site=prev_site,
                to_site=to_site,
                from_slot=prev_slot,
                to_slot=to_slot_comp,
            ))
        except Exception:
            pass

    if updated > 0:
        db.commit()

    out = MoveBatchOut(ok=(updated > 0 and len(conflicts) == 0),
                       updated=updated,
                       not_found=not_found,
                       conflicts=conflicts)
    if conflicts:
        return JSONResponse(status_code=409, content=out.dict())
    return out
