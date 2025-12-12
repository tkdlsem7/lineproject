// src/pages/LogTableBrowser.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/** CRA/Vite 공용: 환경변수 → 없으면 '/api' */
const API_BASE = "http://192.168.101.1:8000/api";

type TableMeta = { name: string; columns: string[]; date_fields: string[] };
type RowsRes = { columns: string[]; rows: Record<string, any>[]; total: number };

const LIMIT = 20;
const EXPORT_CHUNK_DEFAULT = 200;

// 콤보박스에 보여줄 한글 라벨
const TABLE_LABELS: Record<string, string> = {
  setup_sheet_all: "Raw Data",
  equipment_progress_log: "장비 진척도 로그 ",
  equip_progress: "라인 현황",
  equipment_receipt_log: "장비 입고 로그",
  troubleshoot_entry: "Trouble Shoot",
  board_posts: "게시판",
  checklist: "옵션별 체크리스트",
  equipment_checklist_result: "장비별 진척도 체크리스트 현황",
  equipment_move_log: "장비 이동 로그",
  equipment_option: "장비별 옵션",
  equipment_shipment_log: "장비 출하 로그",
  task_option: "장비 옵션 리스트",
  users: "회원정보",
  // 필요하면 계속 추가
};

// ---------- Rawdata용 유틸/상수 ----------

// Rawdata 엑셀 헤더 순서
const RAWDATA_HEADERS = [
  "모델",
  "차분",
  "호기",
  "S/N",
  "Chiller S/N",
  "세팅시작일",
  "세팅종료일",
  "리드타임\n(사내 입고 - 출하)",
  "Step",
  "세팅총소요시간(단위 : 시간)",
  "HW/SW",
  "불량",
  "불량유형",
  "세부 불량",
  "품질점수",
  "T.S 소요 시간\n(단위 : 분)",
  "적용",
  "비고",
  "담당자",
  "불량구분",
  "불량 위치",
];

// 리드타임 3개 컬럼 이름 상수
const SUMMARY_LT_RECEIPT_SHIP = "사내 입고 - 출하 리드타임(일)";
const SUMMARY_LT_RECEIPT_COMPLETE = "사내 입고 - 생산 완료 리드타임(일)";
const SUMMARY_LT_RECEIPT_START = "사내 입고 - 생산 시작 리드타임(일)";

// 차분보고서취합 헤더 순서
const SUMMARY_HEADERS = [
  "모델",
  "차분",
  "호기",
  "S/N",
  "Chiller S/N",
  "출하요청일",
  "리드타임\n(사내 입고 - 출하, 단위 : 일)",
  "세팅총소요시간(단위 : 시간)",
  "세팅총소요시간(단위 : 시간)\nPacking&Delivery 포함",
  "입고 품질 점수(단위 : 점)",
  "불량 건수",
  "T.S 소요 시간\n(단위 : 분)",
  "Common",
  "Stage",
  "Loader",
  "STAGE(Advanced)",
  "Cold Test",
  "HW",
  "Option&ETC",
  "개조",
  "Packing&Delivery",
  "적용",
  "비고",
  "담당자",
  // 🔽 여기 두 줄 새로 추가 (복사본)
  "호기",
  "세팅총소요시간(단위 : 시간)",
  // 새 리드타임 3개
  SUMMARY_LT_RECEIPT_SHIP,
  SUMMARY_LT_RECEIPT_COMPLETE,
  SUMMARY_LT_RECEIPT_START,
];

// Step 이름 ↔ 요약 시트 컬럼 매핑 (각 Step의 행 개수 카운트)
const SUMMARY_STEP_KEYS: { header: string; match: string }[] = [
  { header: "Common", match: "Common" },
  { header: "Stage", match: "Stage" },
  { header: "Loader", match: "Loader" },
  { header: "STAGE(Advanced)", match: "STAGE(Advanced)" },
  { header: "Cold Test", match: "Cold Test" },
  { header: "HW", match: "HW" },
  { header: "Option&ETC", match: "Option&ETC" },
  { header: "개조", match: "개조" },
  { header: "Packing&Delivery", match: "Packing&Delivery" },
];

