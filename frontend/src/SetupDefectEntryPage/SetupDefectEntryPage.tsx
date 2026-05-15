import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import DefectCatalogModal from "./DefectCatalogModal";

/** 스텝 옵션 */
const STEPS = [
  "Common",
  "Stage",
  "Loader",
  "STAGE(Advanced)",
  "Cold Test",
  "Option&ETC",
  "개조",
  "HW",
  "Packing&Delivery",
] as const;
type StepType = (typeof STEPS)[number];

/** HW/SW 타입 */
type HwSw = "H/W" | "S/W";
const HW_SW_OPTIONS: HwSw[] = ["H/W", "S/W"];

const LOCATION_OPTIONS = ["PC & Monitor", "Loader", "Stage", "Chiller"] as const;

const FALLBACK_DEFECT_TYPES_BY_DEFECT: Record<string, string[]> = {
  Bolt_Nut_Tab: ["체결불량", "파손", "오사용", "누락"],
  Cover: ["도장불량", "스크래치", "파손", "누락", "미조립불량"],
  Cable: ["단선", "반삽입", "탈삽입", "파손", "전장불량"],
  CableTie: ["커팅불량", "누락", "오사용"],
  "SpeedValve&Peeting": ["고정불량", "파트불량", "조립불량"],
  "I-Marking": ["누락", "작업불량"],
  "Air&Vac line": ["전장불량", "파손", "누락", "오배선", "꺾임"],
  Mount: ["파손", "체결불량", "오사용", "누락", "작업불량"],
  "Label&Sticker": ["누락", "오사용"],
  Setting: ["설정미스", "셋팅미스"],
  Sensor: ["파손", "위치 불량"],
  Module: ["조립불량", "파트불량", "파손"],
  Chuck: ["파트불량", "파손"],
  Board: ["파트불량", "파손"],
  Camera: ["조명불량", "파트불량", "파손"],
  Chain: ["파트불량", "전장불량"],
  Driver: ["전원불량", "파트불량", "파손"],
  Terminal: ["누락", "조립불량"],
  "Axis Base": ["파트불량", "파손", "조립불량"],
  CC: ["파트불량", "파손", "누락"],
  "B/K & Dog": ["조립불량", "누락"],
  "Top Plate": ["도장불량", "기타"],
  Chiller: ["기타"],
  SMPS: ["전원불량", "파트불량", "파손"],
  ETC: ["기타"],
  Fan: ["파트불량"],
  CardHolder: ["스크래치", "오사용"],
  "Auto Tilt": ["조립불량", "파손"],
  "Belt Tensic": ["장력불량"],
  "Parameter axis base": ["도장불량"],
  FOUP: ["기타"],
};

const DEFECT_GROUP_OPTIONS = ["단순 하드웨어", "기능"] as const;
type DefectGroup = (typeof DEFECT_GROUP_OPTIONS)[number];

/** API 기본 경로 */
const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

/** 기본값(세팅 총 소요시간) */
const DEFAULT_SETUP_HOURS: Partial<Record<StepType, string>> = {
  Common: "5",
  Stage: "2.5",
  Loader: "8",
  "STAGE(Advanced)": "6",
  "Cold Test": "5",
  "Option&ETC": "5",
  HW: "2",
  "Packing&Delivery": "5",
};

/** ---------- 타입 ---------- */
type MetaState = {
  machineNo: string;
  sn: string;
  chillerSn: string;
  setupStart: string;
  setupEnd: string;
};

type SummaryRow = {
  setupHours: string;
  applyText: string; // Common 전용
  remark: string; // Common 전용
};

type DetailRow = {
  defectDetail: string;
  qualityScore: string;
  tsMinutes: string;

  hwSw: HwSw;
  defectGroup: DefectGroup;
  defectLocation: string;
  defect: string;
  defectType: string;

  remark: string;
};

type NextableEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type EquipProgressRes = {
  machine_id: string;
  serial_number?: string | null;
  chiller_serial_number?: string | null;
  chiller_sn?: string | null;
  chillerSn?: string | null;
  chillerSerialNumber?: string | null;
  site?: string | null;
  slot_code?: string | null;
  customer?: string | null;
  manager?: string | null;
  shipping_date?: string | null;
  progress?: number | null;
  note?: string | null;
  status?: string | null;
};

type SettingDatesRes = {
  machine_no: string;
  start_date: string;
  end_date?: string | null;
};


type EquipDetailRes = {
  machine_id?: string | null;
  site?: string | null;
  slot_code?: string | null;
  serial_number?: string | null;
  chiller_serial_number?: string | null;
  chiller_sn?: string | null;
  chillerSn?: string | null;
  chillerSerialNumber?: string | null;
};

async function fetchEquipmentDetailBySlot(
  site: string,
  slotCode: string
): Promise<EquipDetailRes | null> {
  const slot = (slotCode || "").trim().toUpperCase();
  if (!slot) return null;

  const url = `${API_BASE}/dashboard/equipment/detail`;

  try {
    const res = await axios.get(url, {
      params: { site: (site || "").trim(), slot_code: slot },
      headers: { ...authHeaders() },
    });
    return res.data as EquipDetailRes;
  } catch {
    return null;
  }
}

/** ✅ 호기 번호로 다른 테이블에서 공통 정보를 끌어오기 위한 응답 타입 */
type EquipSyncInfoRes = {
  machine_id: string;
  serial_number?: string | null;
  chiller_serial_number?: string | null;
  shipping_date?: string | null;
  manager?: string | null;
  customer?: string | null;
  filled_fields?: string[];
  not_found?: boolean;
};

