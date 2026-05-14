from __future__ import annotations

from typing import List, Tuple
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse

from sqlalchemy.orm import Session
from sqlalchemy import asc, or_, func
from sqlalchemy.exc import IntegrityError

# --- DB 세션 ---
try:
    from backend.db.database import get_db
except ImportError:
    from backend.db.database import get_db

# --- 모델 ---
try:
    from .models import EquipProgress, EquipmentMoveLog
except ImportError:
    from .models import EquipProgress, EquipmentMoveLog  # 폴백

# --- 스키마 ---
from .schemas import (
    EquipmentListOut,
    EquipmentRowOut,
    MoveBatchIn,
    MoveBatchOut,
    AllowedSite,
    ConflictOut,
    PasteParseIn,
    PasteParseOut,
    PasteParsedRow,
)

router = APIRouter(prefix="/move", tags=["move"])


# ─────────────────────────────────────────────
# 유틸: 안전한 pydantic dump (v1/v2 호환)
# ─────────────────────────────────────────────
def _dump(model):
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


# ─────────────────────────────────────────────
# 유틸: 컬럼/값 정규화
# ─────────────────────────────────────────────
def _get_slot_col():
    """EquipProgress 슬롯 컬럼 자동 인식: slot_code 우선, 없으면 slot"""
    return getattr(EquipProgress, "slot_code", None) or getattr(EquipProgress, "slot", None)


def _mid(row) -> str:
    """프로젝트별 장비 식별자 컬럼명이 다를 수 있어 공용 접근자 제공"""
    return (
        (getattr(row, "machine_id", None)
         or getattr(row, "machine_no", None)
         or getattr(row, "equip_id", None)
         or "")
    ).strip()


def _norm_site(s: str) -> str:
    """
    사이트 표준화:
      - 공백 제거
      - '본사라인' → '본사', '진우리 라인' → '진우리'
      - ✅ '라인대기'는 훼손되면 안되므로 예외 처리
    """
    s = (s or "").strip().replace(" ", "")
    if s in ("라인대기", "라인대기장", "대기", "라인-대기", "라인_대기"):
        return "라인대기"
    # '본사라인' 같은 케이스만 정리
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
    s = re.sub(r"\(E\)", "", s, flags=re.I)
    s = s.replace("–", "-").replace("—", "-").replace("−", "-")
    s = re.sub(r"\s+", "", s)

    m = re.match(r"^([A-Z]+)[-]?([0-9\-]*)$", s)
    if not m:
        return s
    head, tail = m.group(1), m.group(2)

    if "-" in tail:
        parts = [p for p in tail.split("-") if p != ""]
        parts = [p.zfill(2) for p in parts]
    else:
        digits = re.sub(r"\D", "", tail)
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

    return head + ("-" + "-".join(parts) if parts else "")


def _to_compact_slot(s: str) -> str:
    """
    저장용 '컴팩트' 슬롯: 하이픈 제거 + 앞자리 0 제거, 대문자 유지
      - 'D-01'   → 'D1'
      - 'J-14-01'→ 'J1401'
      - 'A'      → 'A'
    """
    norm = _norm_slot(s)
    parts = norm.split("-")
    head, nums = parts[0], parts[1:] if len(parts) > 1 else []
    if not nums:
        return head
    compact = head + "".join(str(int(p)) for p in nums if p != "")
    return compact


def _slot_aliases_all(s: str) -> Tuple[List[str], List[str]]:
    """
    모든 조합 별칭 생성:
      - 각 숫자 파트의 '2자리(원본)'과 '선행 0 제거' 버전 생성
      - 하이픈 제거 버전도 생성 (DB가 'J1401' 식일 때 대비)
    return: (with_hyphen_list, no_hyphen_list)
    """
    parts = s.split("-")
    head, nums = parts[0], parts[1:] if len(parts) > 1 else []
    if not nums:
        return [s], [head]

    options: List[List[str]] = []
    for p in nums:
        base = p.zfill(2)
        no0 = str(int(p))
        options.append(sorted({base, no0}))

    with_hyphen_set: set[str] = set()

    def dfs(i: int, acc: List[str]):
        if i == len(options):
            with_hyphen_set.add(head + "-" + "-".join(acc))
            return
        for v in options[i]:
            dfs(i + 1, acc + [v])

    dfs(0, [])
    with_hyphen = sorted(with_hyphen_set)

    no_hyphen: List[str] = []
    for w in with_hyphen:
        _, *rest = w.split("-")
        no_hyphen.append(head + "".join(rest))
    return with_hyphen, no_hyphen


