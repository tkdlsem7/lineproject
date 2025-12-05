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

  const selectedMeta = useMemo(() => tables.find((t) => t.name === selected), [tables, selected]);
  const hasDateFilter = (selectedMeta?.date_fields?.length ?? 0) > 0;
  const dateFieldHint = hasDateFilter ? selectedMeta!.date_fields[0] : null;

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

  useEffect(() => { if (selected) fetchRows(); }, [selected]); // 처음/테이블 변경 시

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return "";
    const s = String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportAllToCsv = async () => {
    if (!selected) return;
    try {
      setExporting(true);
      const base: any = { table: selected };
      if (search.trim()) base.q = search.trim();
      if (hasDateFilter) {
        if (from) base.date_from = from;
        if (to) base.date_to = to;
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
      const lines = allRows.map((r) => allColumns.map((c) => escapeCsv(r[c])).join(","));
      const csvBody = [header, ...lines].join(EOL);
      const BOM = "\uFEFF";
      const csv = BOM + csvBody;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const today = new Date();
      const fileName = `${selected}_${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}.csv`;
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
            <h1 className="text-lg font-semibold text-slate-900">Log Data Browser</h1>
          </div>
          {selected && (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-700">{selected}</span>
          )}
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* 툴바: 한 줄 플렉스(필요시 wrap) */}
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
                    {t.name}
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
            </div>

            {/* 기간 */}
            <div className="flex items-center gap-2">
              <label className={`text-sm ${hasDateFilter ? "text-slate-600" : "text-slate-400"}`}>기간</label>
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
            {hasDateFilter ? `기준 컬럼: ${dateFieldHint}` : "이 테이블은 기간 필터가 없습니다."}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mt-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
        )}

        {/* 표 */}
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-100">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="border-b px-4 py-3 text-left font-semibold text-slate-700">
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
                    <td className="px-4 py-6 text-center text-slate-400" colSpan={columns.length}>
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
              Rows {(page - 1) * LIMIT + (rows.length ? 1 : 0)}–{(page - 1) * LIMIT + rows.length} of {total}
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
                className="rounded border bg:white px-2 py-1 text-sm text-slate-600 disabled:opacity-40"
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
    </div>
  );
};

export default LogTableBrowser;
