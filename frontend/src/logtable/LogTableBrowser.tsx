// src/pages/LogTableBrowser.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/** CRA/Vite 공용: 환경변수 → 없으면 '/api' */
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, "") ||
  (typeof process !== "undefined" && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, "")) ||
  "/api";

type TableMeta = {
  name: string;
  columns: string[];
  date_fields: string[]; // 백엔드가 후보 날짜 컬럼을 알려줌
};
type RowsRes = { columns: string[]; rows: Record<string, any>[]; total: number };

const LIMIT = 20;
const EXPORT_CHUNK_DEFAULT = 200; // 백엔드 limit 제약 대응용

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

  // 선택된 테이블 메타
  const selectedMeta = useMemo(
    () => tables.find((t) => t.name === selected),
    [tables, selected]
  );
  const hasDateFilter = (selectedMeta?.date_fields?.length ?? 0) > 0;
  const dateFieldHint = hasDateFilter ? selectedMeta!.date_fields[0] : null;

  // 1) public 스키마 전체 테이블 메타 로드
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingMeta(true);
        setError(null);
        const { data } = await axios.get<TableMeta[]>(`${API_BASE}/logs/tables`, { timeout: 10000 });
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

  // 테이블 변경 시 컬럼/페이지 초기화
  useEffect(() => {
    const meta = tables.find((t) => t.name === selected);
    setColumns(meta?.columns ?? []);
    setPage(1);
    if (!meta?.date_fields?.length) {
      setFrom("");
      setTo("");
    }
  }, [selected, tables]);

  // 2) 행 조회
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

  // 최초 1회 자동 조회 + 테이블 변경 시
  useEffect(() => {
    if (selected) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // CSV 셀 이스케이프
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  // 전체 데이터(필터 반영) CSV로 내보내기 (UTF-8 BOM + CRLF, limit 청크)
  const exportAllToCsv = async () => {
    if (!selected) return;
    try {
      setExporting(true);

      // 공통 파라미터(필터 반영)
      const base: any = { table: selected };
      if (search.trim()) base.q = search.trim();
      if (hasDateFilter) {
        if (from) base.date_from = from;
        if (to) base.date_to = to;
      }

      // 1) 프로브: total/columns 파악 (limit=1)
      const probe = await axios.get<RowsRes>(`${API_BASE}/logs/rows`, {
        params: { ...base, limit: 1, offset: 0 },
        timeout: 30000,
      });
      const allColumns = probe.data.columns;
      const totalCount = probe.data.total;

      // 2) 청크 반복 수집
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

          if (data.rows.length === 0) break; // 안전장치
        } catch (e: any) {
          // limit 초과 등으로 422 나오면 chunk를 줄여 재시도
          if (e?.response?.status === 422 && chunk > 50) {
            chunk = Math.max(50, Math.floor(chunk / 2));
            continue; // 같은 offset으로 재시도
          }
          throw e; // 다른 오류는 상위로
        }
      }

      // 3) CSV 생성 (UTF-8 BOM + CRLF)
      const EOL = "\r\n";
      const header = allColumns.map(escapeCsv).join(",");
      const lines = allRows.map((r) => allColumns.map((c) => escapeCsv(r[c])).join(","));
      const csvBody = [header, ...lines].join(EOL);
      const BOM = "\uFEFF";
      const csv = BOM + csvBody;

      // 4) 다운로드
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const fileName = `${selected}_${y}${m}${d}.csv`;

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

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Log Data Browser</h1>
        <span className="text-sm text-gray-500">public 스키마 전체 테이블</span>
      </div>

      {/* 툴바 */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
        {/* 뒤로가기 */}
        <button
          className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
          onClick={() => navigate(-1)}
          disabled={loadingMeta || loadingRows}
        >
          ← 뒤로가기
        </button>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">테이블</label>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="rounded-xl border-gray-300 text-sm px-3 py-2 bg-white min-w-[240px]"
            disabled={loadingMeta}
          >
            {tables.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="검색(머신ID, 담당자, 비고 등)…"
              className="w-full rounded-xl border-gray-300 text-sm px-3 py-2 pl-9"
              disabled={loadingMeta}
            />
            <svg
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
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
        </div>

        <div className="flex items-center gap-2">
          <label className={`text-sm ${hasDateFilter ? "text-gray-600" : "text-gray-400"}`}>
            기간
          </label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-xl border-gray-300 text-sm px-3 py-2"
            disabled={!hasDateFilter || loadingMeta}
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-xl border-gray-300 text-sm px-3 py-2"
            disabled={!hasDateFilter || loadingMeta}
          />
          {hasDateFilter && (
            <span className="text-xs text-gray-400">
              기준 컬럼: {dateFieldHint}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* CSV 다운로드 */}
          <button
            className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50 disabled:opacity-50"
            onClick={exportAllToCsv}
            disabled={loadingMeta || loadingRows || exporting || !selected}
            title="현재 선택/검색/기간 필터를 반영해 전체 데이터를 CSV로 저장합니다."
          >
            {exporting ? "내보내는 중..." : "엑셀(CSV) 다운로드"}
          </button>

          <button
            className="px-3 py-2 text-sm rounded-xl border bg-white hover:bg-gray-50"
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
            className="px-4 py-2 text-sm rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
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

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 표 */}
      <div className="mt-4 bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="text-left font-medium text-gray-600 px-4 py-3 border-b">
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
                        <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-400" colSpan={columns.length}>
                    데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={i} className="border-b hover:bg-gray-50">
                    {columns.map((c) => (
                      <td key={c} className="px-4 py-3 text-gray-800">
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
        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-xs text-gray-500">
            Rows {(page - 1) * LIMIT + (rows.length ? 1 : 0)}–{(page - 1) * LIMIT + rows.length} of{" "}
            {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-2 py-1 text-sm rounded border bg-white text-gray-600 disabled:opacity-40"
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
            <span className="text-sm text-gray-700">
              {Math.min(page, Math.max(1, totalPages))} / {totalPages}
            </span>
            <button
              className="px-2 py-1 text-sm rounded border bg-white text-gray-600 disabled:opacity-40"
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
  );
};

export default LogTableBrowser;