def _extract_sites(text: str) -> Tuple[str, str]:
    """
    붙여넣기 텍스트에서 방향 줄을 찾아 (from_site, to_site) 반환.
    아래 형태들을 모두 지원:
      "진우리 -> 본사"       (ASCII 화살표)
      "진우리 → 본사"        (유니코드 화살표)
      "진우리 ⇒ 본사"
      "진우리 본사 라인"     (방향 표시 없이 사이트 두 개만)
      "→ 본사"               (목적지만 적힌 경우, from은 기본값 진우리)

    호기 ID 패턴이 들어있는 데이터 줄(예: "j-14-01 E6-> 라인대기")은
    방향 헤더가 아니므로 후보에서 제외한다.
    """
    SITES_RE = re.compile(r"(본사|진우리|부항리|라인대기)")
    # ASCII / 한글 / 유니코드 화살표를 모두 '->' 로 통일
    ARROW_NORMALIZE = lambda s: (
        s.replace("→", "->")
         .replace("⇒", "->")
         .replace("➔", "->")
         .replace("➜", "->")
         .replace("⟶", "->")
    )

    for raw in (text or "").splitlines():
        if _MACHINE_ID_LINE_RE.search(raw):
            # 호기 패턴이 포함된 줄은 데이터 줄이므로 헤더 후보에서 제외
            continue
        s = ARROW_NORMALIZE(raw).strip().replace(" ", "")
        if "->" in s:
            # "<from>-><to>"
            m = re.search(
                r"(본사|진우리|부항리|라인대기)->(본사|진우리|부항리|라인대기)", s
            )
            if m:
                return _norm_site(m.group(1)), _norm_site(m.group(2))
            # "-><to>" 만 있는 경우 (목적지만 적힌 케이스)
            m2 = re.search(r"->(본사|진우리|부항리|라인대기)", s)
            if m2:
                return "진우리", _norm_site(m2.group(1))
        # 화살표 없이 사이트 두 개가 같은 줄에 있는 경우
        found_all = SITES_RE.findall(s)
        if len(found_all) >= 2:
            return _norm_site(found_all[0]), _norm_site(found_all[1])
    # 마지막 폴백: 진우리 → 본사
    return "진우리", "본사"


# 호기 ID 패턴: 영문자 1개 + (선택) (e)/(E) + -숫자-숫자 형태
# 예) j-14-02, I-15-15, D-11-08, D(e)-11-08, H(e)-09-03
_MACHINE_ID_LINE_RE = re.compile(r"[a-zA-Z](?:\([eE]\))?-\d+-\d+")


# 라인대기 자동 슬롯 할당 규칙
# 원래 슬롯의 prefix 영문자(소문자 비교)에 따라 라인대기 안의 "존"을 결정.
#   a~f → "a" 존, g/h → "b" 존, i → "i" 존
# 사용자가 본사에서 라인대기로 옮길 때 어느 존으로 갈지 자동 추론용.
_LINE_WAITING_ZONE_MAP = {
    "a": "a", "b": "a", "c": "a", "d": "a", "e": "a", "f": "a",
    "g": "b", "h": "b",
    "i": "i",
}


def _line_waiting_zone(slot_or_machine: str) -> str:
    """슬롯 또는 호기 식별자의 앞 글자로 라인대기 존(a/b/i) 결정. 기본값 'a'."""
    s = (slot_or_machine or "").strip().lower()
    if not s:
        return "a"
    head = s[0]
    return _LINE_WAITING_ZONE_MAP.get(head, "a")


