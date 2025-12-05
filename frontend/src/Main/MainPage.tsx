// src/Main/MainPage.tsx
// - 상단 3칸: 본사 A/B/I동 자리 현황
// - 가운데 2칸: 게시판 공지사항 / 변경점
// - 하단 3칸: 오늘 입고 / 오늘 출하 / 3일 이내 출하 (숫자 카드)
// - 그 아래 표 3개: 오늘 입고 목록 / 오늘 출하 목록 / 3일 이내 출하 목록
// - 디자인: 라이트 + 하늘색/청록 헤더, 오렌지 포인트, pill 버튼, 큰 라운드/소프트 섀도우
// - 레이아웃: max-w-6xl 폭 제한, 같은 줄 카드 높이 통일(auto-rows-fr), 표 내부 스크롤/헤더 고정
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// CRA/Vite 공용: 환경변수 → 없으면 '/api'
const API_BASE = "http://192.168.101.1:8000/api";

/* ---------- 타입 ---------- */
type Building = { used: number; capacity: number; remaining: number };
type CapacityRes = { A: Building; B: Building; I: Building };

type BriefPost = {
  no: number;
  title: string;
  author_name: string;
  created_at: string; // ISO
  category: string;
};
type SummaryRes = { notices: BriefPost[]; changes: BriefPost[] };

type ShipSummary = { today: number; within3: number };
type ReceiptSummary = { today: number };

/* 표(3개)에서 쓰는 간단 행 */
type RowBrief = {
  machine_id?: string | null;
  manager?: string | null;
  slot_code?: string | null;
};