// 호기 첫 부분 → 모델 매핑
const MODEL_MAP: Record<string, string> = {
  F: "FD",
  C: "SC",
  "D(e)": "SD(e)",
  "E(e)": "SE(e)",
  "H(e)": "SH(e)",
  "T(e)": "SLT(e)",
  P: "SP",
  I: "ST(e)",
  J: "STP(e)",
};

const parseDateOnly = (val: any): Date | null => {
  if (!val) return null;
  const s = String(val);
  if (!s) return null;
  const ymd = s.length > 10 ? s.slice(0, 10) : s; // "YYYY-MM-DD..."
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return null;
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(dt.getTime()) ? null : dt;
};

// 날짜/시간 문자열 아무거나 → Date
const parseDateTime = (val: any): Date | null => {
  if (!val) return null;
  const s = String(val);
  if (!s) return null;
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt;
  // 안 먹히면 date-only 파서로 한 번 더
  return parseDateOnly(s);
};

const diffDays = (start: any, end: any): string => {
  const s = parseDateOnly(start);
  const e = parseDateOnly(end);
  if (!s || !e) return "";
  const ms = e.getTime() - s.getTime();
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  return String(days);
};

const diffDaysNumber = (start: Date | null, end: Date | null): number | null => {
  if (!start || !end) return null;
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

const calcModel = (machineNo: any): string => {
  if (!machineNo) return "";
  const raw = String(machineNo).trim();
  if (!raw) return "";
  const first = raw.split("-")[0]?.trim(); // "D(e)-08-01" → "D(e)"
  if (!first) return "";
  return MODEL_MAP[first] ?? first.toUpperCase();
};

const calcDiffString = (machineNo: any): string => {
  if (!machineNo) return "";
  const raw = String(machineNo).trim();
  if (!raw) return "";
  const parts = raw.split("-");
  if (parts.length < 2) return "";
  const model = calcModel(raw);
  const diff = parts[1];
  if (!model || !diff) return "";
  return `${model} ${diff}`;
};

// 한 행 → Rawdata 형식으로 변환
const buildRawRow = (
  row: Record<string, any>,
  apply: string,
  note: string,
  owner: string
): Record<string, any> => {
  const machineNo = row["machine_no"] ?? "";
  return {
    모델: calcModel(machineNo),
    차분: calcDiffString(machineNo),
    호기: machineNo,
    "S/N": row["sn"] ?? "",
    "Chiller S/N": row["chiller_sn"] ?? "",
    세팅시작일: row["setup_start_date"] ?? "",
    세팅종료일: row["setup_end_date"] ?? "",
    "리드타임\n(사내 입고 - 출하)": diffDays(
      row["setup_start_date"],
      row["setup_end_date"]
    ),
    Step: row["step_name"] ?? "",
    "세팅총소요시간(단위 : 시간)": row["setup_hours"] ?? "",
    "HW/SW": row["hw_sw"] ?? "",
    불량: row["defect"] ?? "",
    불량유형: row["defect_type"] ?? "",
    "세부 불량": row["defect_detail"] ?? "",
    품질점수: row["quality_score"] ?? "",
    "T.S 소요 시간\n(단위 : 분)": row["ts_hours"] ?? "",
    적용: apply,
    비고: note,
    담당자: owner,
    불량구분: row["defect_group"] ?? "",
    "불량 위치": row["defect_location"] ?? "",
  };
};

// ──────────────────────────────────────────
// 리드타임 계산용 타입 & 헬퍼
// ──────────────────────────────────────────
type LeadTimeTriple = {
  receipt_to_ship_days?: number | null;
  receipt_to_complete_days?: number | null;
  receipt_to_start_days?: number | null;
};

/**
 * 해당 호기 목록에 대해
 * - 사내 입고 - 출하 리드타임
 * - 사내 입고 - 생산 완료 리드타임
 * - 사내 입고 - 생산 시작 리드타임
 * 을 계산해서 map 형태로 리턴
 */
const fetchLeadTimesForMachines = async (
  machineNos: string[]
): Promise<Record<string, LeadTimeTriple>> => {
  // 1) 호기 문자열 정리 (trim + 중복 제거)
  const uniqueNos = Array.from(
    new Set(
      machineNos
        .map((m) => String(m ?? "").trim())
        .filter((m) => m.length > 0)
    )
  );

  const result: Record<string, LeadTimeTriple> = {};

  if (uniqueNos.length === 0) {
    return result;
  }

  try {
    // 2) 백엔드 리드타임 API 호출
    const { data } = await axios.post<{
      items: {
        machine_no: string;
        in_to_ship_days: number | null;
        in_to_done_days: number | null;
        in_to_start_days: number | null;
      }[];
    }>(`${API_BASE}/logs/leadtime`, {
      machine_nos: uniqueNos,
    }, {
      timeout: 30000,
    });

    // 3) 응답을 LeadTimeTriple 맵으로 변환
    for (const item of data.items ?? []) {
      const key = String(item.machine_no ?? "").trim();
      if (!key) continue;

      result[key] = {
        receipt_to_ship_days:
          item.in_to_ship_days != null ? Number(item.in_to_ship_days) : null,
        receipt_to_complete_days:
          item.in_to_done_days != null ? Number(item.in_to_done_days) : null,
        receipt_to_start_days:
          item.in_to_start_days != null ? Number(item.in_to_start_days) : null,
      };
    }
  } catch (e) {
    console.error("리드타임 계산 API 오류:", e);
  }

  return result;
};

// Rawdata 배열 → 차분보고서취합용 요약 배열
// (합계/평균 행 없이, 각 호기 1행 + 리드타임 3개 컬럼 포함)
const buildSummaryRows = (
  rawRows: Record<string, any>[],
  leadTimeMap: Record<string, LeadTimeTriple>
): Record<string, any>[] => {
  const grouped: Record<string, Record<string, any>[]> = {};

  // 호기(장비번호) 기준 그룹
  for (const row of rawRows) {
    const key = String(row["호기"] ?? "").trim();   // ← trim 추가
    if (!key) continue;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  }

  const result: Record<string, any>[] = [];

  Object.entries(grouped).forEach(([machineNo, groupRows]) => {
    const base = groupRows[0];

    let totalHoursNoPack = 0;
    let totalHoursWithPack = 0;
    let totalTsMinutes = 0;
    let defectCount = 0;
    let penalty = 0;

    const stepCounts: Record<string, number> = {};
    SUMMARY_STEP_KEYS.forEach(({ header }) => {
      stepCounts[header] = 0;
    });

    for (const r of groupRows) {
      const step = (r["Step"] ?? "").toString();

      const hoursVal = parseFloat(
        String(r["세팅총소요시간(단위 : 시간)"] ?? "")
      );
      const hours = isNaN(hoursVal) ? 0 : hoursVal;

      totalHoursWithPack += hours;
      if (step !== "Packing&Delivery") {
        totalHoursNoPack += hours;
      }

      const tsVal = parseFloat(
        String(r["T.S 소요 시간\n(단위 : 분)"] ?? "")
      );
      const ts = isNaN(tsVal) ? 0 : tsVal;
      totalTsMinutes += ts;

      const qVal = parseFloat(String(r["품질점수"] ?? ""));
      if (!isNaN(qVal)) {
        penalty += 100 - qVal;
      }

      if (r["불량"] && String(r["불량"]).trim() !== "") {
        defectCount += 1;
      }

      for (const { header, match } of SUMMARY_STEP_KEYS) {
        if (step === match) {
          stepCounts[header] = (stepCounts[header] ?? 0) + 1;
          break;
        }
      }
    }

    const finalQuality = Math.max(0, 100 - penalty);

    const firstStart = groupRows[0]["세팅시작일"];
    const firstEnd = groupRows[0]["세팅종료일"];
    const lead = diffDays(firstStart, firstEnd);

    // 출하요청일: 일단 세팅종료일 사용 (필요 시 나중에 컬럼 바꿔도 됨)
    const shipRequest = firstEnd ?? "";

    const summaryRow: Record<string, any> = {
      모델: base["모델"],
      차분: base["차분"],
      호기: base["호기"],
      "S/N": base["S/N"],
      "Chiller S/N": base["Chiller S/N"],
      출하요청일: shipRequest,
      "리드타임\n(사내 입고 - 출하, 단위 : 일)": lead,
      "세팅총소요시간(단위 : 시간)":
        totalHoursNoPack !== 0 ? totalHoursNoPack.toFixed(1) : "",
      "세팅총소요시간(단위 : 시간)\nPacking&Delivery 포함":
        totalHoursWithPack !== 0 ? totalHoursWithPack.toFixed(1) : "",
      "입고 품질 점수(단위 : 점)": finalQuality.toFixed(0),
      "불량 건수": defectCount,
      "T.S 소요 시간\n(단위 : 분)":
        totalTsMinutes !== 0 ? Math.round(totalTsMinutes).toString() : "",
      적용: base["적용"],
      비고: base["비고"],
      담당자: base["담당자"],
    };

    SUMMARY_STEP_KEYS.forEach(({ header }) => {
      summaryRow[header] = stepCounts[header] || 0;
    });

    // ── 리드타임 3개 채우기 ──
    const lt = leadTimeMap[machineNo];
    if (lt?.receipt_to_ship_days != null) {
      summaryRow[SUMMARY_LT_RECEIPT_SHIP] = String(lt.receipt_to_ship_days);
    }
    if (lt?.receipt_to_complete_days != null) {
      summaryRow[SUMMARY_LT_RECEIPT_COMPLETE] = String(
        lt.receipt_to_complete_days
      );
    }
    if (lt?.receipt_to_start_days != null) {
      summaryRow[SUMMARY_LT_RECEIPT_START] = String(lt.receipt_to_start_days);
    }

    result.push(summaryRow);
  });

  // 정렬(모델/차분/호기 기준)
  result.sort((a, b) => {
    const aKey = `${a["모델"] || ""}_${a["차분"] || ""}_${a["호기"] || ""}`;
    const bKey = `${b["모델"] || ""}_${b["차분"] || ""}_${b["호기"] || ""}`;
    return aKey.localeCompare(bKey);
  });

  return result;
};

const LogTableBrowser: React.FC = () => {
  const navigate = useNavigate();

  const [tables, setTables] = useState<TableMeta[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [page, setPage] = useState(1);

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // setup_sheet_all 관련 상태
  const isSetupSheetAll = selected === "setup_sheet_all";
  const [showRawModal, setShowRawModal] = useState(false);
  const [rawApply, setRawApply] = useState("");
  const [rawNote, setRawNote] = useState("");
  const [rawOwner, setRawOwner] = useState("");

  const selectedMeta = useMemo(
    () => tables.find((t) => t.name === selected),
    [tables, selected]
  );
  const hasDateFilter = (selectedMeta?.date_fields?.length ?? 0) > 0;
  const dateFieldHint = hasDateFilter ? selectedMeta!.date_fields[0] : null;

  // 테이블 목록 로딩
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingMeta(true);
        setError(null);
        const { data } = await axios.get<TableMeta[]>(`${API_BASE}/logs/tables`, {
          timeout: 10000,
        });
        if (!alive) return;
        setTables(data);
        const first = data[0]?.name ?? "";
        setSelected((prev) => prev || first);
        setColumns(data[0]?.columns ?? []);
      } catch (e: any) {
        if (!alive) return;
        console.error(e);
        setError("테이블 목록을 불러오지 못했습니다.");
      } finally {
        if (alive) setLoadingMeta(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 테이블 변경 시 컬럼/기간 초기화
  useEffect(() => {
    const meta = tables.find((t) => t.name === selected);
    setColumns(meta?.columns ?? []);
    setPage(1);
    if (!meta?.date_fields?.length) {
      setFrom("");
      setTo("");
    }
  }, [selected, tables]);

  const fetchRows = async () => {
    if (!selected) return;
    try {
      setLoadingRows(true);
      setError(null);

      const offset = (page - 1) * LIMIT;
      const params: any = { table: selected, limit: LIMIT, offset };
      if (search.trim()) params.q = search.trim();
      if (hasDateFilter) {
        if (from) params.date_from = from;
        if (to) params.date_to = to;
      }

      const { data } = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
        params,
        timeout: 15000,
      });
      setColumns(data.columns);
      setRows(data.rows);
      setTotal(data.total);
    } catch (e: any) {
      console.error(e);
      setError("데이터를 불러오지 못했습니다.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoadingRows(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (selected) fetchRows();
  }, [selected]); // 처음/테이블 변경 시

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // 일반 CSV (그냥 DB 데이터 그대로)
  const exportAllToCsv = async () => {
    if (!selected) return;
    try {
      setExporting(true);
      const base: any = { table: selected };
      if (search.trim()) base.q = search.trim();
      if (hasDateFilter) {
        if (from) base.date_from = from;
        if (to) base.date_to = to;   // ✅ 수정
      }

      const probe = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
        params: { ...base, limit: 1, offset: 0 },
        timeout: 30000,
      });
      const allColumns = probe.data.columns;
      const totalCount = probe.data.total;

      let chunk = EXPORT_CHUNK_DEFAULT;
      let fetched = 0;
      let allRows: Record<string, any>[] = [];

      while (fetched < totalCount) {
        try {
          const { data } = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
            params: { ...base, limit: chunk, offset: fetched },
            timeout: 30000,
          });
          allRows = allRows.concat(data.rows);
          fetched += data.rows.length;
          if (data.rows.length === 0) break;
        } catch (e: any) {
          if (e?.response?.status === 422 && chunk > 50) {
            chunk = Math.max(50, Math.floor(chunk / 2));
            continue;
          }
          throw e;
        }
      }

      const EOL = "\r\n";
      const header = allColumns.map(escapeCsv).join(",");
      const lines = allRows.map((r) =>
        allColumns.map((c) => escapeCsv(r[c])).join(",")
      );
      const csvBody = [header, ...lines].join(EOL);
      const BOM = "\uFEFF";
      const csv = BOM + csvBody;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const today = new Date();
      const fileName = `${selected}_${today.getFullYear()}${String(
        today.getMonth() + 1
      ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.csv`;
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("엑셀(CSV) 내보내기에 실패했습니다. (limit/인코딩 확인)");
    } finally {
      setExporting(false);
    }
  };

  // setup_sheet_all → Rawdata CSV + 차분보고서취합 CSV
  const exportSetupSheetRaw = async () => {
    if (!isSetupSheetAll) return;
    try {
      setExporting(true);

      const base: any = { table: selected };
      if (search.trim()) base.q = search.trim();
      if (hasDateFilter) {
        if (from) base.date_from = from;
        if (to) base.date_to = to;
      }

      // 전체 개수 먼저 확인
      const probe = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
        params: { ...base, limit: 1, offset: 0 },
        timeout: 30000,
      });
      const totalCount = probe.data.total;

      let chunk = EXPORT_CHUNK_DEFAULT;
      let fetched = 0;
      let allRows: Record<string, any>[] = [];

      while (fetched < totalCount) {
        try {
          const { data } = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
            params: { ...base, limit: chunk, offset: fetched },
            timeout: 30000,
          });
          allRows = allRows.concat(data.rows);
          fetched += data.rows.length;
          if (data.rows.length === 0) break;
        } catch (e: any) {
          if (e?.response?.status === 422 && chunk > 50) {
            chunk = Math.max(50, Math.floor(chunk / 2));
            continue;
          }
          throw e;
        }
      }

      // Rawdata 포맷으로 매핑
      const mapped = allRows.map((r) =>
        buildRawRow(r, rawApply, rawNote, rawOwner)
      );

      // 요약 시트에 필요한 호기 목록 → 리드타임 계산
      const machineNos = mapped
        .map((r) => String(r["호기"] ?? "").trim())
        .filter((v) => v.length > 0);
      const leadTimeMap = await fetchLeadTimesForMachines(machineNos);

      // 차분보고서취합 요약 만들기 (각 호기 1행, 리드타임 3개 포함)
      const summaryRows = buildSummaryRows(mapped, leadTimeMap);

      const EOL = "\r\n";

      // 1) Rawdata CSV
      const rawHeader = RAWDATA_HEADERS.map(escapeCsv).join(",");
      const rawLines = mapped.map((r) =>
        RAWDATA_HEADERS.map((h) => escapeCsv((r as any)[h])).join(",")
      );
      const rawCsvBody = [rawHeader, ...rawLines].join(EOL);
      const BOM = "\uFEFF";
      const rawCsv = BOM + rawCsvBody;

      const rawBlob = new Blob([rawCsv], {
        type: "text/csv;charset=utf-8;",
      });
      const today = new Date();
      const rawFileName = `setup_sheet_all_rowdata_${today
        .toISOString()
        .slice(0, 10)}.csv`;
      const rawUrl = URL.createObjectURL(rawBlob);
      const a1 = document.createElement("a");
      a1.href = rawUrl;
      a1.download = rawFileName;
      document.body.appendChild(a1);
      a1.click();
      document.body.removeChild(a1);
      URL.revokeObjectURL(rawUrl);

      // 2) 차분보고서취합 CSV
      const summaryHeader = SUMMARY_HEADERS.map(escapeCsv).join(",");
      const summaryLines = summaryRows.map((r) =>
        SUMMARY_HEADERS.map((h) => escapeCsv((r as any)[h])).join(",")
      );
      const summaryCsvBody = [summaryHeader, ...summaryLines].join(EOL);
      const summaryCsv = BOM + summaryCsvBody;

      const summaryBlob = new Blob([summaryCsv], {
        type: "text/csv;charset=utf-8;",
      });
      const summaryFileName = `setup_sheet_all_summary_${today
        .toISOString()
        .slice(0, 10)}.csv`;
      const summaryUrl = URL.createObjectURL(summaryBlob);
      const a2 = document.createElement("a");
      a2.href = summaryUrl;
      a2.download = summaryFileName;
      document.body.appendChild(a2);
      a2.click();
      document.body.removeChild(a2);
      URL.revokeObjectURL(summaryUrl);
    } catch (e) {
      console.error(e);
      alert("Rawdata / 차분보고서취합 CSV 내보내기에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setPage(1);
      void fetchRows();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50" onKeyDown={handleKeyDown}>
      {/* 상단 헤더 */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              className="shrink-0 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => navigate(-1)}
              disabled={loadingMeta || loadingRows}
            >
              ← 뒤로가기
            </button>
            <h1 className="text-lg font-semibold text-slate-900">
              Log Data Browser
            </h1>
          </div>
          {selected && (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">
              {TABLE_LABELS[selected] ?? selected}
            </span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* 툴바 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            {/* 테이블 선택 */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-600">테이블</label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="h-10 min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                disabled={loadingMeta}
              >
                {tables.map((t) => (
                  <option key={t.name} value={t.name}>
                    {TABLE_LABELS[t.name] ?? t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 검색 */}
            <div className="relative flex-1 min-w-[240px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="검색(머신ID, 담당자, 비고 등)…"
                className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 pl-9 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                disabled={loadingMeta}
              />
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
                />
              </svg>
            </div>

            {/* 기간 */}
            <div className="flex items-center gap-2">
              <label
                className={`text-sm ${
                  hasDateFilter ? "text-slate-600" : "text-slate-400"
                }`}
              >
                기간
                {dateFieldHint ? ` (${dateFieldHint})` : ""}
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                disabled={!hasDateFilter || loadingMeta}
              />
              <span className="text-slate-400">~</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                disabled={!hasDateFilter || loadingMeta}
              />
            </div>

            {/* 액션들 (우측 정렬) */}
            <div className="ml-auto flex items-center gap-2">
              {isSetupSheetAll && (
                <button
                  className="h-10 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
                  disabled={loadingMeta || loadingRows || exporting}
                  onClick={() => setShowRawModal(true)}
                >
                  Rawdata 출력
                </button>
              )}

              <button
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm hover:bg-slate-50 disabled:opacity-50"
                onClick={exportAllToCsv}
                disabled={loadingMeta || loadingRows || exporting || !selected}
                title="현재 선택/검색/기간 필터를 반영해 전체 데이터를 CSV로 저장합니다."
              >
                {exporting ? "내보내는 중…" : "CSV 다운로드"}
              </button>
              <button
                className="h-10 rounded-xl bg-slate-200 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-300 disabled:opacity-50"
                onClick={() => {
                  setSearch("");
                  setFrom("");
                  setTo("");
                  setPage(1);
                }}
                disabled={loadingMeta || loadingRows}
              >
                초기화
              </button>
              <button
                className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
                onClick={() => {
                  setPage(1);
                  fetchRows();
                }}
                disabled={loadingMeta || loadingRows}
              >
                조회
              </button>
            </div>
          </div>

          {/* 날짜 컬럼 힌트 */}
          <div className="mt-2 text-xs text-slate-400">
            {hasDateFilter
              ? `기준 컬럼: ${dateFieldHint}`
              : "이 테이블은 기간 필터가 없습니다."}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}

        {/* 표 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c}
                      className="border-b px-4 py-3 text-left font-semibold text-slate-700"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingMeta || loadingRows ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {columns.map((c) => (
                        <td key={c} className="px-4 py-3">
                          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-slate-400"
                      colSpan={columns.length || 1}
                    >
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      {columns.map((c) => (
                        <td key={c} className="px-4 py-3 text-slate-800">
                          {String(r[c] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">
              Rows {(page - 1) * LIMIT + (rows.length ? 1 : 0)}–
              {(page - 1) * LIMIT + rows.length} of {total}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded border bg-white px-2 py-1 text-sm text-slate-600 disabled:opacity-40"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                    fetchRows();
                  }
                }}
                disabled={page <= 1 || loadingMeta || loadingRows}
              >
                ‹
              </button>
              <span className="text-sm text-slate-700">
                {Math.min(page, Math.max(1, totalPages))} / {totalPages}
              </span>
              <button
                className="rounded border bg-white px-2 py-1 text-sm text-slate-600 disabled:opacity-40"
                onClick={() => {
                  const max = totalPages;
                  if (page < max) {
                    setPage(page + 1);
                    fetchRows();
                  }
                }}
                disabled={page >= totalPages || loadingMeta || loadingRows}
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rawdata 입력 모달 */}
      {showRawModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
            <h2 className="text-base font-semibold text-slate-900">
              Rawdata / 차분보고서취합 출력
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              setup_sheet_all 데이터 기준으로 Rowdata CSV와 차분보고서취합
              CSV 두 개를 생성합니다. 아래 내용은 모든 행에 동일하게 들어갑니다.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-700">
                  적용
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  value={rawApply}
                  onChange={(e) => setRawApply(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  비고
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  value={rawNote}
                  onChange={(e) => setRawNote(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700">
                  담당자
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-200"
                  value={rawOwner}
                  onChange={(e) => setRawOwner(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setShowRawModal(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                disabled={exporting}
                onClick={async () => {
                  await exportSetupSheetRaw();
                  setShowRawModal(false);
                }}
              >
                {exporting ? "내보내는 중…" : "CSV 두 개 다운로드"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LogTableBrowser;