def _find_next_empty_line_waiting_slot(
    db: Session,
    zone: str,
    reserved: set[str] | None = None,
) -> str:
    """
    라인대기의 특정 존(a/b/i) 안에서 다음으로 채울 슬롯 코드를 돌려준다.

    정책:
      - 가장 큰 사용 번호 + 1 (gap 을 채우지 않고 항상 끝에 이어붙임)
      - 예) i1~i5 점유 → 다음은 i6, 그 다음은 i7
      - 비어 있으면 i1 부터 시작

    reserved 는 같은 paste-parse 호출 안에서 이미 할당해둔 슬롯 문자열의 집합.
    같은 글 안에서 여러 호기가 같은 zone 으로 갈 때 같은 번호로 겹치지 않게 막아준다.
    """
    slot_col = _get_slot_col()
    if slot_col is None:
        # 슬롯 컬럼이 없으면 그냥 zone1 반환
        return f"{zone}1"

    z = zone.strip().lower()
    if not z:
        z = "a"

    rows = (
        db.query(slot_col)
        .filter(EquipProgress.site == "라인대기")
        .filter(func.lower(slot_col).like(f"{z}%"))
        .all()
    )

    nums: list[int] = []
    num_re = re.compile(rf"^{z}-?0*(\d+)$", re.I)
    for r in rows:
        v = (r[0] or "").strip()
        if not v:
            continue
        m = num_re.match(v)
        if m:
            try:
                nums.append(int(m.group(1)))
            except ValueError:
                pass

    # in-memory reservation 도 같이 본다
    if reserved:
        for v in reserved:
            m = num_re.match((v or "").strip())
            if m:
                try:
                    nums.append(int(m.group(1)))
                except ValueError:
                    pass

    next_n = (max(nums) + 1) if nums else 1
    return f"{z}{next_n}"


def _detect_site_in_token(token: str) -> str | None:
    """
    토큰 안에 사이트 키워드가 부분 문자열로 들어있으면 그 사이트를 돌려준다.
    예) "H라인대기" → "라인대기", "본사라인" → "본사"
    """
    if not token:
        return None
    for s in ("본사", "진우리", "부항리", "라인대기"):
        if s in token:
            return s
    return None


def _is_slot_occupied(db: Session, site_norm: str, slot_norm: str) -> str | None:
    """
    목적지(site, slot)가 이미 점유되어 있으면 점유 장비 ID 반환, 아니면 None
    """
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    aliases, aliases_nohy = _slot_aliases_all(slot_norm)
    tgt = (
        db.query(EquipProgress)
        .filter(EquipProgress.site == site_norm)
        .filter(
            or_(
                slot_col.in_(aliases),
                func.replace(slot_col, "-", "").in_(aliases_nohy),
            )
        )
        .first()
    )
    if tgt and _mid(tgt):
        return _mid(tgt)
    return None


# ─────────────────────────────────────────────────────────────
# GET /equipments : 사이트별 장비 목록
# ─────────────────────────────────────────────────────────────
@router.get("/equipments", response_model=EquipmentListOut)
def get_equipments(
    site: AllowedSite = Query("본사", description="사이트(본사/진우리/라인대기/부항리)"),
    db: Session = Depends(get_db),
):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    site_norm = _norm_site(site)

    rows = (
        db.query(EquipProgress)
        .filter(EquipProgress.site == site_norm)
        .order_by(asc(slot_col))
        .all()
    )

    items: list[EquipmentRowOut] = []
    for r in rows:
        items.append(
            EquipmentRowOut(
                machine_id=_mid(r),
                site=getattr(r, "site", ""),
                slot=getattr(r, slot_col.key, ""),
                manager=getattr(r, "manager", None),
                progress=getattr(r, "progress", None),
            )
        )
    return EquipmentListOut(site=site, items=items)


