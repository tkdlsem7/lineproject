import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type BatchCurrentSummaryItem = {
  source_type: string;
  event_type: string;
  event_name: string;
  machine_count: number;
  min_event_date?: string | null;
  max_event_date?: string | null;
};

type BatchHistoryEventSummaryItem = {
  event_name: string;
  change_count: number;
};

type BatchCurrentEventItem = {
  id: number;
  equipment_id: number;
  machine_no?: string | null;
  source_type: string;
  event_type: string;
  event_name: string;
  event_date: string;
  status?: string | null;
  team_name?: string | null;
  mo_no?: string | null;
  extra_data?: Record<string, any>;
};

type BatchHistoryEventItem = {
  id: number;
  equipment_id: number;
  machine_no?: string | null;
  source_type: string;
  event_type: string;
  event_name: string;
  team_name?: string | null;
  mo_no?: string | null;
  change_type: string;
  before_event_date?: string | null;
  before_status?: string | null;
  before_extra_data?: Record<string, any>;
  after_event_date?: string | null;
  after_status?: string | null;
  after_extra_data?: Record<string, any>;
  changed_by?: string | null;
  change_reason?: string | null;
  created_at?: string | null;
};

type BatchHistoryResponse = {
  query: string;
  model: string;
  batch: string;
  machine_count: number;
  machines: string[];
  history_summary: {
    total_changes: number;
    inserted_count: number;
    updated_count: number;
    deleted_count: number;
    latest_changed_at?: string | null;
  };
  current_summary: BatchCurrentSummaryItem[];
  history_event_summary: BatchHistoryEventSummaryItem[];
  current_events: BatchCurrentEventItem[];
  history_events: BatchHistoryEventItem[];
};

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchBatchHistory(query: string): Promise<BatchHistoryResponse> {
  const q = (query || "").trim();

  if (!q) {
    throw new Error("검색어를 입력해주세요. 예: D(e)-12");
  }

  const res = await fetch(
    `/api/schedule-hub/batch-history?query=${encodeURIComponent(q)}`,
    {
      method: "GET",
      credentials: "include",
    }
  );

  const data = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(data?.detail ?? "차분 이력 조회 중 오류가 발생했습니다.");
  }

  return data as BatchHistoryResponse;
}

const changeTypeClass = (value?: string) => {
  switch ((value || "").toLowerCase()) {
    case "inserted":
      return "bg-emerald-100 text-emerald-700";
    case "deleted":
      return "bg-red-100 text-red-700";
    default:
      return "bg-amber-100 text-amber-700";
  }
};

const sourceTypeLabel = (value?: string) => {
  const map: Record<string, string> = {
    production: "생산일정",
    shipment: "출하일정",
    remodel: "개조",
    interface: "인터페이스",
    mani: "MANI",
    opus: "OPUS",
    chiller: "칠러",
    manufacturing: "제조일정",
  };
  return map[value || ""] || value || "-";
};

const fmtDate = (value?: string | null) => {
  if (!value) return "-";
  return value.slice(0, 10);
};

const fmtDateTime = (value?: string | null) => {
  if (!value) return "-";
  return value.slice(0, 19).replace("T", " ");
};

const arrowDateText = (before?: string | null, after?: string | null) => {
  const b = fmtDate(before);
  const a = fmtDate(after);

  if (b === "-" && a === "-") return "-";
  return `${b} → ${a}`;
};

const eventRangeText = (row: BatchCurrentSummaryItem) => {
  const min = fmtDate(row.min_event_date);
  const max = fmtDate(row.max_event_date);

  if (min === "-" && max === "-") return "-";
  if (min === max) return min;
  return `${min} ~ ${max}`;
};

const groupCurrentEvents = (rows: BatchCurrentEventItem[]) => {
  const grouped: Record<string, BatchCurrentEventItem[]> = {};

  rows.forEach((row) => {
    const key = row.machine_no || "미지정";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(row);
  });

  return Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0], "ko"))
    .map(([machineNo, events]) => ({
      machineNo,
      events: [...events].sort((a, b) => {
        if (a.event_date === b.event_date) {
          return a.event_name.localeCompare(b.event_name, "ko");
        }
        return a.event_date.localeCompare(b.event_date);
      }),
    }));
};

const ScheduleBatchHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<BatchHistoryResponse | null>(null);

  const handleSearch = async (target?: string) => {
    const q = (target ?? query).trim();

    if (!q) {
      setError("검색어를 입력해주세요. 예: D(e)-12");
      setData(null);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const res = await fetchBatchHistory(q);
      setData(res);
      setSearchParams({ q });
    } catch (e: any) {
      setError(e?.message ?? "차분 이력 조회 중 오류가 발생했습니다.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      handleSearch(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupedCurrent = useMemo(() => {
    return groupCurrentEvents(data?.current_events ?? []);
  }, [data]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="h-1.5 rounded-t-3xl bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300" />

          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">
                  차분 일정 변경 이력
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  모델+차분으로 검색해서 해당 차분의 현재 일정과 변경 이력을 함께 확인합니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate("/main")}
                  className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  🏠 메인으로
                </button>
                <button
                  onClick={() => navigate("/equipment-schedule")}
                  className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  일정 확인 페이지로
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  모델 + 차분 검색
                </label>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSearch();
                    }}
                    placeholder="예: D(e)-12, T(e)-16"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                  />
                  <button
                    onClick={() => handleSearch()}
                    disabled={loading}
                    className={`rounded-full px-5 py-3 text-sm font-semibold text-white ${
                      loading ? "bg-slate-400" : "bg-orange-500 hover:bg-orange-600"
                    }`}
                  >
                    {loading ? "조회 중..." : "이력 조회"}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    검색 예시
                  </div>
                  <div className="mt-2 text-base font-bold text-slate-800">
                    D(e)-12
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    장비군 + 차분 형식
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    현재 구조
                  </div>
                  <div className="mt-2 text-base font-bold text-slate-800">
                    현재 일정 + 변경 이력
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    최신값과 히스토리를 같이 표시
                  </div>
                </div>

                <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    표시 기준
                  </div>
                  <div className="mt-2 text-base font-bold text-slate-800">
                    호기별 세부 일정
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    같은 차분 내 각 호기 일정 차이 확인
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">안내</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• 검색 형식은 “모델-차분” 입니다. 예: D(e)-12</li>
                <li>• 상단 요약에서 해당 차분의 변경 건수를 바로 볼 수 있습니다.</li>
                <li>• 현재 일정 범위 표에서 이벤트별 최소일~최대일을 확인할 수 있습니다.</li>
                <li>• 하단 변경 이력 표에서는 어떤 호기의 일정이 어떻게 바뀌었는지 봅니다.</li>
              </ul>
            </div>
          </div>
        </section>

        {error && (
          <section className="rounded-3xl bg-red-50 px-8 py-6 text-red-700 ring-1 ring-red-200">
            {error}
          </section>
        )}

        {data && (
          <>
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-500">검색 차분</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {data.model}-{data.batch}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-500">호기 수</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {data.machine_count}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-500">총 변경 건수</div>
                <div className="mt-2 text-2xl font-extrabold text-slate-900">
                  {data.history_summary.total_changes}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-500">
                  변경 / 신규 / 삭제
                </div>
                <div className="mt-2 text-lg font-bold text-slate-900">
                  {data.history_summary.updated_count} /{" "}
                  {data.history_summary.inserted_count} /{" "}
                  {data.history_summary.deleted_count}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-500">
                  마지막 변경 시각
                </div>
                <div className="mt-2 text-sm font-bold text-slate-900">
                  {fmtDateTime(data.history_summary.latest_changed_at)}
                </div>
              </div>
            </section>

            <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
              <div className="border-b border-slate-200 px-8 py-5">
                <h2 className="text-xl font-bold text-slate-900">현재 일정 범위</h2>
              </div>

              <div className="p-8">
                {data.current_summary.length === 0 ? (
                  <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                    현재 일정 데이터가 없습니다.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-4 py-4 text-left font-semibold">구분</th>
                            <th className="px-4 py-4 text-left font-semibold">이벤트명</th>
                            <th className="px-4 py-4 text-left font-semibold">적용 호기 수</th>
                            <th className="px-4 py-4 text-left font-semibold">일정 범위</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.current_summary.map((row) => (
                            <tr
                              key={`${row.source_type}-${row.event_type}`}
                              className="hover:bg-sky-50/60"
                            >
                              <td className="px-4 py-4 text-slate-700">
                                {sourceTypeLabel(row.source_type)}
                              </td>
                              <td className="px-4 py-4 font-medium text-slate-900">
                                {row.event_name}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {row.machine_count}
                              </td>
                              <td className="px-4 py-4 text-slate-700">
                                {eventRangeText(row)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <div className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                <div className="border-b border-slate-200 px-8 py-5">
                  <h2 className="text-xl font-bold text-slate-900">변경 이력</h2>
                </div>

                <div className="p-8">
                  {data.history_events.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                      아직 이 차분에는 변경 이력이 없습니다.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-4 py-4 text-left font-semibold">변경시각</th>
                              <th className="px-4 py-4 text-left font-semibold">호기</th>
                              <th className="px-4 py-4 text-left font-semibold">구분</th>
                              <th className="px-4 py-4 text-left font-semibold">이벤트</th>
                              <th className="px-4 py-4 text-left font-semibold">변경유형</th>
                              <th className="px-4 py-4 text-left font-semibold">날짜 변경</th>
                              <th className="px-4 py-4 text-left font-semibold">작업자</th>
                              <th className="px-4 py-4 text-left font-semibold">사유</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {data.history_events.map((row) => (
                              <tr
                                key={row.id}
                                className="hover:bg-sky-50/60 align-top"
                              >
                                <td className="px-4 py-4 text-slate-500">
                                  {fmtDateTime(row.created_at)}
                                </td>
                                <td className="px-4 py-4 font-medium text-slate-900">
                                  {row.machine_no || "-"}
                                </td>
                                <td className="px-4 py-4 text-slate-700">
                                  {sourceTypeLabel(row.source_type)}
                                </td>
                                <td className="px-4 py-4 text-slate-900">
                                  {row.event_name}
                                </td>
                                <td className="px-4 py-4">
                                  <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold ${changeTypeClass(
                                      row.change_type
                                    )}`}
                                  >
                                    {row.change_type}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-slate-700">
                                  {arrowDateText(
                                    row.before_event_date,
                                    row.after_event_date
                                  )}
                                </td>
                                <td className="px-4 py-4 text-slate-700">
                                  {row.changed_by || "-"}
                                </td>
                                <td className="px-4 py-4 text-slate-600">
                                  {row.change_reason || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-8 py-5">
                    <h2 className="text-xl font-bold text-slate-900">
                      이벤트별 변경 빈도
                    </h2>
                  </div>

                  <div className="p-8">
                    {data.history_event_summary.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                        집계할 변경 이력이 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {data.history_event_summary.map((row) => (
                          <div
                            key={row.event_name}
                            className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200"
                          >
                            <div className="font-medium text-slate-800">
                              {row.event_name}
                            </div>
                            <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-bold text-sky-700">
                              {row.change_count}건
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-8 py-5">
                    <h2 className="text-xl font-bold text-slate-900">
                      현재 호기별 일정
                    </h2>
                  </div>

                  <div className="max-h-[720px] space-y-4 overflow-y-auto p-8">
                    {groupedCurrent.length === 0 ? (
                      <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                        현재 일정이 없습니다.
                      </div>
                    ) : (
                      groupedCurrent.map((group) => (
                        <div
                          key={group.machineNo}
                          className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200"
                        >
                          <div className="mb-4 text-lg font-bold text-slate-900">
                            {group.machineNo}
                          </div>

                          <div className="space-y-3">
                            {group.events.map((row) => (
                              <div
                                key={row.id}
                                className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 ring-1 ring-slate-200"
                              >
                                <div>
                                  <div className="text-sm font-semibold text-slate-900">
                                    {row.event_name}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {sourceTypeLabel(row.source_type)}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-900">
                                    {fmtDate(row.event_date)}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500">
                                    {row.status || "-"}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default ScheduleBatchHistoryPage;