const MainPage: React.FC<{ userName?: string }> = (/* { userName } */) => {
  const navigate = useNavigate();

  // 탭 라우팅
  const ROUTE_DASHBOARD = '/dashboard';
  const ROUTE_OPTIONS = '/options';
  const ROUTE_TROUBLESHOOT = '/troubleshoot';
  const ROUTE_ROW = '/SetupDefectEntryPage';
  const ROUTE_BOARD = '/board';
  const ROUTE_LOG_TABLE = '/logs/table';
  const ROUTE_LOG_CHART = '/log/charts';

  // ⛳ 로그아웃: 토큰 제거 → axios Authorization 제거 → "/"(로그인)으로 이동
  const handleLogout = () => {
    try {
      localStorage.removeItem('access_token');
      sessionStorage.removeItem('access_token');
    } catch {}
    try {
      delete axios.defaults.headers.common['Authorization'];
    } catch {}
    navigate('/', { replace: true });
  };

  // 상단 섹션/탭
  const [activeSection, setActiveSection] = useState<'시스템 생산실'>('시스템 생산실');
  const [showSubTabs, setShowSubTabs] = useState(true);

  /* ----- 상태: 자리 현황 ----- */
  const [cap, setCap] = useState<CapacityRes | null>(null);
  const [capLoading, setCapLoading] = useState(true);
  const [capErr, setCapErr] = useState<string | null>(null);

  /* ----- 상태: 게시판 요약 ----- */
  const [notices, setNotices] = useState<BriefPost[]>([]);
  const [changes, setChanges] = useState<BriefPost[]>([]);
  const [brdLoading, setBrdLoading] = useState(true);
  const [brdErr, setBrdErr] = useState<string | null>(null);

  /* ----- 상태: 출하/입고 요약 ----- */
  const [ship, setShip] = useState<ShipSummary | null>(null);
  const [shipLoading, setShipLoading] = useState(true);
  const [shipErr, setShipErr] = useState<string | null>(null);

  const [rcp, setRcp] = useState<ReceiptSummary | null>(null);
  const [rcpLoading, setRcpLoading] = useState(true);
  const [rcpErr, setRcpErr] = useState<string | null>(null);

  /* ----- 상태: 표 3개 ----- */
  const [recTodayRows, setRecTodayRows] = useState<RowBrief[]>([]);
  const [shipTodayRows, setShipTodayRows] = useState<RowBrief[]>([]);
  const [ship3Rows, setShip3Rows] = useState<RowBrief[]>([]);
  const [rowsLoading, setRowsLoading] = useState({ rec: true, ship: true, ship3: true });
  const [rowsErr, setRowsErr] = useState<{ rec: string | null; ship: string | null; ship3: string | null }>({
    rec: null,
    ship: null,
    ship3: null,
  });

  /* ----- 데이터 로딩: 자리 현황 ----- */
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setCapLoading(true);
        setCapErr(null);
        const { data } = await axios.get<CapacityRes>(`${API_BASE}/main/capacity`, {
          params: { site: '본사' },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setCap(data);
      } catch (e: any) {
        const canceled = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.message === 'canceled';
        if (!canceled) {
          console.error(e);
          if (alive) setCapErr('자리 현황을 불러오지 못했습니다.');
        }
      } finally {
        if (alive) setCapLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /* ----- 데이터 로딩: 게시판 요약 ----- */
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setBrdLoading(true);
        setBrdErr(null);
        const { data } = await axios.get<SummaryRes>(`${API_BASE}/board/summary`, {
          params: { limit: 6 },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setNotices(data.notices ?? []);
        setChanges(data.changes ?? []);
      } catch (e: any) {
        const canceled = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.message === 'canceled';
        if (!canceled) {
          console.error(e);
          if (alive) setBrdErr('게시판 요약을 불러오지 못했습니다.');
        }
      } finally {
        if (alive) setBrdLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /* ----- 데이터 로딩: 출하/입고 요약 ----- */
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setShipLoading(true);
        setShipErr(null);
        const { data } = await axios.get<ShipSummary>(`${API_BASE}/main/ship-summary`, {
          params: { site: '본사' },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setShip(data);
      } catch (e: any) {
        const canceled = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.message === 'canceled';
        if (!canceled) {
          console.error(e);
          if (alive) setShipErr('출하 요약을 불러오지 못했습니다.');
        }
      } finally {
        if (alive) setShipLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      try {
        setRcpLoading(true);
        setRcpErr(null);
        const { data } = await axios.get<ReceiptSummary>(`${API_BASE}/main/receipt-summary`, {
          params: { site: '본사' },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setRcp(data);
      } catch (e: any) {
        const canceled = e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError' || e?.message === 'canceled';
        if (!canceled) {
          console.error(e);
          if (alive) setRcpErr('입고 요약을 불러오지 못했습니다.');
        }
      } finally {
        if (alive) setRcpLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /* ----- 데이터 로딩: 표 3개 ----- */
  // 오늘 입고
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        setRowsLoading((s) => ({ ...s, rec: true }));
        setRowsErr((s) => ({ ...s, rec: null }));
        const { data } = await axios.get<RowBrief[]>(`${API_BASE}/main/receipt-today-rows`, {
          params: { site: '본사', limit: 10 },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setRecTodayRows(Array.isArray(data) ? data : []);
      } catch {
        setRowsErr((s) => ({ ...s, rec: '오늘 입고 목록을 불러오지 못했습니다.' }));
      } finally {
        if (alive) setRowsLoading((s) => ({ ...s, rec: false }));
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // 오늘 출하
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        setRowsLoading((s) => ({ ...s, ship: true }));
        setRowsErr((s) => ({ ...s, ship: null }));
        const { data } = await axios.get<RowBrief[]>(`${API_BASE}/main/ship-today-rows`, {
          params: { site: '본사', limit: 10 },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setShipTodayRows(Array.isArray(data) ? data : []);
      } catch {
        setRowsErr((s) => ({ ...s, ship: '오늘 출하 목록을 불러오지 못했습니다.' }));
      } finally {
        if (alive) setRowsLoading((s) => ({ ...s, ship: false }));
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  // 3일 이내 출하
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        setRowsLoading((s) => ({ ...s, ship3: true }));
        setRowsErr((s) => ({ ...s, ship3: null }));
        const { data } = await axios.get<RowBrief[]>(`${API_BASE}/main/ship-within3-rows`, {
          params: { site: '본사', limit: 10 },
          timeout: 8000,
          signal: controller.signal,
        });
        if (!alive) return;
        setShip3Rows(Array.isArray(data) ? data : []);
      } catch {
        setRowsErr((s) => ({ ...s, ship3: '3일 이내 출하 목록을 불러오지 못했습니다.' }));
      } finally {
        if (alive) setRowsLoading((s) => ({ ...s, ship3: false }));
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  /* ----- 소 UI: 카드 컴포넌트 ----- */

  // 공통 카드(상단 얇은 그라데이션 바 + 라운드 + 소프트 섀도우)
  const Shell: React.FC<{ children: React.ReactNode; className?: string; header?: string }> = ({
    children,
    className,
    header,
  }) => (
    <section className={`h-full rounded-2xl bg-white shadow-md ring-1 ring-gray-100 ${className ?? ''}`}>
      {/* 얇은 헤더 바: 하늘색~청록 */}
      <div className="h-2 rounded-t-2xl bg-gradient-to-r from-sky-200 via-cyan-200 to-sky-200" />
      {header && (
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-800">{header}</h3>
        </div>
      )}
      {children}
    </section>
  );

  const CapacityCard: React.FC<{ title: string; data?: Building; loading?: boolean }> = ({
    title,
    data,
    loading,
  }) => (
    <Shell>
      <div className="min-h-[180px] px-6 pb-6 pt-4 text-center">
        <div className="mb-2 text-lg font-semibold text-gray-800">{title}</div>
        {loading ? (
          <div className="py-10 text-sm text-gray-500">불러오는 중…</div>
        ) : data ? (
          <div className="space-y-2">
            <div className="text-3xl font-extrabold text-gray-900">
              {data.used} <span className="text-base font-medium text-gray-500">/ {data.capacity}</span>
            </div>
            <div className="text-sm text-gray-600">남은자리 : {data.remaining}</div>
          </div>
        ) : (
          <div className="py-10 text-sm text-gray-400">데이터 없음</div>
        )}
      </div>
    </Shell>
  );

  const BoardCard: React.FC<{ title: string; items: BriefPost[]; loading?: boolean }> = ({
    title,
    items,
    loading,
  }) => (
    <Shell>
      {/* 헤더 톤 강화: 하늘색→청록 그라데이션 */}
      <div className="flex items-center justify-between border-b border-sky-100 px-5 py-3 bg-gradient-to-r from-sky-50 to-cyan-50">
        <h3 className="text-base font-semibold text-gray-800">{title}</h3>
        <button
          onClick={() => navigate(ROUTE_BOARD)}
          className="rounded-full bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
          title="게시판으로 이동"
        >
          더보기
        </button>
      </div>
      <ul className="max-h-56 divide-y divide-gray-100 overflow-y-auto">
        {loading && <li className="px-5 py-4 text-sm text-gray-500">불러오는 중…</li>}
        {!loading && items.length === 0 && (
          <li className="px-5 py-10 text-center text-sm text-gray-400">게시글이 없습니다.</li>
        )}
        {!loading &&
          items.map((p) => (
            <li key={p.no}>
              <button
                onClick={() => navigate(`/board/${p.no}`)}
                className="block w-full px-5 py-3 text-left hover:bg-gray-50"
                title={p.title}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-gray-900">{p.title}</div>
                    <div className="mt-0.5 text-xs text-gray-500">
                      작성자 {p.author_name} · {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-[10px] text-sky-700 ring-1 ring-sky-200">
                    {p.category}
                  </span>
                </div>
              </button>
            </li>
          ))}
      </ul>
    </Shell>
  );

  const StatCard: React.FC<{ label: string; value?: number; loading?: boolean }> = ({
    label,
    value,
    loading,
  }) => (
    <Shell>
      <div className="min-h-[140px] px-6 pb-6 pt-4 text-center">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        {loading ? (
          <div className="py-6 text-sm text-gray-500">불러오는 중…</div>
        ) : (
          <div className="py-2 text-3xl font-extrabold text-gray-900">{value ?? 0}</div>
        )}
      </div>
    </Shell>
  );

  const SimpleRowsTable: React.FC<{
    title: string;
    rows: RowBrief[];
    loading?: boolean;
    error?: string | null;
  }> = ({ title, rows, loading, error }) => (
    <Shell>
      <div className="border-b border-gray-100 bg-gradient-to-r from-sky-50 to-cyan-50 px-5 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">{title}</h3>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] text-gray-600 ring-1 ring-gray-200">
            {rows.length}건
          </span>
        </div>
      </div>
      {error && <div className="px-5 py-2 text-sm text-red-600">{error}</div>}
      <div className="max-h-72 overflow-y-auto overflow-x-auto">
        <table className="min-w-full table-fixed">
          <thead className="sticky top-0 z-10 bg-sky-50 text-sm text-sky-900">
            <tr className="border-b border-sky-100">
              <th className="w-48 px-4 py-3 text-left">장비 호기</th>
              <th className="w-40 px-4 py-3 text-left">담당자</th>
              <th className="w-32 px-4 py-3 text-left">Slot</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-t">
                  {Array.from({ length: 3 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 w-24 animate-pulse rounded bg-gray-100" />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-500">
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{r.machine_id ?? ''}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{r.manager ?? ''}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{(r.slot_code ?? '').toUpperCase()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        {/* 상단 바 */}
        <div className="mb-5 flex items-center justify-between">
          {/* 왼쪽: 상단 탭 */}
          <div className="flex flex-wrap gap-2">
            {(['시스템 생산실'] as const).map((label) => (
              <button
                key={label}
                onClick={() => {
                  setActiveSection(label);
                  setShowSubTabs(label === '시스템 생산실');
                }}
                className={`rounded-full px-4 py-2 text-base font-medium transition ${
                  activeSection === label
                    ? 'bg-orange-100 text-orange-700 ring-1 ring-orange-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-white hover:shadow'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 오른쪽: 로그아웃 버튼 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-orange-600"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* 하위 탭: '시스템 생산실'에서만 노출 */}
        {showSubTabs && (
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 p-1.5">
              {['Dashboard', 'Option Configuration', 'Log Charts', 'Trouble Shoot', 'Row data', 'Board', 'Log Table'].map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      if (tab === 'Dashboard') navigate(ROUTE_DASHBOARD);
                      else if (tab === 'Option Configuration') navigate(ROUTE_OPTIONS);
                      else if (tab === 'Log Charts') navigate(ROUTE_LOG_CHART);
                      else if (tab === 'Trouble Shoot') navigate(ROUTE_TROUBLESHOOT);
                      else if (tab === 'Row data') navigate(ROUTE_ROW);
                      else if (tab === 'Board') navigate(ROUTE_BOARD);
                      else if (tab === 'Log Table') navigate(ROUTE_LOG_TABLE);
                    }}
                    className={`rounded-full px-4 py-2 text-base transition ${
                      tab === 'Dashboard'
                        ? 'bg-white text-orange-600 shadow ring-1 ring-orange-200'
                        : 'text-gray-700 hover:bg-white hover:shadow'
                    }`}
                  >
                    {tab}
                  </button>
                )
              )}
            </div>
          </div>
        )}

        {/* 본문: 공지/변경점 → 자리 현황 → 숫자 카드 → 표 3개 */}
        <div className="w-full space-y-6">
          {/* 공지/변경점 (맨 위로 이동) */}
          <div className="grid auto-rows-fr grid-cols-1 gap-6 xl:grid-cols-2">
            <BoardCard title="공지사항" items={notices} loading={brdLoading} />
            <BoardCard title="변경점" items={changes} loading={brdLoading} />
          </div>
          {brdErr && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{brdErr}</div>}

          {/* 자리 현황 */}
          <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <CapacityCard title="본사 A동" data={cap?.A} loading={capLoading} />
            <CapacityCard title="본사 B동" data={cap?.B} loading={capLoading} />
            <CapacityCard title="본사 I동" data={cap?.I} loading={capLoading} />
          </div>
          {capErr && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{capErr}</div>}

          {/* 입/출하 요약 숫자 카드 */}
          <div className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard label="오늘 입고" value={rcp?.today} loading={rcpLoading} />
            <StatCard label="오늘 출하" value={ship?.today} loading={shipLoading} />
            <StatCard label="3일 이내 출하(오늘 포함)" value={ship?.within3} loading={shipLoading} />
          </div>
          {rcpErr && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{rcpErr}</div>}
          {shipErr && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{shipErr}</div>}

          {/* 표 3개 */}
          <div className="grid auto-rows-fr grid-cols-1 gap-6 xl:grid-cols-3">
            <SimpleRowsTable
              title="오늘 입고 목록"
              rows={recTodayRows}
              loading={rowsLoading.rec}
              error={rowsErr.rec}
            />
            <SimpleRowsTable
              title="오늘 출하 목록"
              rows={shipTodayRows}
              loading={rowsLoading.ship}
              error={rowsErr.ship}
            />
            <SimpleRowsTable
              title="3일 이내 출하 목록"
              rows={ship3Rows}
              loading={rowsLoading.ship3}
              error={rowsErr.ship3}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainPage;