async function fetchEquipmentSyncInfo(
  machineId: string
): Promise<EquipSyncInfoRes | null> {
  const mid = (machineId || "").trim();
  if (!mid) return null;

  const url = `${API_BASE}/dashboard/equipment/sync-info?machine_id=${encodeURIComponent(mid)}`;

  try {
    const res = await fetch(url, {
      credentials: "include",
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[sync-info] FAIL", res.status, url, txt);
      return null;
    }
    return (await res.json()) as EquipSyncInfoRes;
  } catch (e) {
    console.error("[sync-info] ERROR", url, e);
    return null;
  }
}

/** ✅ 기존 row data 행 (서버 응답) */
type SetupSheetRow = Record<string, any>;

async function fetchSetupSheetRows(machineId: string): Promise<SetupSheetRow[]> {
  const mid = (machineId || "").trim();
  if (!mid) return [];

  // 1) manage/rows 시도
  try {
    const res = await axios.get(`${API_BASE}/setup-sheets/manage/rows`, {
      params: { machine_no: mid, limit: 500, offset: 0 },
      headers: { ...authHeaders() },
      timeout: 15000,
    });
    const rows = res.data?.rows;
    if (Array.isArray(rows)) return rows;
  } catch (e: any) {
    const status = e?.response?.status;
    console.warn(
      "[setup-sheets/manage/rows] FAIL",
      status,
      JSON.stringify(e?.response?.data ?? e?.message)
    );
    // 422/404/405는 fallback 시도
    if (status !== 404 && status !== 405 && status !== 422) {
      // 다른 오류라도 fallback은 해보자
    }
  }

  // 2) fallback: /logs/rows?table=setup_sheet_all (manage 페이지와 동일한 패턴)
  try {
    const res = await axios.get(`${API_BASE}/logs/rows`, {
      params: {
        table: "setup_sheet_all",
        q: mid,
        limit: 200,
        offset: 0,
      },
      headers: { ...authHeaders() },
      timeout: 15000,
    });
    const rows = res.data?.rows;
    if (!Array.isArray(rows)) return [];
    // q는 광범위 검색이므로 클라이언트 측에서 호기 정확 매칭 한 번 더 필터
    const target = mid.toLowerCase();
    return rows.filter((r: any) => {
      const m = String(
        r?.machine_no ?? r?.machineNo ?? r?.machine_id ?? r?.machineId ?? ""
      )
        .trim()
        .toLowerCase();
      return m === target;
    });
  } catch (e: any) {
    console.error(
      "[logs/rows fallback] FAIL",
      e?.response?.status,
      JSON.stringify(e?.response?.data ?? e?.message)
    );
    return [];
  }
}

/** ✅ 특정 step의 행만 호기 기준으로 가져오기 (step 클릭 시 자동 로드용) */
async function fetchSetupSheetRowsByStep(
  machineId: string,
  step: string
): Promise<SetupSheetRow[]> {
  const mid = (machineId || "").trim();
  if (!mid) return [];

  // 1) manage/rows?step= 시도
  try {
    const res = await axios.get(`${API_BASE}/setup-sheets/manage/rows`, {
      params: { machine_no: mid, step, limit: 500, offset: 0 },
      headers: { ...authHeaders() },
      timeout: 15000,
    });
    const rows = res.data?.rows;
    if (Array.isArray(rows)) return rows;
  } catch (e: any) {
    const status = e?.response?.status;
    console.warn(
      "[setup-sheets/manage/rows by step] FAIL",
      status,
      JSON.stringify(e?.response?.data ?? e?.message)
    );
  }

  // 2) fallback: 전체 가져와서 클라이언트에서 step + machine_no 필터
  const all = await fetchSetupSheetRows(mid);
  const target = step.trim();
  return all.filter((r: any) => {
    const sn = String(r?.step_name ?? r?.stepName ?? "").trim();
    return sn === target;
  });
}

/** ✅ 서버 row → DetailRow 변환 (snake/camelCase 모두 허용) */
function rowToDetailRow(r: any): DetailRow {
  const get = (snake: string, camel: string) => {
    const v = r?.[snake];
    if (v !== undefined && v !== null) return v;
    return r?.[camel];
  };
  const hw: HwSw = get("hw_sw", "hwSw") === "S/W" ? "S/W" : "H/W";
  const dg: DefectGroup =
    get("defect_group", "defectGroup") === "기능" ? "기능" : "단순 하드웨어";
  const qs = get("quality_score", "qualityScore");
  const ts = get("ts_hours", "tsHours");
  return {
    defectDetail: String(get("defect_detail", "defectDetail") ?? ""),
    qualityScore: qs === null || qs === undefined ? "" : String(qs),
    tsMinutes: ts === null || ts === undefined ? "" : String(ts),
    hwSw: hw,
    defectGroup: dg,
    defectLocation: String(get("defect_location", "defectLocation") ?? ""),
    defect: String(get("defect", "defect") ?? ""),
    defectType: String(get("defect_type", "defectType") ?? ""),
    remark: String(get("remark", "remark") ?? ""),
  };
}

/** ✅ 서버 rows를 한 step의 (summary, summaryEnabled, details)로 변환 */
function rowsToStepState(
  rows: any[],
  step: StepType
): {
  summary: SummaryRow | null;
  summaryEnabled: boolean;
  details: DetailRow[];
  sheetId: number | null;
} {
  // 가장 최근 sheet_id의 행만 사용
  const sheetIds = rows
    .map((r) => Number(r?.sheet_id ?? r?.sheetId ?? 0))
    .filter((n) => Number.isFinite(n) && n > 0);
  const latest = sheetIds.length > 0 ? Math.max(...sheetIds) : 0;
  const targetRows = latest
    ? rows.filter((r) => Number(r?.sheet_id ?? r?.sheetId ?? 0) === latest)
    : rows;

  // step_name이 일치하는 행만
  const stepRows = targetRows.filter((r) => {
    const sn = String(r?.step_name ?? r?.stepName ?? "").trim();
    return sn === step;
  });

  const hasSetup = (r: any) => {
    const v = r?.setup_hours ?? r?.setupHours;
    return v !== null && v !== undefined && String(v).trim() !== "";
  };

  const summaryRow = stepRows.find(hasSetup);
  const detailRows = stepRows.filter((r) => !hasSetup(r));

  const isCommon = step === "Common";
  let summary: SummaryRow | null = null;
  if (summaryRow) {
    const sh = summaryRow.setup_hours ?? summaryRow.setupHours;
    summary = {
      setupHours: sh === null || sh === undefined ? "" : String(sh),
      applyText: isCommon
        ? String(summaryRow.defect_detail ?? summaryRow.defectDetail ?? "")
        : "",
      remark: isCommon
        ? String(summaryRow.remark ?? "")
        : "",
    };
  }

  return {
    summary,
    summaryEnabled: !!summaryRow,
    details: detailRows.map(rowToDetailRow),
    sheetId: latest || null,
  };
}



/** EquipmentInfoPage에서 저장해 둔 로컬 intent(시리얼/칠러시리얼) */
type MachineInfoIntent = {
  machineId?: string;
  machine_id?: string;
  values?: {
    serialNumber?: string | null;
    serial_number?: string | null;
    chillerSerialNumber?: string | null;
    chiller_serial_number?: string | null;
    chiller_sn?: string | null;
    chillerSn?: string | null;
  };
};

/** title이 "A01 / J-10-09" 같은 경우 마지막 토큰만 호기로 사용 */
function normalizeMachineId(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "";
  const parts = s.split(/[/|>]/);
  return (parts[parts.length - 1] || "").trim();
}

/** ---------- 유틸 ---------- */
function scoreFromMinutes(mins: number | null): number | null {
  if (mins === null || isNaN(mins) || mins < 0) return null;
  if (mins < 10) return 1;
  if (mins < 30) return 2;
  if (mins < 60) return 5;
  if (mins < 120) return 10;
  if (mins < 240) return 20;
  if (mins < 600) return 40;
  return 60;
}

function pickChiller(obj: any): string {
  const v =
    (typeof obj?.chiller_serial_number === "string" && obj.chiller_serial_number) ||
    (typeof obj?.chiller_sn === "string" && obj.chiller_sn) ||
    (typeof obj?.chillerSn === "string" && obj.chillerSn) ||
    (typeof obj?.chillerSerialNumber === "string" && obj.chillerSerialNumber) ||
    "";
  return String(v ?? "");
}


function focusNextFrom(el: NextableEl) {
  const nodes = Array.from(
    document.querySelectorAll<NextableEl>('[data-enter-next="1"]')
  );
  const i = nodes.indexOf(el);
  if (i >= 0 && i + 1 < nodes.length) {
    nodes[i + 1].focus();
    const n = nodes[i + 1];
    if (n instanceof HTMLInputElement) n.select();
  }
}

function applyDetailRules(row: DetailRow, step: StepType): DetailRow {
  if (step === "HW") {
    return { ...row, hwSw: "H/W", defectGroup: "단순 하드웨어" };
  }
  return row;
}

/** ---------- 스타일 ---------- */
const PAGE_BG =
  "min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 px-3 py-4 text-sm";
const FRAME = "mx-auto w-full max-w-[1480px] 2xl:max-w-[1680px]";

const PANEL =
  "flex h-[calc(100vh-32px)] flex-col overflow-hidden rounded-none bg-white/70 shadow-xl ring-1 ring-slate-200/70 backdrop-blur";
const CONTENT =
  "flex-1 overflow-y-auto no-scrollbar bg-white/35 p-4 md:p-6 space-y-4";

const inputBase =
  "h-11 w-full rounded-none border-2 border-slate-300 bg-white px-4 text-[15px] text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200/70";

const textareaCompact =
  "min-h-[44px] w-full resize-y rounded-none border-2 border-slate-300 bg-white px-4 py-2 text-[15px] leading-6 text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200/70";

const textareaBase =
  "min-h-[96px] w-full resize-y rounded-none border-2 border-slate-300 bg-white px-4 py-3 text-[15px] leading-6 text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200/70";

const selectBase =
  "h-11 w-full rounded-none border-2 border-slate-300 bg-white px-3 text-[15px] text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200/70 disabled:bg-slate-100";

const softPanel = "rounded-none bg-slate-50/80 ring-1 ring-slate-200/60";

/** ---------- UI ---------- */
const Shell: React.FC<{
  children: React.ReactNode;
  className?: string;
  header?: string;
  headerRight?: React.ReactNode;
  badge?: string;
}> = ({ children, className, header, headerRight, badge }) => (
  <section
    className={[
      "rounded-none bg-white shadow-md ring-2 ring-slate-200",
      className ?? "",
    ].join(" ")}
  >
    <div className="h-2 rounded-none bg-gradient-to-r from-sky-200 via-white to-orange-200" />
    {header && (
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-7 py-5">
        <div className="flex items-center gap-2">
          <h3 className="text-xl md:text-2xl font-extrabold tracking-tight text-slate-900">
            {header}
          </h3>
          {badge && (
            <span className="rounded-none bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
              {badge}
            </span>
          )}
        </div>
        {headerRight}
      </div>
    )}
    {children}
  </section>
);

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
}> = ({ label, children, hint }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <div className="text-xs font-extrabold tracking-wide text-slate-600">
        {label}
      </div>
      {hint && <div className="text-[11px] text-slate-400">{hint}</div>}
    </div>
    {children}
  </div>
);

