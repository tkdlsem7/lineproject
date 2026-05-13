import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type TimeStat = {
  model: string;
  option_name: string;
  item_count: number;
  time_input_count: number;
  avg_minutes?: number | null;
  avg_time_text: string;
  min_time_text: string;
  max_time_text: string;
};

type JudgeManagerStat = {
  remodel_manager: string;
  total_jobs: number;
  defect_jobs: number;
  defect_rate: number;
};

type JudgeSummary = {
  total_jobs: number;
  defect_jobs: number;
  defect_rate: number;
};

type MonthlyStat = {
  month: string;
  model: string;
  option_name: string;
  item_count: number;
};

type FiltersResponse = {
  models: string[];
  managers: string[];
  options: { id: number; option_name: string }[];
  min_date?: string | null;
  max_date?: string | null;
};

type DashboardResponse = {
  applied_filters: {
    start_date?: string | null;
    end_date?: string | null;
    model?: string | null;
    manager?: string | null;
    option_id?: number | null;
  };
  model_option_times: TimeStat[];
  result_summary_overall: JudgeSummary;
  result_summary_by_manager: JudgeManagerStat[];
  monthly_model_option_counts: MonthlyStat[];
};

const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const safeGet = (k: string) => {
  try {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
};

const getAuthHeaders = () => {
  const token = safeGet("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.msg) return item.msg;
          return JSON.stringify(item);
        })
        .join("\n");
    }
    if (error.code === "ERR_NETWORK") {
      return "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해줘.";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "데이터를 불러오지 못했습니다.";
};