# ─────────────────────────────────────────────────────────────
# POST /apply : 장비 이동 일괄 적용 (장비별 목적지 지정)
# ─────────────────────────────────────────────────────────────
@router.post("/apply", response_model=MoveBatchOut)
def apply_move(payload: MoveBatchIn, db: Session = Depends(get_db)):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    conflicts: list[ConflictOut] = []
    not_found: list[str] = []
    errors: list[str] = []
    updated = 0

    # (커밋 실패 시 대비) 이번 요청의 목적지들을 저장해 둠
    requested_moves: list[tuple[str, str, str]] = []  # (machine_id, to_site_norm, to_slot_norm)

    for item in payload.items:
        to_site_norm = _norm_site(item.to_site)
        to_slot_norm = _norm_slot(item.to_slot)
        to_slot_comp = _to_compact_slot(item.to_slot)
        requested_moves.append((item.machine_id, to_site_norm, to_slot_norm))

        # 대상 장비(원본) 조회
        conds = []
        for col_name in ("machine_id", "machine_no", "equip_id"):
            col = getattr(EquipProgress, col_name, None)
            if col is not None:
                conds.append(col == item.machine_id)
        if not conds:
            raise HTTPException(
                status_code=500,
                detail="EquipProgress에 machine_id/machine_no/equip_id 컬럼이 없습니다.",
            )

        # one_or_none()는 중복 데이터에서 500을 만들 수 있어 limit 방식으로 안전하게 처리
        srcs = db.query(EquipProgress).filter(or_(*conds)).limit(2).all()
        if len(srcs) == 0:
            not_found.append(item.machine_id)
            continue
        if len(srcs) > 1:
            errors.append(f"[{item.machine_id}] 같은 ID로 EquipProgress가 2개 이상 조회됩니다(데이터 중복).")
            continue

        src = srcs[0]

        # ✅ 모든 사이트에서 목적지 점유 체크 (진우리도 포함) → 500 대신 409로 안내
        occ = _is_slot_occupied(db, to_site_norm, to_slot_norm)
        if to_site_norm != "진우리":
            occ = _is_slot_occupied(db, to_site_norm, to_slot_norm)
            if occ and occ != _mid(src):
                conflicts.append(
                    ConflictOut(site=to_site_norm, slot=to_slot_norm, current_machine_id=occ)
                )
                continue

        # 이동 수행 (저장은 컴팩트)
        prev_site = getattr(src, "site", None)
        prev_slot = getattr(src, slot_col.key, None)

        setattr(src, "site", to_site_norm)
        setattr(src, slot_col.key, to_slot_comp)
        updated += 1

        # 이동 로그
        try:
            db.add(
                EquipmentMoveLog(
                    machine_id=_mid(src) or "",
                    manager=getattr(src, "manager", None),
                    from_site=prev_site,
                    to_site=to_site_norm,
                    from_slot=prev_slot,
                    to_slot=to_slot_comp,
                )
            )
        except Exception:
            # 로그 실패는 전체 트랜잭션 막지 않음
            pass

    # 충돌/에러가 있으면 커밋 전에 409로 반환
    if conflicts or errors:
        out = MoveBatchOut(
            ok=False,
            updated=0,
            not_found=not_found,
            conflicts=conflicts,
            errors=errors,
        )
        return JSONResponse(status_code=409, content=_dump(out))

    if updated > 0:
        try:
            db.commit()
        except IntegrityError:
            # ✅ DB 제약(유니크/체크 등)으로 500 나는 케이스를 409로 변환
            db.rollback()

            # 가능한 한 “현재 점유자”를 다시 계산해 conflicts로 내려줌
            re_conflicts: list[ConflictOut] = []
            for (mid, to_site_norm, to_slot_norm) in requested_moves:
                occ = _is_slot_occupied(db, to_site_norm, to_slot_norm)
                if occ and occ != mid:
                    re_conflicts.append(
                        ConflictOut(site=to_site_norm, slot=to_slot_norm, current_machine_id=occ)
                    )

            out = MoveBatchOut(
                ok=False,
                updated=0,
                not_found=not_found,
                conflicts=re_conflicts,
                errors=["DB 제약으로 이동이 반영되지 않았습니다. 목적지 슬롯 점유/제약조건을 확인하세요."],
            )
            return JSONResponse(status_code=409, content=_dump(out))

    return MoveBatchOut(
        ok=True,
        updated=updated,
        not_found=not_found,
        conflicts=[],
        errors=[],
    )


