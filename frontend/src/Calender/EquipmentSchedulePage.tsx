import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchEquipmentList,
  type EquipmentListItem,
} from "../lib/scheduleHubApi";

type TabType = "pending" | "shipped" | "all";

const sidebarItemBase =
  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition";
const sidebarItemActive =
  "bg-sky-600/20 text-white ring-1 ring-sky-400/30";
const sidebarItemInactive =
  "text-slate-300 hover:bg-white/5 hover:text-white";

const topTabClass = (active: boolean) =>
  `border-b-2 px-4 py-3 text-sm font-semibold transition ${
    active
      ? "border-sky-500 text-sky-600"
      : "border-transparent text-slate-500 hover:text-slate-700"
  }`;

const statusBadgeClass = (row: EquipmentListItem) => {
  const status = (row.current_status || "").toLowerCase();

  if (row.is_shipped || status.includes("출하") || status.includes("완료")) {
    return "bg-violet-100 text-violet-700";
  }
  if (status.includes("진행") || status.includes("setting") || status.includes("qc")) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-slate-100 text-slate-700";
};

const statusLabel = (row: EquipmentListItem) => {
  if (row.current_status && row.current_status.trim()) return row.current_status;
  return row.is_shipped ? "출하완료" : "진행중";
};

const EquipmentSchedulePage: React.FC = () => {
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabType>("pending");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<EquipmentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadList = async (nextTab: TabType = tab, nextSearch: string = search) => {
    try {
      setLoading(true);
      setError("");

      const res = await fetchEquipmentList({
        tab: nextTab,
        search: nextSearch,
        page: 1,
        page_size: 300,
      });

      setRows(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (e: any) {
      setError(e?.message ?? "장비 목록 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, [tab, search]);

  const visibleCountText = useMemo(() => `${total}개 장비`, [total]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
  };

  const handleRowClick = (row: EquipmentListItem) => {
    navigate(`/equipment-schedule/${row.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
        {/* 좌측 사이드바 */}
        <aside className="hidden w-64 shrink-0 flex-col bg-slate-950 text-white md:flex">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="text-2xl font-extrabold tracking-tight">
              SEMICS Production Hub
            </div>
          </div>

          <div className="px-4 py-6">
            <div className="mb-4 px-2 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              주요
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className={`${sidebarItemBase} ${sidebarItemInactive}`}
              >
                <span>📊</span>
                <span>대시보드</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/equipment-schedule")}
                className={`${sidebarItemBase} ${sidebarItemActive}`}
              >
                <span>📦</span>
                <span>장비 목록</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/schedule-batch-history")}
                className={`${sidebarItemBase} ${sidebarItemInactive}`}
              >
                <span>🕘</span>
                <span>차분 이력 보기</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/calendar/upload")}
                className={`${sidebarItemBase} ${sidebarItemInactive}`}
              >
                <span>🔄</span>
                <span>데이터 동기화</span>
              </button>
            </div>
          </div>
        </aside>

        {/* 메인 */}
        <main className="flex-1">
          <div className="border-b border-slate-200 bg-white px-8 py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                  장비 목록
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  장비별 일정 현황과 상세 일정을 확인할 수 있습니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/main")}
                  className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                >
                  🏠 메인으로
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/schedule-batch-history")}
                  className="rounded-full bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-600"
                >
                  차분 이력 보기
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/calendar/upload")}
                  className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-600"
                >
                  데이터 동기화
                </button>
              </div>
            </div>
          </div>

          <div className="px-8 py-8">
            <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-8 py-8">
                <div className="max-w-3xl">
                  <input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="호기, 모델, 고객사로 검색..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                </div>

                <div className="mt-4 text-sm font-medium text-slate-500">
                  {visibleCountText}
                </div>

                <div className="mt-8 flex items-center gap-4 border-b border-slate-200">
                  <button
                    type="button"
                    onClick={() => setTab("pending")}
                    className={topTabClass(tab === "pending")}
                  >
                    미출하 장비
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("shipped")}
                    className={topTabClass(tab === "shipped")}
                  >
                    출하 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("all")}
                    className={topTabClass(tab === "all")}
                  >
                    전체
                  </button>
                </div>
              </div>

              <div className="px-8 py-7">
                {loading ? (
                  <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center text-slate-500">
                    장비 목록을 불러오는 중...
                  </div>
                ) : error ? (
                  <div className="rounded-2xl bg-red-50 px-6 py-12 text-center text-red-600">
                    {error}
                  </div>
                ) : rows.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center text-slate-500">
                    조회된 장비가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500">
                          <tr>
                            <th className="px-4 py-4 text-left font-semibold">호기</th>
                            <th className="px-4 py-4 text-left font-semibold">모델</th>
                            <th className="px-4 py-4 text-left font-semibold">상태</th>
                            <th className="px-4 py-4 text-left font-semibold">고객사</th>
                            <th className="px-4 py-4 text-left font-semibold">냉각타입</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-100">
                          {rows.map((row) => (
                            <tr
                              key={row.id}
                              onClick={() => handleRowClick(row)}
                              className="cursor-pointer transition hover:bg-sky-50/60"
                            >
                              <td className="px-4 py-5 text-base font-extrabold text-slate-900">
                                {row.machine_no}
                              </td>

                              <td className="px-4 py-5 text-slate-700">
                                {row.model || "-"}
                              </td>

                              <td className="px-4 py-5">
                                <span
                                  className={`inline-flex rounded-lg px-3 py-1 text-xs font-bold ${statusBadgeClass(
                                    row
                                  )}`}
                                >
                                  {statusLabel(row)}
                                </span>
                              </td>

                              <td className="px-4 py-5 text-slate-700">
                                {row.customer_name || "-"}
                              </td>

                              <td className="px-4 py-5 text-slate-700">
                                {row.cold_type || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
                      행을 클릭하면 장비 상세 일정 페이지로 이동합니다.
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EquipmentSchedulePage;