const Shell: React.FC<{
  children: React.ReactNode;
  header?: string;
  subText?: string;
  badge?: string;
  right?: React.ReactNode;
  className?: string;
}> = ({ children, header, subText, badge, right, className }) => (
  <section
    className={`overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70 ${
      className ?? ""
    }`}
  >
    <div className="h-2 bg-gradient-to-r from-orange-300 via-amber-200 to-sky-300" />
    {(header || right) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            {header && (
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                {header}
              </h2>
            )}
            {badge && (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
                {badge}
              </span>
            )}
          </div>
          {subText && <p className="mt-1 text-sm text-slate-500">{subText}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

const StatCard: React.FC<{
  label: string;
  value: string;
  help: string;
}> = ({ label, value, help }) => (
  <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
    <div className="text-sm font-semibold text-slate-500">{label}</div>
    <div className="mt-2 text-3xl font-extrabold tracking-tight text-slate-900">{value}</div>
    <div className="mt-2 text-xs text-slate-500">{help}</div>
  </div>
);

const FilterChip: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
      active
        ? "bg-sky-600 text-white shadow-sm"
        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
    }`}
  >
    {label}
  </button>
);

const BarRow: React.FC<{
  label: string;
  value: number;
  max: number;
  suffix?: string;
}> = ({ label, value, max, suffix = "" }) => {
  const percent = max > 0 ? Math.max(8, (value / max) * 100) : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 truncate text-sm font-semibold text-slate-700">{label}</div>
        <div className="shrink-0 text-sm font-extrabold text-slate-900">
          {value}
          {suffix}
        </div>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-orange-400 via-amber-300 to-sky-400"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};

const EquipmentRemodelLogPage: React.FC = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [filterOptions, setFilterOptions] = useState<FiltersResponse | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedModel, setSelectedModel] = useState("전체");
  const [selectedManager, setSelectedManager] = useState("전체");
  const [selectedOptionId, setSelectedOptionId] = useState<number | "전체">("전체");

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const res = await axios.get<FiltersResponse>(`${API_BASE}/equipment-remodel-logs/filters`, {
          headers: getAuthHeaders(),
        });
        setFilterOptions(res.data);
      } catch (error) {
        setError(getErrorMessage(error));
      }
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get<DashboardResponse>(
          `${API_BASE}/equipment-remodel-logs/dashboard`,
          {
            headers: getAuthHeaders(),
            params: {
              start_date: startDate || undefined,
              end_date: endDate || undefined,
              model: selectedModel === "전체" ? undefined : selectedModel,
              manager: selectedManager === "전체" ? undefined : selectedManager,
              option_id: selectedOptionId === "전체" ? undefined : selectedOptionId,
            },
          }
        );

        setDashboard(res.data);
      } catch (error) {
        setError(getErrorMessage(error));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [startDate, endDate, selectedModel, selectedManager, selectedOptionId]);

  const timeStats = dashboard?.model_option_times ?? [];
  const judgeSummary = dashboard?.result_summary_overall ?? {
    total_jobs: 0,
    defect_jobs: 0,
    defect_rate: 0,
  };
  const managerStats = dashboard?.result_summary_by_manager ?? [];
  const monthlyStats = dashboard?.monthly_model_option_counts ?? [];

  const modelItems = useMemo(
    () => ["전체", ...(filterOptions?.models ?? [])],
    [filterOptions]
  );
  const managerItems = useMemo(
    () => ["전체", ...(filterOptions?.managers ?? [])],
    [filterOptions]
  );
  const optionItems = filterOptions?.options ?? [];

  const maxTimeValue = Math.max(...timeStats.map((item) => item.avg_minutes ?? 0), 0);
  const maxDefectRate = Math.max(...managerStats.map((item) => item.defect_rate), 0);
  const maxMonthlyCount = Math.max(...monthlyStats.map((item) => item.item_count), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 px-4 py-6">
      <div className="mx-auto w-full max-w-[1480px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">MES · Log Analysis</div>
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              장비 개조 로그 분석
            </div>
            <div className="mt-1 text-sm text-slate-500">
              기간을 선택해서 로그를 보고, 필요하면 관리 페이지에서 바로 수정할 수 있어.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/log/remodel/manage")}
              className="rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
            >
              개조 로그 관리
            </button>
            <button
              type="button"
              onClick={() => navigate("/main")}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              메인으로
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}

        <Shell header="공통 기간 필터" subText="선택한 기간이 아래 3개 로그에 같이 적용돼." badge="Date Filter">
          <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">시작일</label>
              <input
                type="date"
                value={startDate}
                min={filterOptions?.min_date ?? undefined}
                max={filterOptions?.max_date ?? undefined}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">종료일</label>
              <input
                type="date"
                value={endDate}
                min={filterOptions?.min_date ?? undefined}
                max={filterOptions?.max_date ?? undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">모델</label>
              <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-50 p-2 ring-1 ring-slate-200/70">
                {modelItems.map((item) => (
                  <FilterChip
                    key={item}
                    label={item}
                    active={selectedModel === item}
                    onClick={() => setSelectedModel(item)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">담당자 / 옵션</label>
              <div className="space-y-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                <select
                  value={selectedManager}
                  onChange={(e) => setSelectedManager(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  {managerItems.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedOptionId}
                  onChange={(e) =>
                    setSelectedOptionId(e.target.value === "전체" ? "전체" : Number(e.target.value))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  <option value="전체">전체 옵션</option>
                  {optionItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.option_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </Shell>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="총 작업 건수" value={`${judgeSummary.total_jobs}건`} help="equipment_remodel 기준 전체 작업 건수" />
          <StatCard label="부적합 판정" value={`${judgeSummary.defect_jobs}건`} help="result_status = 부적합 기준" />
          <StatCard label="부적합 비율" value={`${judgeSummary.defect_rate.toFixed(1)}%`} help="전체 작업 대비 부적합 비율" />
          <StatCard
            label="평균 개조 시간"
            value={`${timeStats[0]?.avg_time_text ?? "-"}`}
            help={loading ? "불러오는 중" : `모델/옵션 집계 ${timeStats.length}건`}
          />
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Shell
            header="1. 모델 옵션에 따른 개조시간"
            subText="체크리스트별 개조 소요시간을 기준으로 모델 + 옵션 평균 시간을 집계했어."
            badge="Time"
            right={<span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{loading ? "불러오는 중" : `${timeStats.length}개 항목`}</span>}
          >
            <div className="grid grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                <div className="mb-4 text-sm font-extrabold text-slate-800">옵션별 평균 소요시간</div>
                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-500">불러오는 중…</div>
                ) : timeStats.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">표시할 데이터가 없어.</div>
                ) : (
                  <div className="space-y-4">
                    {timeStats.map((item) => (
                      <BarRow
                        key={`${item.model}-${item.option_name}`}
                        label={`${item.model} · ${item.option_name}`}
                        value={item.avg_minutes ?? 0}
                        max={maxTimeValue}
                        suffix="분"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-slate-200/70">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4 text-sm font-extrabold text-slate-800">상세 표</div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-5 py-3 text-left font-semibold">모델</th>
                        <th className="px-5 py-3 text-left font-semibold">옵션</th>
                        <th className="px-5 py-3 text-right font-semibold">평균</th>
                        <th className="px-5 py-3 text-right font-semibold">최소</th>
                        <th className="px-5 py-3 text-right font-semibold">최대</th>
                        <th className="px-5 py-3 text-right font-semibold">건수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!loading && timeStats.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-5 py-10 text-center text-slate-500">데이터가 없습니다.</td>
                        </tr>
                      )}
                      {timeStats.map((item) => (
                        <tr key={`${item.model}-${item.option_name}`} className="border-t border-slate-100">
                          <td className="px-5 py-3 font-semibold text-slate-800">{item.model}</td>
                          <td className="px-5 py-3 text-slate-700">{item.option_name}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">{item.avg_time_text}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{item.min_time_text}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{item.max_time_text}</td>
                          <td className="px-5 py-3 text-right text-slate-600">{item.item_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </Shell>

          <Shell header="2. 작업 건수 대비 부적합 판정 건수" subText="전체 요약과 담당자별 비교를 같이 볼 수 있게 만들었어." badge="Judgement">
            <div className="grid grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-1">
                <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                  <div className="text-sm font-semibold text-slate-500">전체 작업</div>
                  <div className="mt-2 text-3xl font-extrabold text-slate-900">{judgeSummary.total_jobs}건</div>
                </div>
                <div className="rounded-3xl bg-rose-50 p-5 ring-1 ring-rose-200/70">
                  <div className="text-sm font-semibold text-rose-500">전체 부적합</div>
                  <div className="mt-2 text-3xl font-extrabold text-rose-700">{judgeSummary.defect_jobs}건</div>
                </div>
                <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200/70">
                  <div className="text-sm font-semibold text-amber-600">전체 비율</div>
                  <div className="mt-2 text-3xl font-extrabold text-amber-700">{judgeSummary.defect_rate.toFixed(1)}%</div>
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/70">
                <div className="mb-4 text-sm font-extrabold text-slate-800">담당자별 부적합 비율</div>
                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-500">불러오는 중…</div>
                ) : managerStats.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">표시할 데이터가 없어.</div>
                ) : (
                  <div className="space-y-5">
                    {managerStats.map((item) => (
                      <div key={item.remodel_manager} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-extrabold text-slate-900">{item.remodel_manager}</div>
                            <div className="text-xs text-slate-500">전체 {item.total_jobs}건 · 부적합 {item.defect_jobs}건</div>
                          </div>
                          <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800 ring-1 ring-slate-200">{item.defect_rate.toFixed(1)}%</div>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                          <div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-orange-300 to-amber-300" style={{ width: `${maxDefectRate > 0 ? Math.max(8, (item.defect_rate / maxDefectRate) * 100) : 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Shell>

          <Shell header="3. 월별 모델 옵션 개조 항목 건수" subText="월별로 어떤 모델 / 옵션이 많이 들어왔는지 체크리스트 기준으로 집계했어." badge="Monthly">
            <div className="grid grid-cols-1 gap-6 px-6 py-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                <div className="mb-4 text-sm font-extrabold text-slate-800">월별 개조 항목 건수</div>
                {loading ? (
                  <div className="py-12 text-center text-sm text-slate-500">불러오는 중…</div>
                ) : monthlyStats.length === 0 ? (
                  <div className="py-12 text-center text-sm text-slate-500">표시할 데이터가 없어.</div>
                ) : (
                  <div className="space-y-4">
                    {monthlyStats.map((item) => (
                      <BarRow
                        key={`${item.month}-${item.model}-${item.option_name}`}
                        label={`${item.month} · ${item.model} · ${item.option_name}`}
                        value={item.item_count}
                        max={maxMonthlyCount}
                        suffix="건"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200/70">
                <div className="mb-4 text-sm font-extrabold text-slate-800">월별 카드 요약</div>
                <div className="grid grid-cols-1 gap-3">
                  {!loading && monthlyStats.length === 0 && (
                    <div className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">데이터가 없습니다.</div>
                  )}
                  {monthlyStats.map((item) => (
                    <div key={`${item.month}-${item.model}-${item.option_name}-card`} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200/70">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-extrabold text-slate-900">{item.month}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.model} · {item.option_name}</div>
                        </div>
                        <div className="rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800 ring-1 ring-slate-200">{item.item_count}건</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Shell>
        </div>
      </div>
    </div>
  );
};

export default EquipmentRemodelLogPage;
