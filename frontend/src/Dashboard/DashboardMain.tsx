// src/Dashboard/DashboardMain.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ABuildingView from "./ABuildingView";
import IBuildingView from "./IBuildingView";
import BBuildingView from "./BBuildingView";
import { fetchSlots, type SlotRow } from "./DashboardHandler";

const LS_BUILDING = "dash_building";
const LS_SITE = "dash_site";
const AUTO_REFRESH_MS = 5 * 60 * 1000;

function useDebounced<T>(v: T, d = 200): T {
  const [x, setX] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => setX(v), d);
    return () => clearTimeout(id);
  }, [v, d]);
  return x;
}

export default function DashboardMain() {
  const navigate = useNavigate(); // ← 뒤로가기용

  const [site] = useState<string>(() => localStorage.getItem(LS_SITE) ?? "본사");
  const [building, setBuilding] = useState<"A" | "B" | "I">(
    () => (localStorage.getItem(LS_BUILDING) as any) ?? "A"
  );

  const [rows, setRows] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 200);
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(AUTO_REFRESH_MS);

  useEffect(() => {
    localStorage.setItem(LS_BUILDING, building);
  }, [building]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const list = await fetchSlots({ site, building });
      setRows(list);
      setLastSyncAt(new Date());
      setCountdown(AUTO_REFRESH_MS);
    } catch (e: any) {
      setError(e?.message ?? "목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [site, building]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((ms) => (ms > 1000 ? ms - 1000 : 0)), 1000);
    const auto = setInterval(() => void load(), AUTO_REFRESH_MS);
    return () => {
      clearInterval(tick);
      clearInterval(auto);
    };
  }, [load]);

  useEffect(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return setHighlightedSlot(null);
    const found = rows.filter((r) => (r.machine_id ?? "").toLowerCase().includes(q));
    setHighlightedSlot(found.length ? found[0].slot_code : null);
  }, [debouncedQuery, rows]);

  const onSearchClick = () => {
    const q = query.trim().toLowerCase();
    if (!q) return setHighlightedSlot(null);
    const found = rows.filter((r) => (r.machine_id ?? "").toLowerCase().includes(q));
    setHighlightedSlot(found.length ? found[0].slot_code : null);
  };

  const equipMap = useMemo(() => {
    const m = new Map<string, SlotRow>();
    rows.forEach((r) => m.set(r.slot_code.toUpperCase(), r));
    return m;
  }, [rows]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm">
        <div className="w-full max-w-none px-6 2xl:px-10 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)} // ← SEMICS 클릭 시 뒤로가기
            className="text-5xl font-extrabold tracking-tight text-orange-600 hover:opacity-80 focus:outline-none"
            title="이전 페이지로 이동"
          >
            SEMICS
          </button>

          {/* 검색 */}
          <div className="flex-1 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="호기(장비번호)로 검색…  예) j-01-10"
              className="w-full rounded-lg border px-4 py-2.5 text-sm focus:ring-4 focus:ring-indigo-200"
            />
            <button
              onClick={onSearchClick}
              className="rounded-lg bg-gray-200 px-10 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            >
              검색
            </button>
          </div>

          {/* 새로고침 + 동기화 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              className="rounded-lg bg-indigo-600 px-10 py-5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              새로고침
            </button>
            <div className="text-xs text-slate-600">
              마지막 동기화: {lastSyncAt ? lastSyncAt.toLocaleTimeString() : "-"} · 자동 새로고침까지{" "}
              {Math.ceil(countdown / 1000)}s
            </div>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="w-full max-w-none px-6 2xl:px-10 py-6 grid grid-cols-[320px_1fr] gap-8 2xl:gap-12">
        {/* 좌측 */}
        <aside className="rounded-xl bg-slate-900 p-3 text-slate-200">
          <div className="px-2 py-2 text-slate-300 text-sm">라인 선택</div>
          <div className="px-3 py-2 rounded-md bg-slate-800 text-slate-100">본사</div>
          <ul className="mt-1 ml-3 pl-2 border-l border-slate-700 space-y-1">
            {(["A", "B", "I"] as const).map((b) => (
              <li key={b}>
                <button
                  onClick={() => setBuilding(b)}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-slate-700/40 ${
                    building === b ? "bg-slate-700 text-white" : "text-slate-200"
                  }`}
                >
                  {b}동
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* 우측 */}
        <main>
          {error ? (
            <div className="rounded-md bg-red-50 px-4 py-3 text-red-600">{error}</div>
          ) : loading ? (
            <div className="grid grid-cols-2 gap-12">
              <section className="pr-10 border-r">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="mb-16">
                    <div className="h-7 w-28 rounded bg-gray-200 mb-5 animate-pulse" />
                    <div className="flex flex-wrap gap-7">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <div key={j} className="h-28 w-60 rounded-xl bg-gray-100 shadow-sm animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
              <section className="pl-10">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="mb-16">
                    <div className="h-7 w-28 rounded bg-gray-200 mb-5 animate-pulse" />
                    <div className="flex flex-wrap gap-7">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <div key={j} className="h-28 w-60 rounded-xl bg-gray-100 shadow-sm animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            </div>
          ) : building === "A" ? (
            <ABuildingView equipMap={equipMap} highlightedSlot={highlightedSlot} onShipped={() => void load()} />
          ) : building === "B" ? (
            <BBuildingView equipMap={equipMap} highlightedSlot={highlightedSlot} onShipped={() => void load()} />
          ) : building === "I" ? (
            <IBuildingView equipMap={equipMap} highlightedSlot={highlightedSlot} onShipped={() => void load()} />
          ) : (
            <div className="rounded-xl border bg-white p-10 text-center text-slate-600">
              <div className="text-xl font-semibold mb-2">{building}동</div>
              <div>이 레이아웃은 추후 A동과 동일한 방식으로 확장됩니다.</div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
