import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  fetchEquipmentDetail,
  type EquipmentDetailResponse,
  type ScheduleEvent,
} from "../lib/scheduleHubApi";

type ViewTab = "timeline" | "gantt" | "calendar";

type CalendarCursor = {
  year: number;
  month: number; // 1 ~ 12
};

const sidebarItemBase =
  "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition";
const sidebarItemActive =
  "bg-sky-600/20 text-white ring-1 ring-sky-400/30";
const sidebarItemInactive =
  "text-slate-300 hover:bg-white/5 hover:text-white";

const topTabClass = (active: boolean) =>
  `inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition ${
    active
      ? "border-sky-500 text-sky-600"
      : "border-transparent text-slate-500 hover:text-slate-700"
  }`;

const sourceLabel = (sourceType?: string | null) => {
  const source = (sourceType || "").toLowerCase();
  if (source === "production") return "생산일정";
  if (source === "shipment") return "출하일정";
  if (source === "interface") return "인터페이스";
  if (source === "mani") return "MANI";
  if (source === "remodel") return "개조";
  if (source === "remodel_manual") return "개조일정";
  if (source === "chiller") return "칠러";
  if (source === "opus") return "OPUS";
  return sourceType || "기타";
};

const sourceTheme = (sourceType?: string | null) => {
  const source = (sourceType || "").toLowerCase();

  if (source === "production") {
    return {
      badge: "bg-blue-100 text-blue-700",
      dot: "bg-blue-600",
      gantt: "bg-blue-600 text-white",
      legend: "bg-blue-600",
    };
  }
  if (source === "shipment") {
    return {
      badge: "bg-amber-100 text-amber-700",
      dot: "bg-amber-500",
      gantt: "bg-amber-500 text-white",
      legend: "bg-amber-500",
    };
  }
  if (source === "interface") {
    return {
      badge: "bg-violet-100 text-violet-700",
      dot: "bg-violet-600",
      gantt: "bg-violet-600 text-white",
      legend: "bg-violet-600",
    };
  }
  if (source === "mani") {
    return {
      badge: "bg-fuchsia-100 text-fuchsia-700",
      dot: "bg-fuchsia-600",
      gantt: "bg-fuchsia-600 text-white",
      legend: "bg-fuchsia-600",
    };
  }
  if (source === "remodel") {
    return {
      badge: "bg-rose-100 text-rose-700",
      dot: "bg-rose-600",
      gantt: "bg-rose-600 text-white",
      legend: "bg-rose-600",
    };
  }
  if (source === "remodel_manual") {
    return {
      badge: "bg-orange-100 text-orange-700",
      dot: "bg-orange-500",
      gantt: "bg-orange-500 text-white",
      legend: "bg-orange-500",
    };
  }
  if (source === "chiller") {
    return {
      badge: "bg-teal-100 text-teal-700",
      dot: "bg-teal-600",
      gantt: "bg-teal-600 text-white",
      legend: "bg-teal-600",
    };
  }
  if (source === "opus") {
    return {
      badge: "bg-indigo-100 text-indigo-700",
      dot: "bg-indigo-600",
      gantt: "bg-indigo-600 text-white",
      legend: "bg-indigo-600",
    };
  }
  return {
    badge: "bg-slate-100 text-slate-700",
    dot: "bg-slate-500",
    gantt: "bg-slate-600 text-white",
    legend: "bg-slate-500",
  };
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return value;
};

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const formatMonthTitle = (year: number, month: number) =>
  `${year}.${String(month).padStart(2, "0")}`;

const formatDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const isSameDateKey = (a?: string | null, b?: string | null) =>
  !!a && !!b && a === b;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (cursor: CalendarCursor, diff: number): CalendarCursor => {
  const base = new Date(cursor.year, cursor.month - 1 + diff, 1);
  return { year: base.getFullYear(), month: base.getMonth() + 1 };
};

const getCalendarCursorFromEvents = (events: ScheduleEvent[]): CalendarCursor => {
  const first = events.find((e) => !!e.event_date);
  const date = first ? parseDate(first.event_date) : new Date();
  const safe = date ?? new Date();
  return {
    year: safe.getFullYear(),
    month: safe.getMonth() + 1,
  };
};

const eventTitleSort = (events: ScheduleEvent[]) => {
  return [...events].sort((a, b) => {
    if (a.event_date !== b.event_date) {
      return a.event_date.localeCompare(b.event_date);
    }
    return a.id - b.id;
  });
};