/** ---------- 자동완성 ---------- */
type AutoCompleteInputProps = {
  value: string;
  onChangeValue: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
};

const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({
  value,
  onChangeValue,
  options,
  placeholder,
  disabled,
  inputClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);

  const filtered = useMemo(() => {
    const kw = value.trim().toLowerCase();
    const base = kw
      ? options.filter((x) => x.toLowerCase().includes(kw))
      : options;
    return base.slice(0, 10);
  }, [value, options]);

  const pick = (v: string, moveNext: boolean, currentEl?: NextableEl) => {
    onChangeValue(v);
    setOpen(false);
    setHi(0);
    if (moveNext && currentEl) setTimeout(() => focusNextFrom(currentEl), 0);
  };

  return (
    <div className="relative">
      <input
        data-enter-next="1"
        disabled={disabled}
        className={inputClassName ?? inputBase}
        value={value}
        onChange={(e) => {
          onChangeValue(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          const el = e.currentTarget as NextableEl;

          if (!open && e.key === "Enter") {
            e.preventDefault();
            focusNextFrom(el);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHi((p) => Math.min(p + 1, Math.max(filtered.length - 1, 0)));
            return;
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((p) => Math.max(p - 1, 0));
            return;
          }
          if (e.key === "Enter") {
            if (open && filtered.length > 0) {
              e.preventDefault();
              pick(filtered[hi] ?? filtered[0], true, el);
            } else {
              e.preventDefault();
              focusNextFrom(el);
            }
            return;
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />

      {open && filtered.length > 0 && !disabled && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-none border border-slate-200 bg-white shadow-lg">
          {filtered.map((opt, i) => (
            <button
              key={opt}
              type="button"
              className={
                "block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 " +
                (i === hi ? "bg-slate-100" : "")
              }
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(opt, true);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** ---------- 팝업으로 옵션 선택하는 입력 (불량/불량유형용) ---------- */
type OptionPickerInputProps = {
  value: string;
  onChangeValue: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  title?: string;
};

const OptionPickerInput: React.FC<OptionPickerInputProps> = ({
  value,
  onChangeValue,
  options,
  placeholder,
  disabled,
  inputClassName,
  title,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const filtered = useMemo(() => {
    const kw = query.trim().toLowerCase();
    if (!kw) return options;
    return options.filter((x) => x.toLowerCase().includes(kw));
  }, [query, options]);

  // ESC로 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // 열릴 때 검색어 초기화
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const handlePick = (v: string) => {
    onChangeValue(v);
    setOpen(false);
    // 선택 후 다음 인풋으로 포커스 이동
    setTimeout(() => {
      if (triggerRef.current) focusNextFrom(triggerRef.current as any);
    }, 0);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-enter-next="1"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            if (!disabled) setOpen(true);
          }
        }}
        className={[
          inputClassName ?? inputBase,
          "text-left flex items-center justify-between gap-2 cursor-pointer",
          !value ? "text-slate-400" : "text-slate-800",
          disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50",
        ].join(" ")}
      >
        <span className="truncate">{value || placeholder || "선택..."}</span>
        <span className="shrink-0 text-slate-400">▾</span>
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={() => setOpen(false)}
          >
            <div
              className="w-[520px] max-w-[94vw] max-h-[80vh] overflow-hidden rounded-none bg-white shadow-2xl flex flex-col"
              onMouseDown={(ev) => ev.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <div className="text-base font-bold text-slate-800">
                  {title ?? "항목 선택"}
                </div>
                <button
                  type="button"
                  aria-label="닫기"
                  onClick={() => setOpen(false)}
                  className="rounded-none px-2 py-1 text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="border-b border-slate-100 px-5 py-3">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="검색..."
                  className="h-10 w-full rounded-none border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="overflow-y-auto p-3">
                {filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">
                    표시할 항목이 없습니다.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {filtered.map((opt) => {
                      const selected = opt === value;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handlePick(opt)}
                          className={[
                            "rounded-none px-3 py-2.5 text-left text-sm font-medium ring-1 transition",
                            selected
                              ? "bg-sky-600 text-white ring-sky-600 shadow"
                              : "bg-white text-slate-700 ring-slate-200 hover:bg-sky-50 hover:ring-sky-300",
                          ].join(" ")}
                          title={opt}
                        >
                          <span className="block truncate">{opt}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 px-5 py-3 text-right">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-none bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

/** ---------- 컴포넌트 ---------- */
export default function SetupDefectEntryPage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<StepType>("Common");
  const [sheetId, setSheetId] = useState<number | null>(null);

  const [selectedMachineId, setSelectedMachineId] = useState<string>("");
  const [equipInfo, setEquipInfo] = useState<EquipProgressRes | null>(null);

  // ✅ 데이터 동기화 버튼 상태
  const [syncing, setSyncing] = useState(false);

  const [meta, setMeta] = useState<MetaState>({
    machineNo: "",
    sn: "",
    chillerSn: "",
    setupStart: "",
    setupEnd: "",
  });

  // ✅ 요약행 존재 여부 (행 자체 삭제/복구)
  const [summaryEnabledByStep, setSummaryEnabledByStep] = useState<
    Record<StepType, boolean>
  >(() =>
    STEPS.reduce((acc, s) => {
      acc[s] = true;
      return acc;
    }, {} as Record<StepType, boolean>)
  );

  const [summaryByStep, setSummaryByStep] = useState<Record<StepType, SummaryRow>>(
    () =>
      STEPS.reduce((acc, s) => {
        acc[s] = {
          setupHours: DEFAULT_SETUP_HOURS[s] ?? "",
          applyText: "",
          remark: "",
        };
        return acc;
      }, {} as Record<StepType, SummaryRow>)
  );

  const makeEmptyDetail = (step: StepType): DetailRow =>
    applyDetailRules(
      {
        defectDetail: "",
        qualityScore: "",
        tsMinutes: "",
        hwSw: "H/W",
        defectGroup: "단순 하드웨어",
        defectLocation: "",
        defect: "",
        defectType: "",
        remark: "",
      },
      step
    );

  const [detailsByStep, setDetailsByStep] = useState<Record<StepType, DetailRow[]>>(
    () =>
      STEPS.reduce((acc, s) => {
        acc[s] = [];
        return acc;
      }, {} as Record<StepType, DetailRow[]>)
  );

  const summaryEnabled = summaryEnabledByStep[currentStep] ?? true;
  const summary = summaryByStep[currentStep];
  const details = detailsByStep[currentStep];

  const isHW = currentStep === "HW";
  const isCommon = currentStep === "Common";
  const isMod = currentStep === "개조";

  /** ✅ 불량/불량유형: DB(Defect Catalog)에서 로드 */
  type DefectCatalogItem = {
    id: number;
    defect: string;
    defect_types: string[];
  };

  const [defectCatalog, setDefectCatalog] = useState<DefectCatalogItem[]>(() => {
    // API 실패 시에도 최소 동작하도록 기존 하드코딩을 fallback으로 사용
    return Object.entries(FALLBACK_DEFECT_TYPES_BY_DEFECT).map(
      ([defect, defect_types], i) => ({
        id: -(i + 1),
        defect,
        defect_types,
      })
    );
  });
  const [defectCatalogLoading, setDefectCatalogLoading] = useState(false);
  const [defectCatalogError, setDefectCatalogError] = useState<string | null>(
    null
  );

  // ✅ 불량 항목 관리 모달 (별도 페이지로 이동하지 않고 같은 화면 위에서 띄움)
  const [defectCatalogModalOpen, setDefectCatalogModalOpen] = useState(false);

  const defectOptions = useMemo(() => {
    return defectCatalog
      .map((x) => (x?.defect ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [defectCatalog]);

  const defectTypesByDefect = useMemo<Record<string, string[]>>(() => {
    const rec: Record<string, string[]> = {};
    for (const it of defectCatalog) {
      const key = (it?.defect ?? "").trim();
      if (!key) continue;
      rec[key] = Array.isArray(it?.defect_types) ? it.defect_types : [];
    }
    return rec;
  }, [defectCatalog]);

  const allDefectTypes = useMemo(() => {
    const s = new Set<string>();
    for (const it of defectCatalog) {
      const arr = Array.isArray(it?.defect_types) ? it.defect_types : [];
      for (const t of arr) {
        const v = String(t ?? "").trim();
        if (v) s.add(v);
      }
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [defectCatalog]);

  /**
   * 불량 카탈로그를 서버에서 다시 불러오는 함수.
   * - 최초 마운트 시 useEffect 에서 호출
   * - 불량 항목 관리 모달이 닫힐 때도 호출하여 row data 폼의
   *   불량/불량유형 셀렉트 옵션을 최신 상태로 동기화
   */
  const loadDefectCatalog = useCallback(async () => {
    setDefectCatalogLoading(true);
    setDefectCatalogError(null);
    try {
      const res = await axios.get(`${API_BASE}/defect-catalog`, {
        headers: { ...authHeaders() },
      });
      const data = Array.isArray(res.data) ? res.data : [];

      const normalized: DefectCatalogItem[] = data
        .map((r: any, idx: number) => {
          const defect = String(r?.defect ?? "").trim();
          const rawTypes = r?.defect_types ?? r?.defectTypes ?? [];

          const types = Array.isArray(rawTypes)
            ? rawTypes
                .map((x: any) => String(x ?? "").trim())
                .filter(Boolean)
            : String(rawTypes ?? "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean);

          if (!defect) return null;

          return {
            id: Number.isFinite(r?.id) ? Number(r.id) : idx + 1,
            defect,
            defect_types: types,
          };
        })
        .filter(Boolean) as DefectCatalogItem[];

      setDefectCatalog(normalized);
    } catch (err) {
      console.error(err);
      setDefectCatalogError(
        "불량 목록을 불러오지 못했습니다. (fallback 목록 사용)"
      );
    } finally {
      setDefectCatalogLoading(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadDefectCatalog();
      if (!alive) {
        // 컴포넌트가 언마운트된 경우 추가 후처리 없음
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadDefectCatalog]);

  /** 자동 채움 */
  useEffect(() => {
    const savedRaw = localStorage.getItem("selected_machine_id") || "";
    const mid = normalizeMachineId(savedRaw);

    setSelectedMachineId(mid);
    if (!mid) return;

    // ✅ machineNo 기본 세팅
    setMeta((p) => ({ ...p, machineNo: p.machineNo || mid }));

    // ✅ 대시보드 → 장비정보 입력폼(EquipmentInfoPage)에서 저장해둔 값이 있으면
    //    Rowdata 공통정보(sn/chillerSn)에 우선 반영
    try {
      const raw = localStorage.getItem("machine_info_intent");
      if (raw) {
        const intent = JSON.parse(raw) as MachineInfoIntent | any;
        const intentMid = normalizeMachineId(
          String(intent?.machineId ?? intent?.machine_id ?? "")
        );

        // 다른 장비 값이 섞이는 걸 방지: machineId가 같을 때만 적용
        if (
          intentMid &&
          intentMid.toLowerCase() === mid.toLowerCase() &&
          intent?.values
        ) {
          const v = intent.values;

          const sn =
            typeof v.serialNumber === "string"
              ? v.serialNumber
              : typeof v.serial_number === "string"
                ? v.serial_number
                : "";

          const ch =
            typeof v.chillerSerialNumber === "string"
              ? v.chillerSerialNumber
              : typeof v.chiller_serial_number === "string"
                ? v.chiller_serial_number
                : typeof v.chiller_sn === "string"
                  ? v.chiller_sn
                  : typeof v.chillerSn === "string"
                    ? v.chillerSn
                    : "";

          setMeta((p) => ({
            ...p,
            machineNo: p.machineNo || mid,
            sn: p.sn || (sn ?? ""),
            chillerSn: p.chillerSn || (ch ?? ""),
          }));
        }
      }
    } catch {
      // ignore
    }


    // ✅ site/slot 기반 상세에서 serial/chiller serial 우선 채우기
    // - equip-progress 응답에 serial_number/chiller_serial_number가 없거나 null인 경우 대비
    // - 대시보드에서 선택한 site/slot을 localStorage에서 읽어옵니다.
    try {
      const site =
        localStorage.getItem("selected_site") ||
        localStorage.getItem("selectedSite") ||
        "";
      const slot =
        localStorage.getItem("selected_slot") ||
        localStorage.getItem("selectedSlot") ||
        localStorage.getItem("selected_slot_code") ||
        "";

      if (site.trim() && slot.trim() && slot.trim() !== "-") {
        fetchEquipmentDetailBySlot(site, slot).then((d) => {
          if (!d) return;

          const dMid = normalizeMachineId(String(d.machine_id ?? ""));
          // slot의 장비와 현재 선택된 machine_id가 다르면 적용하지 않음(값 섞임 방지)
          if (dMid && dMid.toLowerCase() !== mid.toLowerCase()) return;

          setMeta((p) => ({
            ...p,
            sn: p.sn || (d.serial_number ?? ""),
            chillerSn: p.chillerSn || pickChiller(d),
          }));
        });
      }
    } catch {
      // ignore
    }

    axios
      .get(`${API_BASE}/equip-progress/by-machine`, {
        params: { machine_id: mid },
        headers: { ...authHeaders() },
      })
      .then((res) => {
        const ep: EquipProgressRes = res.data;
        setEquipInfo(ep);

        setMeta((p) => ({
          ...p,
          machineNo: p.machineNo || ep.machine_id || mid,
          // 로컬 intent가 있으면 그 값을 유지하고, 없을 때만 equip_progress 값을 채움
          sn: p.sn || (ep.serial_number ?? ""),
          chillerSn: p.chillerSn || pickChiller(ep),
        }));

        // ✅ equip-progress에서 site/slot을 내려주는 경우, 그 값으로도 detail 재조회(더 안정적)
        const epSite = String(ep.site ?? "").trim();
        const epSlot = String(ep.slot_code ?? "").trim();
        if (epSite && epSlot) {
          fetchEquipmentDetailBySlot(epSite, epSlot).then((d) => {
            if (!d) return;

            setMeta((p) => ({
              ...p,
              sn: p.sn || (d.serial_number ?? ""),
              chillerSn: p.chillerSn || pickChiller(d),
            }));
          });
        }

      })
      .catch(console.error);

    axios
      .get(`${API_BASE}/setup-sheets/setting-dates`, {
        params: { machine_no: mid },
        headers: { ...authHeaders() },
      })
      .then((res) => {
        const sd: SettingDatesRes = res.data;
        setMeta((p) => ({
          ...p,
          setupStart: p.setupStart || (sd.start_date ?? ""),
          setupEnd: p.setupEnd || (sd.end_date ?? ""),
        }));
      })
      .catch((err) => {
        if (err?.response?.status === 404) return;
        console.error(err);
      });
  }, []);

  const onMeta = (k: keyof MetaState, v: string) =>
    setMeta((p) => ({ ...p, [k]: v }));

  /** ✅ 데이터 동기화 — 호기 번호만 입력하고 누르면 공통 정보가 자동으로 채워짐 */
  const handleSyncFromDb = async () => {
    const mid = (meta.machineNo || "").trim();
    if (!mid) {
      alert("호기 번호를 먼저 입력해주세요.");
      return;
    }

    setSyncing(true);
    try {
      // 1) sync-info (시리얼/칠러SN/담당자/고객사/출하일 등 다른 테이블 참조 정보)
      const info = await fetchEquipmentSyncInfo(mid);

      // 2) equip-progress (site/slot/manager 등 공통 정보) - equipInfo 패널 갱신용
      let ep: EquipProgressRes | null = null;
      try {
        const res = await axios.get(`${API_BASE}/equip-progress/by-machine`, {
          params: { machine_id: mid },
          headers: { ...authHeaders() },
        });
        ep = res.data as EquipProgressRes;
        setEquipInfo(ep);
      } catch (e) {
        // 404 등은 무시 - 다른 소스로도 채워질 수 있음
      }

      // 3) site/slot 기반 상세 (sync-info에 누락이 있을 때 보강)
      let detailFill: { sn?: string; chillerSn?: string } = {};
      if (ep?.site && ep?.slot_code) {
        const d = await fetchEquipmentDetailBySlot(String(ep.site), String(ep.slot_code));
        if (d) {
          detailFill = {
            sn: d.serial_number ?? "",
            chillerSn: pickChiller(d),
          };
        }
      }

      // 4) setting-dates (세팅 시작/종료일)
      let dateFill: { setupStart?: string; setupEnd?: string } = {};
      try {
        const sdRes = await axios.get(`${API_BASE}/setup-sheets/setting-dates`, {
          params: { machine_no: mid },
          headers: { ...authHeaders() },
        });
        const sd: SettingDatesRes = sdRes.data;
        dateFill = {
          setupStart: sd?.start_date ?? "",
          setupEnd: sd?.end_date ?? "",
        };
      } catch (e: any) {
        if (e?.response?.status && e.response.status !== 404) console.error(e);
      }

      // 폼에 채우기 (사용자가 이미 입력한 값은 덮어쓰지 않음)
      const filled: string[] = [];
      setMeta((p) => {
        const next = { ...p };
        if (!next.machineNo) next.machineNo = mid;

        const nextSn =
          (info?.serial_number ?? "") ||
          (ep?.serial_number ?? "") ||
          (detailFill.sn ?? "");
        if (!next.sn && nextSn) {
          next.sn = nextSn;
          filled.push("시리얼");
        }

        const nextChiller =
          (info?.chiller_serial_number ?? "") ||
          pickChiller(ep ?? {}) ||
          (detailFill.chillerSn ?? "");
        if (!next.chillerSn && nextChiller) {
          next.chillerSn = nextChiller;
          filled.push("칠러 시리얼");
        }

        if (!next.setupStart && dateFill.setupStart) {
          next.setupStart = dateFill.setupStart;
          filled.push("세팅 시작일");
        }
        if (!next.setupEnd && dateFill.setupEnd) {
          next.setupEnd = dateFill.setupEnd;
          filled.push("세팅 종료일");
        }

        return next;
      });

      // 5) ✅ 기존에 저장된 row data 복원 (있으면 폼에 채워서 수정 가능)
      let loadedRowsCount = 0;
      let loadedSheetId: number | null = null;
      try {
        const sheetRows = await fetchSetupSheetRows(mid);
        console.log("[sync] 호기", mid, "에서", sheetRows.length, "개 행 로드");
        if (sheetRows.length > 0) {
          // step별로 rowsToStepState 헬퍼 호출 (snake/camelCase 모두 처리)
          const newSummary: Partial<Record<StepType, SummaryRow>> = {};
          const newSummaryEnabled: Partial<Record<StepType, boolean>> = {};
          const newDetails: Partial<Record<StepType, DetailRow[]>> = {};

          for (const step of STEPS) {
            const r = rowsToStepState(sheetRows, step);
            if (r.sheetId !== null && (loadedSheetId === null || r.sheetId > loadedSheetId)) {
              loadedSheetId = r.sheetId;
            }
            if (r.summary) {
              newSummary[step] = r.summary;
              newSummaryEnabled[step] = true;
              loadedRowsCount += 1;
            } else if (r.details.length > 0) {
              // 행이 있지만 요약(총 소요시간) 행이 없으면 비활성화
              newSummaryEnabled[step] = false;
            }
            if (r.details.length > 0) {
              newDetails[step] = r.details;
              loadedRowsCount += r.details.length;
            }
          }

          console.log("[sync] 적용할 step별 행:", {
            summary: Object.keys(newSummary),
            details: Object.fromEntries(
              Object.entries(newDetails).map(([k, v]) => [k, v?.length ?? 0])
            ),
            loadedSheetId,
          });

          if (loadedRowsCount > 0) {
            setSheetId(loadedSheetId);
            setSummaryByStep(
              (prev) => ({ ...prev, ...newSummary }) as Record<StepType, SummaryRow>
            );
            setSummaryEnabledByStep(
              (prev) => ({ ...prev, ...newSummaryEnabled }) as Record<StepType, boolean>
            );
            setDetailsByStep(
              (prev) => ({ ...prev, ...newDetails }) as Record<StepType, DetailRow[]>
            );

            // meta 보강
            const anyRow: any = sheetRows[0];
            if (anyRow) {
              setMeta((p) => ({
                ...p,
                sn: p.sn || String(anyRow.sn ?? anyRow.serial_number ?? ""),
                chillerSn:
                  p.chillerSn ||
                  String(anyRow.chiller_sn ?? anyRow.chiller_serial_number ?? ""),
                setupStart:
                  p.setupStart ||
                  String(anyRow.setup_start_date ?? anyRow.setupStartDate ?? ""),
                setupEnd:
                  p.setupEnd ||
                  String(anyRow.setup_end_date ?? anyRow.setupEndDate ?? ""),
              }));
            }
          } else {
            console.warn(
              "[sync] 응답에 행은 있지만 step별 분류 결과가 비어있음. 응답 첫 행:",
              sheetRows[0]
            );
            setSheetId(null);
          }
        } else {
          // 기존 데이터가 없으면 새 입력 모드 (sheetId 초기화)
          setSheetId(null);
        }
      } catch (e) {
        console.error("기존 row data 로드 실패:", e);
      }

      // 안내
      const hasAnySource =
        !!info ||
        !!ep ||
        !!detailFill.sn ||
        !!detailFill.chillerSn ||
        !!dateFill.setupStart ||
        !!dateFill.setupEnd ||
        loadedRowsCount > 0;

      if (!hasAnySource) {
        alert(`호기 "${mid}" 에 해당하는 동기화 데이터가 없습니다.`);
      } else if (loadedRowsCount > 0) {
        alert(
          `불러오기를 완료했습니다.
기존 작성된 row data ${loadedRowsCount}건을 폼에 복원했습니다. (수정 후 저장하면 덮어쓰기 됩니다)`
        );
      } else {
        alert("불러오기를 완료했습니다.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "동기화 중 오류가 발생했습니다.");
    } finally {
      setSyncing(false);
    }
  };

  const onEnterNext = (
    e: React.KeyboardEvent<NextableEl>,
    opts?: { allowNewline?: boolean }
  ) => {
    if (e.key !== "Enter") return;
    if (opts?.allowNewline && e.shiftKey) return;
    e.preventDefault();
    focusNextFrom(e.currentTarget);
  };

  const changeStep = (s: StepType) => {
    setCurrentStep(s);

    // 요약행 기본값 보정
    setSummaryByStep((prev) => {
      const next = { ...prev };
      if (!next[s]) {
        next[s] = {
          setupHours: DEFAULT_SETUP_HOURS[s] ?? "",
          applyText: "",
          remark: "",
        };
      }
      return next;
    });
    setSummaryEnabledByStep((prev) => ({ ...prev, [s]: prev[s] ?? true }));
    setDetailsByStep((prev) => ({ ...prev, [s]: prev[s] ?? [] }));
  };

  const setSummaryField = (k: keyof SummaryRow, v: string) => {
    setSummaryByStep((prev) => ({
      ...prev,
      [currentStep]: { ...prev[currentStep], [k]: v },
    }));
  };

  // ✅ 요약행 "행 자체 삭제"
  const deleteSummaryRow = () => {
    setSummaryEnabledByStep((prev) => ({ ...prev, [currentStep]: false }));
  };
  const restoreSummaryRow = () => {
    setSummaryEnabledByStep((prev) => ({ ...prev, [currentStep]: true }));
  };

  const updateDetail = (idx: number, key: keyof DetailRow, value: string) => {
    setDetailsByStep((prev) => {
      const list = [...(prev[currentStep] ?? [])];
      let row: DetailRow = { ...list[idx], [key]: value as any };

      if (key === "tsMinutes") {
        const score = scoreFromMinutes(
          value.trim() === "" ? null : parseFloat(value)
        );
        row.qualityScore = score == null ? "" : String(score);
      }

      if (key === "defect") {
        const types = defectTypesByDefect[value] ?? [];
        if (types.length > 0) row.defectType = types[0] ?? "";
      }

      row = applyDetailRules(row, currentStep);
      list[idx] = row;

      return { ...prev, [currentStep]: list };
    });
  };

  const addDetailRow = () => {
    // ✅ 새 행을 "맨 위"에 추가 (스크롤 내릴 필요 없음)
    setDetailsByStep((prev) => ({
      ...prev,
      [currentStep]: [makeEmptyDetail(currentStep), ...(prev[currentStep] ?? [])],
    }));
  };

  const removeDetail = (idx: number) => {
    setDetailsByStep((prev) => ({
      ...prev,
      [currentStep]: (prev[currentStep] ?? []).filter((_, i) => i !== idx),
    }));
  };

  const validate = () => {
    if (!meta.machineNo.trim()) return "장비번호를 입력해주세요.";
    return null;
  };

  /** ✅ 저장: 요약행 삭제돼도 동작하도록 보완 */
  const [loading, setLoading] = useState(false);

  const buildDetailStepPayload = (r: DetailRow) => ({
    step_name: currentStep,
    setup_hours: null,
    defect_detail: isMod ? null : r.defectDetail || null,
    quality_score: r.qualityScore === "" ? null : Number(r.qualityScore),
    ts_hours: r.tsMinutes === "" ? null : Number(r.tsMinutes),
    hw_sw: isMod ? null : r.hwSw || null,
    defect_group: isMod ? null : r.defectGroup || null,
    defect_location: isMod ? null : r.defectLocation || null,
    defect: isMod ? null : r.defect || null,
    defect_type: isMod ? null : r.defectType || null,
    remark: r.remark || null,
  });

  const handleSave = async () => {
    const msg = validate();
    if (msg) return alert(msg);

    try {
      setLoading(true);

      const metaPayload = {
        machine_no: meta.machineNo || null,
        sn: meta.sn || null,
        chiller_sn: meta.chillerSn || null,
        setup_start_date: meta.setupStart || null,
        setup_end_date: meta.setupEnd || null,
      };

      let sid = sheetId ?? null;

      // ✅ 기존 sheet의 "현재 step"에 해당하는 행들만 삭제 (다른 step은 보존)
      if (sid !== null) {
        try {
          const existing = await fetchSetupSheetRowsByStep(
            meta.machineNo,
            currentStep
          );
          // sheet_id + step_name 모두로 필터 (백엔드가 step 파라미터를 무시해도 안전)
          const targetRows = existing.filter(
            (r) =>
              Number(r?.sheet_id ?? r?.sheetId ?? 0) === sid &&
              String(r?.step_name ?? r?.stepName ?? "").trim() === currentStep
          );
          for (const r of targetRows) {
            const id = r?.id;
            if (!id) continue;
            try {
              await axios.delete(
                `${API_BASE}/setup-sheets/manage/step/${encodeURIComponent(String(id))}`,
                { headers: { ...authHeaders() }, timeout: 15000 }
              );
            } catch (e: any) {
              const st = e?.response?.status;
              if (st === 404 || st === 405) {
                await axios.post(
                  `${API_BASE}/setup-sheets/manage/delete-step`,
                  { id },
                  { headers: { ...authHeaders() }, timeout: 15000 }
                );
              } else {
                throw e;
              }
            }
          }
        } catch (e) {
          console.error("기존 step 행 삭제 실패:", e);
          alert(
            "기존 행 삭제에 실패했습니다. 저장 후 중복 행이 생기면 동기화 후 다시 저장해주세요."
          );
        }
      }

      // ✅ 요약행이 없을 때, "아래부터 저장"을 위해
      // sheetId 생성에 사용할 상세행 인덱스를 기억
      let createdFromDetailIndex: number | null = null;

      // 1) 첫 호출로 sheetId 확보
      if (summaryEnabled) {
        const summaryStep = {
          step_name: currentStep,
          setup_hours: summary.setupHours === "" ? null : Number(summary.setupHours),
          defect_detail: isCommon ? (summary.applyText || null) : null,
          quality_score: null,
          ts_hours: null,
          hw_sw: null,
          defect_group: null,
          defect_location: null,
          defect: null,
          defect_type: null,
          remark: isCommon ? (summary.remark || null) : null,
        };

        const firstRes = await axios.post(
          `${API_BASE}/setup-sheets/save`,
          { sheetId: sid, meta: metaPayload, step: summaryStep },
          { headers: { ...authHeaders() } }
        );
        sid = firstRes.data?.sheetId ?? sid;
      } else {
        // 요약행이 삭제된 경우 → "맨 아래 상세행"으로 sheetId 만들기
        if (details.length > 0) {
          const lastIdx = details.length - 1;

          const firstRes = await axios.post(
            `${API_BASE}/setup-sheets/save`,
            {
              sheetId: sid,
              meta: metaPayload,
              step: buildDetailStepPayload(details[lastIdx]),
            },
            { headers: { ...authHeaders() } }
          );
          sid = firstRes.data?.sheetId ?? sid;
          createdFromDetailIndex = lastIdx;
        } else {
          // 요약행도 없고 상세행도 없으면: 최소 step으로 sheet만 생성
          const dummy = {
            step_name: currentStep,
            setup_hours: null,
            defect_detail: null,
            quality_score: null,
            ts_hours: null,
            hw_sw: null,
            defect_group: null,
            defect_location: null,
            defect: null,
            defect_type: null,
            remark: null,
          };
          const firstRes = await axios.post(
            `${API_BASE}/setup-sheets/save`,
            { sheetId: sid, meta: metaPayload, step: dummy },
            { headers: { ...authHeaders() } }
          );
          sid = firstRes.data?.sheetId ?? sid;
        }
      }

      if (!sid) throw new Error("sheetId 생성 실패");
      setSheetId(sid);

      // 2) 상세행 저장 순서: 아래 -> 위
      if (summaryEnabled) {
        for (let i = details.length - 1; i >= 0; i--) {
          await axios.post(
            `${API_BASE}/setup-sheets/save`,
            { sheetId: sid, meta: metaPayload, step: buildDetailStepPayload(details[i]) },
            { headers: { ...authHeaders() } }
          );
        }
      } else {
        const start = details.length - 1;
        for (let i = start; i >= 0; i--) {
          if (createdFromDetailIndex !== null && i === createdFromDetailIndex) continue;

          await axios.post(
            `${API_BASE}/setup-sheets/save`,
            { sheetId: sid, meta: metaPayload, step: buildDetailStepPayload(details[i]) },
            { headers: { ...authHeaders() } }
          );
        }
      }

      alert("저장 완료");
    } catch (e: any) {
      console.error(e);
      alert(e?.response?.data?.detail ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => navigate(-1);

  const rowBadge = `Rows: ${summaryEnabled ? 1 : 0} + ${details.length}`;

  return (
    <div className={PAGE_BG}>
      <div className={FRAME}>
        <div className={PANEL}>
          <div className="h-2 bg-gradient-to-r from-teal-400 via-sky-500 to-fuchsia-500" />

          <main className={CONTENT}>
            {/* 상단 헤더 */}
            <section className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-slate-500">MES</div>
                <div className="text-2xl font-extrabold tracking-tight text-slate-900">
                  Raw Data 입력
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  선택 장비:{" "}
                  <span className="font-semibold text-slate-700">
                    {meta.machineNo || selectedMachineId || "-"}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-none bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-white"
                >
                  뒤로가기
                </button>

                <button
                  type="button"
                  onClick={() => setDefectCatalogModalOpen(true)}
                  className="rounded-none bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-white"
                  title="현재 입력 중인 row data 를 잃지 않고 같은 화면 위에서 불량 항목을 관리합니다."
                >
                  불량 항목 관리
                </button>


                {defectCatalogLoading && (
                  <span className="rounded-none bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/70">
                    불량목록 로딩중…
                  </span>
                )}
                {defectCatalogError && (
                  <span className="rounded-none bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                    {defectCatalogError}
                  </span>
                )}

                {sheetId && (
                  <span className="rounded-none bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70">
                    sheetId: {sheetId}
                  </span>
                )}
              </div>
            </section>

            {/* Step 선택 전 메모 */}
            <div className="rounded-none bg-white/70 px-5 py-4 ring-1 ring-slate-200/60">
              <div className="text-xs font-extrabold text-slate-700">메모</div>
              <div className="mt-1 text-sm text-slate-600">
                Stage는 <b>Origin, 온도</b>까지 / 그 외 Stage 관련 내용은 전부{" "}
                <b>STAGE(Advanced)</b>에 포함
              </div>
            </div>

            {/* 스텝 탭 */}
            <div className="rounded-none bg-white/70 px-4 py-3 ring-1 ring-slate-200/60">
              <div className="mb-2 text-xs font-semibold text-slate-500">
                Step 선택{" "}
                <span className="ml-2 font-normal text-slate-400">
                  현재 Step만 저장됩니다.
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {STEPS.map((s) => {
                  const active = s === currentStep;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => changeStep(s)}
                      className={[
                        "rounded-none px-4 py-2 text-sm font-extrabold transition",
                        active
                          ? "bg-sky-600 text-white shadow-sm"
                          : "bg-white/80 text-slate-700 ring-1 ring-slate-200/70 hover:bg-white",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 공통 정보 */}
            <Shell
              header="공통 정보"
              badge="Meta"
              headerRight={
                <button
                  type="button"
                  onClick={handleSyncFromDb}
                  disabled={syncing || !meta.machineNo.trim()}
                  title={
                    !meta.machineNo.trim()
                      ? "호기 번호를 먼저 입력해주세요"
                      : "호기 번호 기준으로 DB에서 공통 정보를 가져옵니다"
                  }
                  className={`shrink-0 rounded-none px-3 py-2 text-sm font-semibold text-white shadow-sm transition ${
                    syncing || !meta.machineNo.trim()
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-sky-600 hover:bg-sky-700"
                  }`}
                >
                  {syncing ? "동기화 중..." : "🔄 데이터 동기화"}
                </button>
              }
            >
              <div className="px-7 pb-7 pt-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <Field label="장비번호" hint="예: D(e)-13-03">
                    <input
                      data-enter-next="1"
                      className={inputBase}
                      value={meta.machineNo}
                      onChange={(e) => onMeta("machineNo", e.target.value)}
                      onKeyDown={(e) => onEnterNext(e)}
                      placeholder="예: D(e)-13-03"
                    />
                  </Field>

                  <Field label="S/N" hint="예: SN-0001">
                    <input
                      data-enter-next="1"
                      className={inputBase}
                      value={meta.sn}
                      onChange={(e) => onMeta("sn", e.target.value)}
                      onKeyDown={(e) => onEnterNext(e)}
                      placeholder="예: SN-0001"
                    />
                  </Field>

                  <Field label="Chiller S/N" hint="예: CH-0001">
                    <input
                      data-enter-next="1"
                      className={inputBase}
                      value={meta.chillerSn}
                      onChange={(e) => onMeta("chillerSn", e.target.value)}
                      onKeyDown={(e) => onEnterNext(e)}
                      placeholder="예: CH-0001"
                    />
                  </Field>

                  <Field label="세팅 시작일">
                    <input
                      data-enter-next="1"
                      type="date"
                      className={inputBase}
                      value={meta.setupStart}
                      onChange={(e) => onMeta("setupStart", e.target.value)}
                      onKeyDown={(e) => onEnterNext(e)}
                    />
                  </Field>

                  <Field label="세팅 종료일">
                    <input
                      data-enter-next="1"
                      type="date"
                      className={inputBase}
                      value={meta.setupEnd}
                      onChange={(e) => onMeta("setupEnd", e.target.value)}
                      onKeyDown={(e) => onEnterNext(e)}
                    />
                  </Field>
                </div>

                {equipInfo && (
                  <div className={["mt-5 p-4", softPanel].join(" ")}>
                    <div className="text-xs font-extrabold text-slate-700">
                      자동 조회 정보
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-600 md:grid-cols-3">
                      <div>
                        <span className="text-slate-500">Site</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {equipInfo.site ?? "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Slot</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {equipInfo.slot_code ?? "-"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">Manager</span>{" "}
                        <span className="font-semibold text-slate-800">
                          {equipInfo.manager ?? "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Shell>

            {/* 스텝 입력 */}
            <Shell
              header={`${currentStep} 스텝 입력`}
              badge={rowBadge}
            >
              <div className="px-7 pb-10 pt-6">
                {/* ✅ 스크롤 내려도 항상 보이는 Sticky 액션바 */}
                <div className="sticky top-3 z-30 -mx-7 mb-4 flex flex-wrap items-center justify-end gap-2 rounded-none bg-white/85 px-4 py-3 shadow-sm ring-1 ring-slate-200/70 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => {
                      setSummaryByStep((prev) => ({
                        ...prev,
                        [currentStep]: {
                          setupHours: DEFAULT_SETUP_HOURS[currentStep] ?? "",
                          applyText: "",
                          remark: "",
                        },
                      }));
                      setDetailsByStep((prev) => ({
                        ...prev,
                        [currentStep]: [],
                      }));
                      setSummaryEnabledByStep((prev) => ({
                        ...prev,
                        [currentStep]: true,
                      }));
                    }}
                    className="rounded-none bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-200/70 hover:bg-white"
                  >
                    초기화
                  </button>

                  <button
                    type="button"
                    onClick={addDetailRow}
                    className="rounded-none bg-gradient-to-r from-sky-600 to-teal-600 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:from-sky-700 hover:to-teal-700"
                  >
                    행 추가
                  </button>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={loading}
                    className="rounded-none bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:from-orange-600 hover:to-amber-600 disabled:opacity-60"
                  >
                    저장
                  </button>
                </div>
                {/* ✅ 요약행(#1) - "행 자체 삭제" 지원 */}
                {summaryEnabled ? (
                  <div className="overflow-hidden rounded-none bg-white shadow-md ring-2 ring-sky-200 relative">
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-sky-400" />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-sky-100 bg-gradient-to-r from-sky-50 via-white to-sky-50 px-5 py-3 pl-6">
                      <div className="flex items-center gap-2">
                        <span className="rounded-none bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">
                          #1
                        </span>
                        <span className="text-sm font-extrabold text-slate-700">
                          총 소요시간 (이 step의 합계)
                        </span>
                      </div>

                      {/* ✅ 행 삭제 버튼(완전 삭제) */}
                      <button
                        type="button"
                        onClick={deleteSummaryRow}
                        className="rounded-none bg-red-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-red-600"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="p-5">
                      {isCommon ? (
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                          <Field
                            label="세팅 총 소요시간(시간)"
                            hint={
                              DEFAULT_SETUP_HOURS[currentStep]
                                ? `기본: ${DEFAULT_SETUP_HOURS[currentStep]}`
                                : undefined
                            }
                          >
                            <input
                              data-enter-next="1"
                              className={inputBase}
                              value={summary.setupHours}
                              onChange={(e) =>
                                setSummaryField("setupHours", e.target.value)
                              }
                              onKeyDown={(e) => onEnterNext(e)}
                              placeholder="예: 5"
                            />
                          </Field>

                          {/* ✅ 적용/비고는 “세로 조절” 가능하도록 textarea로 */}
                          <Field label="적용" hint="드래그로 높이 조절">
                            <textarea
                              data-enter-next="1"
                              className={textareaCompact}
                              value={summary.applyText}
                              onChange={(e) =>
                                setSummaryField("applyText", e.target.value)
                              }
                              onKeyDown={(e) =>
                                onEnterNext(e, { allowNewline: true })
                              }
                              placeholder="적용 내용"
                            />
                          </Field>

                          <Field label="비고" hint="드래그로 높이 조절">
                            <textarea
                              data-enter-next="1"
                              className={textareaCompact}
                              value={summary.remark}
                              onChange={(e) =>
                                setSummaryField("remark", e.target.value)
                              }
                              onKeyDown={(e) =>
                                onEnterNext(e, { allowNewline: true })
                              }
                              placeholder="비고"
                            />
                          </Field>
                        </div>
                      ) : (
                        <div className="max-w-[520px]">
                          <Field
                            label="세팅 총 소요시간(시간)"
                            hint={
                              DEFAULT_SETUP_HOURS[currentStep]
                                ? `기본: ${DEFAULT_SETUP_HOURS[currentStep]}`
                                : undefined
                            }
                          >
                            <input
                              data-enter-next="1"
                              className={inputBase}
                              value={summary.setupHours}
                              onChange={(e) =>
                                setSummaryField("setupHours", e.target.value)
                              }
                              onKeyDown={(e) => onEnterNext(e)}
                              placeholder="예: 2.5"
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-none bg-slate-50 ring-2 ring-slate-200 shadow-sm">
                    <div className="flex items-center justify-between gap-3 border-b-2 border-slate-200 bg-slate-100 px-5 py-3">
                      <div className="text-sm font-extrabold text-slate-700">
                        총 소요시간 행(#1)이 삭제되었습니다.
                      </div>
                      <button
                        type="button"
                        onClick={restoreSummaryRow}
                        className="rounded-none bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-slate-950"
                      >
                        총 소요시간 행 복구
                      </button>
                    </div>
                    <div className="p-5 text-sm text-slate-600">
                      필요하면 "총 소요시간 행 복구"로 다시 추가할 수 있어요.
                    </div>
                  </div>
                )}

                {/* 상세행들(2행부터) */}
                <div className="mt-5 space-y-5">
                  {details.map((r, idx) => {
                    const rowNo = idx + 2;
                    const defectTypeOptions =
                      defectTypesByDefect[r.defect] ?? allDefectTypes;

                    return (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-none bg-white shadow-md ring-2 ring-orange-200 relative"
                      >
                        <div className="absolute inset-y-0 left-0 w-1.5 bg-orange-400" />
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-orange-100 bg-gradient-to-r from-orange-50 via-white to-orange-50 px-5 py-3 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="rounded-none bg-slate-900 px-3 py-1 text-xs font-extrabold text-white">
                              #{rowNo}
                            </span>
                            <span className="text-sm font-extrabold text-slate-700">
                              트러블 슛 행
                            </span>
                            {isMod && (
                              <span className="rounded-none bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-200">
                                개조: T.S + 비고만
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removeDetail(idx)}
                            className="rounded-none bg-red-500 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-red-600"
                          >
                            삭제
                          </button>
                        </div>

                        <div className="p-5">
                          {isMod ? (
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <Field label="T.S 소요(분)" hint="예: 25">
                                <input
                                  data-enter-next="1"
                                  className={inputBase}
                                  value={r.tsMinutes}
                                  onChange={(e) =>
                                    updateDetail(idx, "tsMinutes", e.target.value)
                                  }
                                  onKeyDown={(e) => onEnterNext(e)}
                                  placeholder="예: 25"
                                />
                              </Field>

                              <Field label="비고" hint="개조 내용">
                                <input
                                  data-enter-next="1"
                                  className={inputBase}
                                  value={r.remark}
                                  onChange={(e) =>
                                    updateDetail(idx, "remark", e.target.value)
                                  }
                                  onKeyDown={(e) => onEnterNext(e)}
                                  placeholder="개조 내용/비고"
                                />
                              </Field>
                            </div>
                          ) : (
                            <>
                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                                <Field label="H/W, S/W" hint="default: H/W">
                                  <select
                                    data-enter-next="1"
                                    className={selectBase}
                                    value={r.hwSw}
                                    onChange={(e) =>
                                      updateDetail(idx, "hwSw", e.target.value)
                                    }
                                    onKeyDown={(e) => onEnterNext(e)}
                                    disabled={isHW}
                                  >
                                    {HW_SW_OPTIONS.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                <Field label="불량구분" hint="default: 단순 하드웨어">
                                  <select
                                    data-enter-next="1"
                                    className={selectBase}
                                    value={r.defectGroup}
                                    onChange={(e) =>
                                      updateDetail(idx, "defectGroup", e.target.value)
                                    }
                                    onKeyDown={(e) => onEnterNext(e)}
                                    disabled={isHW}
                                  >
                                    {DEFECT_GROUP_OPTIONS.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                <Field label="불량위치">
                                  <select
                                    data-enter-next="1"
                                    className={selectBase}
                                    value={r.defectLocation}
                                    onChange={(e) =>
                                      updateDetail(
                                        idx,
                                        "defectLocation",
                                        e.target.value
                                      )
                                    }
                                    onKeyDown={(e) => onEnterNext(e)}
                                  >
                                    <option value="">(선택)</option>
                                    {LOCATION_OPTIONS.map((o) => (
                                      <option key={o} value={o}>
                                        {o}
                                      </option>
                                    ))}
                                  </select>
                                </Field>

                                <Field label="불량">
                                  <OptionPickerInput
                                    value={r.defect}
                                    onChangeValue={(v) =>
                                      updateDetail(idx, "defect", v)
                                    }
                                    options={defectOptions}
                                    placeholder="클릭해서 선택"
                                    inputClassName={inputBase}
                                    title="불량 선택"
                                  />
                                </Field>

                                <Field label="불량유형">
                                  <OptionPickerInput
                                    value={r.defectType}
                                    onChangeValue={(v) =>
                                      updateDetail(idx, "defectType", v)
                                    }
                                    options={defectTypeOptions}
                                    placeholder="클릭해서 선택"
                                    inputClassName={inputBase}
                                    title="불량유형 선택"
                                  />
                                </Field>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                                <Field label="T.S 소요(분)" hint="예: 25">
                                  <input
                                    data-enter-next="1"
                                    className={inputBase}
                                    value={r.tsMinutes}
                                    onChange={(e) =>
                                      updateDetail(idx, "tsMinutes", e.target.value)
                                    }
                                    onKeyDown={(e) => onEnterNext(e)}
                                    placeholder="예: 25"
                                  />
                                </Field>

                                <Field label="품질점수(자동)">
                                  <input
                                    data-enter-next="1"
                                    className={
                                      inputBase +
                                      " bg-slate-50/90 text-slate-600 border-slate-200/70"
                                    }
                                    value={r.qualityScore}
                                    readOnly
                                    onKeyDown={(e) => onEnterNext(e)}
                                  />
                                </Field>

                                <Field label="비고">
                                  <input
                                    data-enter-next="1"
                                    className={inputBase}
                                    value={r.remark}
                                    onChange={(e) =>
                                      updateDetail(idx, "remark", e.target.value)
                                    }
                                    onKeyDown={(e) => onEnterNext(e)}
                                    placeholder="비고"
                                  />
                                </Field>
                              </div>

                              <div className="mt-4">
                                <Field label="세부 불량(멀티라인)" hint="드래그로 높이 조절">
                                  <textarea
                                    data-enter-next="1"
                                    className={textareaBase}
                                    value={r.defectDetail}
                                    onChange={(e) =>
                                      updateDetail(idx, "defectDetail", e.target.value)
                                    }
                                    onKeyDown={(e) =>
                                      onEnterNext(e, { allowNewline: true })
                                    }
                                    placeholder="세부 불량 내용을 적어주세요"
                                  />
                                </Field>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Shell>
          </main>
        </div>
      </div>

      {/* ✅ 불량 항목 관리 모달
          - 별도 페이지로 이동하지 않으므로 입력 중이던 row data 가 그대로 유지됨
          - 모달이 닫힐 때 loadDefectCatalog 를 다시 호출해서
            row data 폼의 불량/불량유형 셀렉트 옵션을 최신 상태로 갱신 */}
      <DefectCatalogModal
        open={defectCatalogModalOpen}
        onClose={() => {
          setDefectCatalogModalOpen(false);
          // 모달이 닫히는 시점에 항상 최신 카탈로그를 다시 불러온다.
          loadDefectCatalog();
        }}
      />
    </div>
  );
}
