// src/pages/LogTableBrowser.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

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

const LogTableBrowser: React.FC = () => {
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
    // 날짜 필터가 없는 테이블이면 기간 입력 초기화
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

  // 최초 1회 자동 조회
  useEffect(() => {
    if (selected) fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Log Data Browser</h1>
        <span className="text-sm text-gray-500">public 스키마 전체 테이블</span>
      </div>

      {/* 툴바 */}
      <div className="bg-white border rounded-2xl shadow-sm p-4 flex flex-wrap items-center gap-3">
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
            <span className="text-sm text-gray-700">{Math.min(page, Math.max(1, Math.ceil(total / LIMIT)))} / {Math.max(1, Math.ceil(total / LIMIT))}</span>
            <button
              className="px-2 py-1 text-sm rounded border bg-white text-gray-600 disabled:opacity-40"
              onClick={() => {
                const max = Math.max(1, Math.ceil(total / LIMIT));
                if (page < max) {
                  setPage(page + 1);
                  fetchRows();
                }
              }}
              disabled={page >= Math.max(1, Math.ceil(total / LIMIT)) || loadingMeta || loadingRows}
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