const statusBadgeClass = (detail?: EquipmentDetailResponse | null) => {
  const status = (detail?.equipment.current_status || "").toLowerCase();

  if (
    detail?.equipment.is_shipped ||
    status.includes("출하") ||
    status.includes("완료")
  ) {
    return "bg-violet-100 text-violet-700";
  }
  if (
    status.includes("진행") ||
    status.includes("setting") ||
    status.includes("qc")
  ) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-slate-100 text-slate-700";
};

const statusLabel = (detail?: EquipmentDetailResponse | null) => {
  if (detail?.equipment.current_status?.trim()) return detail.equipment.current_status;
  return detail?.equipment.is_shipped ? "출하완료" : "진행중";
};

const getChangedReason = (event: ScheduleEvent) => {
  const data = (event.extra_data ?? {}) as Record<string, any>;

  return (
    data.changed_reason ||
    data.change_reason ||
    data.reason ||
    data.delay_reason ||
    data.manager_feedback ||
    ""
  );
};

const EquipmentScheduleDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { equipmentId } = useParams<{ equipmentId: string }>();

  const [tab, setTab] = useState<ViewTab>("timeline");
  const [detail, setDetail] = useState<EquipmentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [openedEventId, setOpenedEventId] = useState<number | null>(null);
  const [calendarCursor, setCalendarCursor] = useState<CalendarCursor>({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  useEffect(() => {
    if (!equipmentId) return;

    const loadDetail = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await fetchEquipmentDetail(Number(equipmentId));
        setDetail(res);
        setCalendarCursor(getCalendarCursorFromEvents(res.events ?? []));
      } catch (e: any) {
        setError(e?.message ?? "장비 상세 조회 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [equipmentId]);

  const sortedEvents = useMemo(
    () => eventTitleSort(detail?.events ?? []),
    [detail]
  );

  const ganttDays = useMemo(() => {
    if (sortedEvents.length === 0) return [];

    const dates = sortedEvents
      .map((e) => parseDate(e.event_date))
      .filter((v): v is Date => !!v);

    if (dates.length === 0) return [];

    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const start = addDays(minDate, -3);
    const end = addDays(maxDate, 3);

    const result: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
      result.push(new Date(current));
      current = addDays(current, 1);
    }

    return result;
  }, [sortedEvents]);

  const ganttMonthSpans = useMemo(() => {
    if (ganttDays.length === 0) return [];

    const groups: Array<{ key: string; label: string; count: number }> = [];
    ganttDays.forEach((date) => {
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
      const label = formatMonthTitle(date.getFullYear(), date.getMonth() + 1);

      const last = groups[groups.length - 1];
      if (!last || last.key !== key) {
        groups.push({ key, label, count: 1 });
      } else {
        last.count += 1;
      }
    });

    return groups;
  }, [ganttDays]);

  const calendarCells = useMemo(() => {
    const { year, month } = calendarCursor;
    const firstDay = new Date(year, month - 1, 1);
    const startWeekday = firstDay.getDay();

    const cells: Array<{
      date: Date;
      key: string;
      inCurrentMonth: boolean;
      isToday: boolean;
      events: ScheduleEvent[];
    }> = [];

    for (let i = 0; i < 42; i += 1) {
      const cellDate = new Date(year, month - 1, i - startWeekday + 1);
      const key = formatDateKey(cellDate);

      cells.push({
        date: cellDate,
        key,
        inCurrentMonth: cellDate.getMonth() === month - 1,
        isToday: key === formatDateKey(new Date()),
        events: sortedEvents.filter((event) => isSameDateKey(event.event_date, key)),
      });
    }

    return cells;
  }, [calendarCursor, sortedEvents]);

  const infoCards = useMemo(() => {
    if (!detail) return [];

    return [
      { label: "고객사", value: detail.equipment.customer_name || "-" },
      { label: "모델", value: detail.equipment.model || "-" },
      { label: "STAGE S/N", value: detail.equipment.stage_sn || "-" },
      { label: "LOADER S/N", value: detail.equipment.loader_sn || "-" },
      { label: "냉각 타입", value: detail.equipment.cold_type || "-" },
      { label: "MANI 타입", value: detail.equipment.mani_type || "-" },
    ];
  }, [detail]);

  const renderTimeline = () => {
    if (sortedEvents.length === 0) {
      return (
        <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center text-slate-500">
          표시할 일정 이벤트가 없습니다.
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-extrabold text-slate-900">일정 타임라인</h2>
            {!!detail?.changed_count && (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                ⚠ 변경 {detail.changed_count}건
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-6">
          <div className="relative">
            <div className="absolute bottom-0 left-[132px] top-0 w-px bg-slate-200" />

            <div className="space-y-3">
              {sortedEvents.map((event) => {
                const theme = sourceTheme(event.source_type);
                const changedReason = getChangedReason(event);
                const isOpen = openedEventId === event.id;

                return (
                  <div
                    key={event.id}
                    className={`grid grid-cols-[110px_26px_minmax(0,1fr)] gap-3 rounded-2xl px-3 py-4 transition ${
                      event.is_changed ? "bg-amber-50/70 ring-1 ring-amber-200" : ""
                    } ${changedReason ? "cursor-pointer hover:bg-slate-50" : ""}`}
                    onClick={() => {
                      if (!changedReason) return;
                      setOpenedEventId((prev) => (prev === event.id ? null : event.id));
                    }}
                  >
                    <div className="pt-1 text-right text-sm font-semibold text-slate-500">
                      {formatDate(event.event_date)}
                    </div>

                    <div className="relative flex justify-center">
                      <span className="mt-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full border-4 border-white bg-white shadow-sm ring-1 ring-slate-200">
                        <span className={`h-2.5 w-2.5 rounded-full ${theme.dot}`} />
                      </span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-extrabold text-slate-900">
                          {event.event_name}
                        </h3>

                        {event.is_changed && (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-amber-300">
                            변경
                          </span>
                        )}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <span
                          className={`inline-flex rounded-lg px-3 py-1 font-bold ${theme.badge}`}
                        >
                          {sourceLabel(event.source_type)}
                        </span>

                        {event.mo_no && (
                          <span className="text-slate-500">{event.mo_no}</span>
                        )}

                        {event.previous_date && (
                          <span className="text-sm text-slate-400 line-through">
                            {event.previous_date}
                          </span>
                        )}

                        {(event.extra_data as any)?.prober_sn && (
                          <span className="text-sm text-slate-500">
                            PROBER {String((event.extra_data as any).prober_sn)}
                          </span>
                        )}

                        {changedReason && (
                          <span className="text-xs font-semibold text-orange-600">
                            {isOpen ? "사유 접기" : "사유 보기"}
                          </span>
                        )}
                      </div>

                      {isOpen && changedReason && (
                        <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-orange-200">
                          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-orange-700">
                            일정 변경 사유
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            {changedReason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderGantt = () => {
    if (sortedEvents.length === 0 || ganttDays.length === 0) {
      return (
        <div className="rounded-2xl bg-slate-50 px-6 py-12 text-center text-slate-500">
          표시할 간트 데이터가 없습니다.
        </div>
      );
    }

    return (
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-extrabold text-slate-900">간트 차트</h2>
        </div>

        <div className="px-6 py-6">
          <div className="relative w-full max-w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <div
              className="inline-grid min-w-max"
              style={{
                gridTemplateColumns: `180px repeat(${ganttDays.length}, 56px)`,
              }}
            >
              <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-white px-3 py-3" />
              {ganttMonthSpans.map((group) => (
                <div
                  key={group.key}
                  className="border-b border-slate-200 bg-white px-2 py-3 text-left text-sm font-extrabold text-slate-900"
                  style={{ gridColumn: `span ${group.count}` }}
                >
                  {group.label}
                </div>
              ))}

              <div className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-sm font-bold text-slate-500">
                이벤트
              </div>

              {ganttDays.map((date) => {
                const day = date.getDay();
                const weekendClass =
                  day === 0
                    ? "text-red-500"
                    : day === 6
                      ? "text-blue-500"
                      : "text-slate-500";

                return (
                  <div
                    key={formatDateKey(date)}
                    className={`border-b border-slate-200 bg-slate-50 px-1 py-3 text-center text-xs font-medium ${weekendClass}`}
                  >
                    {date.getDate()}
                  </div>
                );
              })}

              {sortedEvents.map((event) => {
                const theme = sourceTheme(event.source_type);

                return (
                  <React.Fragment key={event.id}>
                    <div className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-3">
                      <div className="truncate text-sm font-bold text-slate-900">
                        {event.event_name}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">
                        {sourceLabel(event.source_type)}
                      </div>
                    </div>

                    {ganttDays.map((date) => {
                      const key = formatDateKey(date);
                      const matched = isSameDateKey(event.event_date, key);

                      return (
                        <div
                          key={`${event.id}-${key}`}
                          className="border-b border-slate-100 px-1 py-2"
                        >
                          {matched ? (
                            <div
                              className={`flex h-8 items-center justify-center rounded-lg px-1 text-[10px] font-bold shadow-sm ${theme.gantt}`}
                              title={`${event.event_name} / ${event.event_date}`}
                            >
                              {event.event_date}
                            </div>
                          ) : (
                            <div className="h-8" />
                          )}
                        </div>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-600">
            {[
              "production",
              "shipment",
              "interface",
              "mani",
              "remodel",
              "remodel_manual",
              "chiller",
              "opus",
            ].map((source) => {
              const theme = sourceTheme(source);
              return (
                <div key={source} className="flex items-center gap-2">
                  <span className={`h-3.5 w-3.5 rounded ${theme.legend}`} />
                  <span>{sourceLabel(source)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

    return (
      <div className="rounded-3xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-extrabold text-slate-900">캘린더</h2>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCalendarCursor((prev) => addMonths(prev, -1))}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              이전
            </button>

            <div className="min-w-[110px] text-center text-sm font-extrabold text-slate-900">
              {formatMonthTitle(calendarCursor.year, calendarCursor.month)}
            </div>

            <button
              type="button"
              onClick={() => setCalendarCursor((prev) => addMonths(prev, 1))}
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              다음
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {weekdayLabels.map((label, idx) => (
            <div
              key={label}
              className={`px-3 py-3 text-center text-sm font-bold ${
                idx === 0
                  ? "text-red-500"
                  : idx === 6
                    ? "text-blue-500"
                    : "text-slate-600"
              }`}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {calendarCells.map((cell) => (
            <div
              key={cell.key}
              className={`min-h-[140px] border-b border-r border-slate-100 p-2 ${
                cell.inCurrentMonth ? "bg-white" : "bg-slate-50/70"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                    cell.isToday
                      ? "bg-red-500 text-white"
                      : cell.inCurrentMonth
                        ? "text-slate-800"
                        : "text-slate-400"
                  }`}
                >
                  {cell.date.getDate()}
                </span>
              </div>

              <div className="space-y-1.5">
                {cell.events.slice(0, 3).map((event) => {
                  const theme = sourceTheme(event.source_type);

                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg px-2 py-1 text-[11px] font-bold ${theme.badge}`}
                      title={event.event_name}
                    >
                      <div className="truncate">{event.event_name}</div>
                    </div>
                  );
                })}

                {cell.events.length > 3 && (
                  <div className="px-1 text-[11px] font-bold text-slate-500">
                    +{cell.events.length - 3}건 더보기
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex min-h-screen">
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
                <span>장비 일정</span>
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

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="border-b border-slate-200 bg-white px-8 py-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate("/equipment-schedule")}
                    className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                  >
                    ← 목록으로
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/main")}
                    className="rounded-full bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
                  >
                    🏠 메인으로
                  </button>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {detail?.equipment.machine_no || "장비 상세"}
                </h1>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(
                      detail
                    )}`}
                  >
                    {statusLabel(detail)}
                  </span>

                  {detail?.equipment.customer_name && (
                    <span className="text-sm font-medium text-slate-500">
                      고객사 {detail.equipment.customer_name}
                    </span>
                  )}

                  {detail?.equipment.model && (
                    <span className="text-sm font-medium text-slate-500">
                      모델 {detail.equipment.model}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                  이벤트 수
                </div>
                <div className="mt-1 text-2xl font-extrabold text-slate-900">
                  {sortedEvents.length}건
                </div>
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-6 px-8 py-8">
            {loading ? (
              <div className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                장비 상세를 불러오는 중...
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 px-6 py-12 text-center text-red-600 shadow-sm ring-1 ring-red-200">
                {error}
              </div>
            ) : !detail ? (
              <div className="rounded-2xl bg-white px-6 py-12 text-center text-slate-500 shadow-sm ring-1 ring-slate-200">
                장비 정보를 찾을 수 없습니다.
              </div>
            ) : (
              <>
                <section className="min-w-0 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-6 py-5">
                    <h2 className="text-xl font-extrabold text-slate-900">장비 정보</h2>
                  </div>

                  <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                    {infoCards.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl bg-slate-50 px-5 py-4 ring-1 ring-slate-200"
                      >
                        <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                          {item.label}
                        </div>
                        <div className="mt-2 text-base font-bold text-slate-900">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="border-b border-slate-200 px-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className={topTabClass(tab === "timeline")}
                        onClick={() => setTab("timeline")}
                      >
                        📋 타임라인
                      </button>
                      <button
                        type="button"
                        className={topTabClass(tab === "gantt")}
                        onClick={() => setTab("gantt")}
                      >
                        📊 간트 차트
                      </button>
                      <button
                        type="button"
                        className={topTabClass(tab === "calendar")}
                        onClick={() => setTab("calendar")}
                      >
                        🗓️ 캘린더
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    {tab === "timeline" && renderTimeline()}
                    {tab === "gantt" && renderGantt()}
                    {tab === "calendar" && renderCalendar()}
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default EquipmentScheduleDetailPage;