# ─────────────────────────────────────────────────────────────
# POST /apply-by-slot : (붙여넣기 파서용) from_slot/to_slot 기반 이동
# ─────────────────────────────────────────────────────────────
@router.post("/apply-by-slot", response_model=MoveBatchOut)
def apply_move_by_slot(payload: List[PasteParsedRow], db: Session = Depends(get_db)):
    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(status_code=500, detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의")

    conflicts: list[ConflictOut] = []
    not_found: list[str] = []
    errors: list[str] = []
    updated = 0

    for row in payload:
        if row.status not in ("ok", "conflict", "not_found"):
            continue

        from_site = _norm_site(row.from_site)
        to_site = _norm_site(row.to_site)
        from_slot_norm = _norm_slot(row.from_slot)
        to_slot_norm = _norm_slot(row.to_slot)
        to_slot_comp = _to_compact_slot(row.to_slot)

        # from 조회
        from_aliases, from_aliases_nohy = _slot_aliases_all(from_slot_norm)

        src = (
            db.query(EquipProgress)
            .filter(EquipProgress.site == from_site)
            .filter(
                or_(
                    slot_col.in_(from_aliases),
                    func.replace(slot_col, "-", "").in_(from_aliases_nohy),
                )
            )
            .first()
        )
        if not src or not _mid(src):
            not_found.append(row.machine_id or row.raw)
            continue

        # to 점유 체크 (모든 사이트 동일)
        occ = _is_slot_occupied(db, to_site, to_slot_norm)
        if occ and occ != _mid(src):
            conflicts.append(
                ConflictOut(site=to_site, slot=to_slot_norm, current_machine_id=occ)
            )
            continue

        # 이동 수행
        prev_site = getattr(src, "site", None)
        prev_slot = getattr(src, slot_col.key, None)

        setattr(src, "site", to_site)
        setattr(src, slot_col.key, to_slot_comp)
        updated += 1

        # 로그
        try:
            db.add(
                EquipmentMoveLog(
                    machine_id=_mid(src) or "",
                    manager=getattr(src, "manager", None),
                    from_site=prev_site,
                    to_site=to_site,
                    from_slot=prev_slot,
                    to_slot=to_slot_comp,
                )
            )
        except Exception:
            pass

    if conflicts or errors:
        out = MoveBatchOut(ok=False, updated=0, not_found=not_found, conflicts=conflicts, errors=errors)
        return JSONResponse(status_code=409, content=_dump(out))

    if updated > 0:
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            out = MoveBatchOut(
                ok=False,
                updated=0,
                not_found=not_found,
                conflicts=conflicts,
                errors=["DB 제약으로 이동이 반영되지 않았습니다."],
            )
            return JSONResponse(status_code=409, content=_dump(out))

    return MoveBatchOut(ok=True, updated=updated, not_found=not_found, conflicts=[], errors=[])


# ─────────────────────────────────────────────────────────────
# POST /paste-parse : (디자인만 사용 예정이므로 유지)
# ─────────────────────────────────────────────────────────────
@router.post("/paste-parse", response_model=PasteParseOut)
def paste_parse(payload: PasteParseIn, db: Session = Depends(get_db)):
    """
    메신저에서 붙여넣는 라인 이동 공지를 파싱한다.

    지원하는 행 형식 (둘 다 OK):
      A) <호기> <목적지슬롯>                       예) I-15-15  G-03
      B) <호기> / <현재슬롯> -> <목적지슬롯>       예) j-14-02 / A-01 -> D-01

    구분자는 공백 / "/" / "->" / "→" 어느 조합이든 허용된다.
    (e) 표기와 다양한 대시(–—−) 도 자동 정규화된다.

    방향 헤더 ("진우리 → 본사" 등) 가 있으면 그걸 to_site 로 사용하고,
    없으면 호기의 현재 사이트를 to_site 로 사용 (같은 사이트 내 슬롯 이동).
    """
    from_site, to_site = _extract_sites(payload.text)
    # _extract_sites 는 못 찾으면 ("진우리", "본사") 기본값을 돌려준다.
    # 데이터 줄에 방향 헤더가 명시되지 않은 경우엔 호기의 현재 사이트를
    # to_site 로 쓰기 위해, 헤더 존재 여부를 따로 추적한다.
    has_direction_header = _detect_direction_header(payload.text)

    slot_col = _get_slot_col()
    if slot_col is None:
        raise HTTPException(
            status_code=500,
            detail="EquipProgress 슬롯 컬럼(slot_code/slot) 미정의",
        )

    items: list[PasteParsedRow] = []
    ok = not_found = conflict = 0

    # 이번 paste-parse 호출 안에서만 유효한 "이미 할당해둔 라인대기 슬롯" 집합
    # 한 글 안에서 여러 호기가 같은 zone 으로 갈 때 같은 번호를 다시 안 쓰게 막는다.
    # (외부 모듈 변수와 충돌하지 않도록 함수 로컬에서만 사용)
    _LINE_WAITING_RESERVED: dict[str, set[str]] = {}

    HEADER_KEYWORDS = ("현황", "공유드립니다", "공지", "안내")

    # 사이트명 (방향 헤더 / 사이트 라벨 판정용)
    SITE_WORDS = ("본사", "진우리", "부항리", "라인대기")
    SITE_RE_GLOBAL = re.compile(r"(본사|진우리|부항리|라인대기)")

    # 데이터 줄에서 토큰을 뽑을 때 사용할 분리자:
    # 공백, "/", "->", 유니코드 화살표 등을 모두 공백으로 치환한 뒤 split
    SPLIT_RE = re.compile(r"\s+|/+|->|→|⇒|➔|➜|⟶")

    for raw in (payload.text or "").splitlines():
        line = raw.strip()
        if not line:
            continue

        # 1) 헤더 키워드 줄 → 스킵
        if any(kw in line for kw in HEADER_KEYWORDS):
            items.append(PasteParsedRow(raw=raw, status="skip", message="skip header"))
            continue

        # 2) 호기 ID 패턴이 없는 줄에서 사이트 키워드가 발견되면 방향 헤더 → 스킵
        #    데이터 줄(예: "j-14-01 E6 -> 라인대기")은 호기 패턴이 있으므로
        #    여기서 스킵되지 않고 아래 파싱 로직으로 내려간다.
        if not _MACHINE_ID_LINE_RE.search(line) and SITE_RE_GLOBAL.search(line):
            items.append(PasteParsedRow(raw=raw, status="skip", message="direction/site label"))
            continue

        # 3) 화살표 기준으로 좌/우를 나눠서 위치별로 해석
        #    좌측(before): [호기 + (현재슬롯 또는 현재사이트)]
        #    우측(after) : [목적지슬롯 또는 목적지사이트]
        ARROW_RE_LINE = re.compile(r"->|→|⇒|➔|➜|⟶")
        arrow_m = ARROW_RE_LINE.search(line)
        if arrow_m:
            before_raw = line[: arrow_m.start()]
            after_raw = line[arrow_m.end() :]
        else:
            before_raw = line
            after_raw = ""

        def _line_tokenize(s: str) -> list[str]:
            # (E)/(e) 제거, 다양한 대시 표준화
            x = re.sub(r"\(E\)", "", s, flags=re.I)
            x = x.replace("–", "-").replace("—", "-").replace("−", "-")
            # 공백 / 탭 / 슬래시 를 공백으로
            x = re.sub(r"\s+|/+", " ", x)
            return [p for p in x.split() if p]

        before_tokens = _line_tokenize(before_raw)
        after_tokens = _line_tokenize(after_raw)

        # 사이트와 데이터 토큰을 분리
        # 사이트명이 다른 글자와 붙어있는 케이스도 인식 (예: "H라인대기" → "라인대기")
        # 규칙:
        #   - 화살표 있음: before 의 사이트 → from_site, after 의 사이트 → to_site
        #   - 화살표 없음: 줄 어디에 있든 사이트는 목적지로 간주
        per_line_from_site: str | None = None
        per_line_dest_site: str | None = None
        before_data: list[str] = []
        for p in before_tokens:
            site_hit = _detect_site_in_token(p)
            if site_hit:
                if arrow_m:
                    per_line_from_site = _norm_site(site_hit)
                else:
                    per_line_dest_site = _norm_site(site_hit)
            else:
                before_data.append(p)
        after_data: list[str] = []
        for p in after_tokens:
            site_hit = _detect_site_in_token(p)
            if site_hit:
                per_line_dest_site = _norm_site(site_hit)
            else:
                after_data.append(p)

        if len(before_data) < 1:
            items.append(PasteParsedRow(raw=raw, status="skip", message="no machine token"))
            continue

        machine_id = before_data[0].strip()
        # 좌측 데이터 토큰의 두 번째 항목은 현재 슬롯(있을 때만)
        from_slot_raw: str = before_data[1].strip() if len(before_data) >= 2 else ""
        # 우측 데이터 토큰의 첫 번째 항목은 목적지 슬롯(있을 때만)
        to_slot_raw: str = after_data[0].strip() if len(after_data) >= 1 else ""

        # 화살표가 없고 단순히 "호기 슬롯" 만 있는 경우 (예: "I-15-15 G-03")
        # → 두 번째 데이터 토큰을 목적지 슬롯으로 본다.
        if not arrow_m and not to_slot_raw and len(before_data) >= 2:
            to_slot_raw = from_slot_raw
            from_slot_raw = ""

        to_slot_norm = _norm_slot(to_slot_raw) if to_slot_raw else ""
        from_slot_norm_hint = _norm_slot(from_slot_raw) if from_slot_raw else ""

        # 4) 호기 번호로 현재 위치 조회 (어느 사이트에 있든)
        #    대소문자 무시 + (e) 유무 변형까지 모두 시도해서 한 건이라도 잡히면 OK
        lookup_keys = _machine_id_lookup_keys(machine_id)

        mid_conds = []
        for col_name in ("machine_id", "machine_no", "equip_id"):
            col = getattr(EquipProgress, col_name, None)
            if col is not None:
                mid_conds.append(func.lower(col).in_(lookup_keys))
        if not mid_conds:
            items.append(
                PasteParsedRow(
                    raw=raw,
                    machine_id=machine_id,
                    from_site=from_site,
                    to_site=to_site,
                    from_slot=from_slot_norm_hint,
                    to_slot=to_slot_norm,
                    status="error",
                    message="EquipProgress 에 machine_id/no 컬럼 없음",
                )
            )
            continue

        src = db.query(EquipProgress).filter(or_(*mid_conds)).first()

        if not src or not _mid(src):
            not_found += 1
            items.append(
                PasteParsedRow(
                    raw=raw,
                    machine_id=machine_id,
                    from_site=from_site,
                    to_site=to_site,
                    from_slot=from_slot_norm_hint,
                    to_slot=to_slot_norm,
                    status="not_found",
                    message=f"호기 {machine_id} 를 찾을 수 없음",
                )
            )
            continue

        # 현재 위치를 from 으로 채움 (참고용)
        cur_site = (getattr(src, "site", None) or "").strip()
        cur_slot_raw = getattr(src, slot_col.key, None) or ""
        cur_slot_norm = _norm_slot(str(cur_slot_raw))

        # DB 에 저장된 실제 호기 번호 (대소문자/괄호 그대로) 를 사용해야
        # 적용 단계(/move/apply) 에서도 정확히 매칭된다.
        actual_machine_id = _mid(src) or machine_id

        # 목적지 사이트 결정 우선순위:
        #   1) 데이터 줄 화살표 우측에 사이트가 적혀 있으면 그것 (per_line_dest_site)
        #   2) 데이터 줄 화살표 좌측에 from_site 만 적혀 있으면 그 반대편 사이트
        #      (예) "H(e)-10-06 진우리 -> H-01"  → 진우리에서 옮긴다는 뜻이므로 본사
        #   3) 텍스트 상단에 방향 헤더가 있으면 그것
        #   4) 모두 없으면 호기의 현재 사이트 (같은 사이트 내 슬롯 이동)
        OPPOSITE_SITE = {
            "진우리": "본사",
            "본사": "진우리",
            "라인대기": "본사",
            "부항리": "본사",
        }
        if per_line_dest_site:
            effective_to_site = per_line_dest_site
        elif per_line_from_site:
            effective_to_site = OPPOSITE_SITE.get(per_line_from_site, "본사")
        elif has_direction_header:
            effective_to_site = to_site
        else:
            effective_to_site = cur_site or to_site

        # 목적지 슬롯이 명시되지 않았지만 사이트가 명시된 경우
        # (예: "j-14-01 E6 -> 라인대기", "I-15-15 H라인대기")
        if not to_slot_norm and effective_to_site == "라인대기":
            # ✅ 라인대기 자동 슬롯 할당
            # 원래 슬롯의 prefix(a~f / g·h / i)로 라인대기 a/b/i 존 결정 후
            # 그 존에서 가장 작은 번호의 빈 슬롯을 자동 할당.
            # 같은 텍스트에서 동시에 여러 호기가 라인대기로 가는 경우
            # 같은 번호로 겹치지 않게 reserved_slots 에 미리 기록해둔다.
            zone_basis = (
                from_slot_norm_hint or cur_slot_norm or actual_machine_id
            )
            zone = _line_waiting_zone(zone_basis)

            # 한 번의 paste-parse 호출 안에서 이미 할당한 슬롯도 occupied 로 함께 본다
            reserved_set = _LINE_WAITING_RESERVED.setdefault(zone, set())
            picked = _find_next_empty_line_waiting_slot(db, zone, reserved=reserved_set)
            reserved_set.add(picked)

            # 컴팩트 형태 'a8' 그대로 사용 (apply_move 가 _to_compact_slot 처리)
            to_slot_norm = picked
        elif not to_slot_norm and per_line_dest_site:
            # 라인대기 외 사이트인데 슬롯 미지정: 텍스트의 from_slot 또는 DB 현재 슬롯 유지
            to_slot_norm = from_slot_norm_hint or cur_slot_norm

        # 5) 목적지 점유 체크
        #    슬롯이 비어 있으면(예: 사이트만 표기됐고 현재 슬롯도 없는 케이스)
        #    점유 체크를 건너뛴다.
        if to_slot_norm:
            occ = _is_slot_occupied(db, effective_to_site, to_slot_norm)
        else:
            occ = None
        if occ and occ != actual_machine_id:
            conflict += 1
            items.append(
                PasteParsedRow(
                    raw=raw,
                    machine_id=actual_machine_id,
                    from_site=cur_site or from_site,
                    to_site=effective_to_site,
                    from_slot=cur_slot_norm or from_slot_norm_hint,
                    to_slot=to_slot_norm,
                    status="conflict",
                    message=f"{effective_to_site}/{to_slot_norm} 슬롯은 이미 {occ} 점유 중",
                )
            )
            continue

        ok += 1
        items.append(
            PasteParsedRow(
                raw=raw,
                machine_id=actual_machine_id,
                from_site=cur_site or from_site,
                to_site=effective_to_site,
                from_slot=cur_slot_norm or from_slot_norm_hint,
                to_slot=to_slot_norm,
                status="ok",
                message="ok",
            )
        )

    return PasteParseOut(
        from_site=from_site,
        to_site=to_site,
        ok=ok,
        not_found=not_found,
        conflict=conflict,
        items=items,
    )


def _detect_direction_header(text: str) -> bool:
    """
    텍스트 어딘가에 명시적인 사이트 방향 헤더("진우리 → 본사" 등)가 있는지 판별.
    데이터 줄(예: "j-14-02 / A-01 -> D-01" 또는 "j-14-01 E6 -> 라인대기")의
    화살표/사이트명은 헤더가 아니다.
    """
    if not text:
        return False
    site_re = re.compile(r"(본사|진우리|부항리|라인대기)")
    arrow_re = re.compile(r"->|→|⇒|➔|➜|⟶")
    for raw in text.splitlines():
        s = raw.strip()
        if not s:
            continue
        # 호기 ID 패턴이 들어있는 데이터 줄은 헤더가 아님
        if _MACHINE_ID_LINE_RE.search(s):
            continue
        if arrow_re.search(s) and site_re.search(s):
            return True
    return False


def _machine_id_lookup_keys(raw: str) -> list[str]:
    """
    호기 번호 매칭을 위한 후보 문자열들(모두 소문자) 생성.

    실 사용 데이터에서 본 형태들을 한 번에 잡기 위해 변형들을 만들어둔다:
      - 원본 그대로
      - 대소문자 차이 (전부 소문자로 비교)
      - (e) / (E) 가 붙은 형태와 떼낸 형태
      - 공백 제거 / 다양한 대시(–—−) 표준화

    예) "D(e)-11-08" → ["d(e)-11-08", "d-11-08"]
    """
    s = (raw or "").strip()
    if not s:
        return []

    # 대시/공백 정규화
    s = s.replace("–", "-").replace("—", "-").replace("−", "-")
    s = re.sub(r"\s+", "", s)
    s_lower = s.lower()

    keys: set[str] = {s_lower}

    # (e) / (E) 가 포함된 케이스: 떼낸 버전도 후보로 추가
    stripped = re.sub(r"\(e\)", "", s_lower)
    if stripped and stripped != s_lower:
        keys.add(stripped)

    # 반대로 (e) 가 없는데 DB 에 (e) 가 붙은 형태로 저장돼 있는 경우를 위해
    # 첫 토큰 뒤에 "(e)" 가 들어간 변형도 한 번 만들어 본다.
    # 예) "d-11-08" → "d(e)-11-08"
    m = re.match(r"^([a-z])(-.+)$", s_lower)
    if m and "(e)" not in s_lower:
        keys.add(f"{m.group(1)}(e){m.group(2)}")

    return [k for k in keys if k]
