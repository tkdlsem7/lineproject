// src/LogChart/LogChartPage.tsx
// ────────────────────────────────────────────────────────────────
// Log Charts (색상 팔레트 적용)
// - 리드 스테이지 평균(입고→시작 / 시작→완료 / 완료→출하)
// - Step 공수 (KPI 가로 넓힘 + 차트 + 표)
// - 불량 현황, 월별 입/출하
// ────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, ComposedChart, Line, LabelList, Cell
} from 'recharts';

// CRA/Vite 공용: 환경변수 → 없으면 '/api'
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

// ── 공통 팔레트 (Tailwind 톤)
const CHART_COLORS = [
  '#2563eb', // blue-600
  '#10b981', // emerald-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#8b5cf6', // violet-500
  '#06b6d4', // cyan-500
  '#84cc16', // lime-500
  '#f97316', // orange-500
];

function SectionCard({ title, desc, right, children }: {
  title: string; desc?: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <section className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {desc && <p className="mt-1 text-sm text-gray-500">{desc}</p>}
        </div>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function KPI({ label, value = '—', sub, className = '' }: {
  label: string; value?: string | number; sub?: string; className?: string;
}) {
  return (
    <div className={`rounded-xl border border-gray-200 p-5 bg-gray-50 ${className}`}>
      <div className="text-xs text-gray-500 whitespace-nowrap">{label}</div>
      <div className="mt-1 text-3xl font-extrabold text-gray-900 tabular-nums tracking-tight">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function MiniTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="grid grid-cols-5 bg-gray-50 text-xs font-medium text-gray-600">
        <div className="px-3 py-2">STEP</div>
        <div className="px-3 py-2 text-right">COUNT</div>
        <div className="px-3 py-2 text-right">AVG</div>
        <div className="px-3 py-2 text-right">MAX</div>
        <div className="px-3 py-2 text-right">MIN</div>
      </div>
      {[...Array(6)].map((_, i) => (
        <div key={i} className="grid grid-cols-5 border-t border-gray-100 text-sm">
          {[...Array(5)].map((__, j) => (
            <div key={j} className={"px-3 py-2 " + (j === 0 ? "text-gray-700" : "text-right text-gray-500") }>
              <span className="inline-block h-3 w-24 bg-gray-100 rounded animate-pulse"/>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepTable({ items }: { items: StepStatItem[] }) {
  const rows = [...items].sort((a, b) => b.avg_hours - a.avg_hours);
  const f = (n: number) => `${n.toFixed(2)} h`;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full table-fixed">
        <thead className="bg-gray-50 text-xs font-medium text-gray-600">
          <tr>
            <th className="px-3 py-2 text-left w-[30%]">STEP</th>
            <th className="px-3 py-2 text-right w-[15%]">COUNT</th>
            <th className="px-3 py-2 text-right w-[18%]">AVG</th>
            <th className="px-3 py-2 text-right w-[18%]">MAX</th>
            <th className="px-3 py-2 text-right w-[19%]">MIN</th>
          </tr>
        </thead>
        <tbody className="text-sm">
          {rows.map((r) => (
            <tr key={r.step} className="border-t border-gray-100">
              <td className="px-3 py-2 text-gray-800 truncate">{r.step || 'UNKNOWN'}</td>
              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{r.count}</td>
              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{f(r.avg_hours)}</td>
              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{f(r.max_hours)}</td>
              <td className="px-3 py-2 text-right text-gray-700 tabular-nums">{f(r.min_hours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 타입들
export type StepStatItem = { step: string; count: number; avg_hours: number; max_hours: number; min_hours: number; };
export type StepStats = { total_hours: number; steps: StepStatItem[] };

export type KeyCount = { key: string; count: number };
export type DefectStats = {
  per_unit_avg: number; per_unit_max: number; per_unit_min: number;
  ts_time_per_unit_avg_hours: number;
  incoming_quality_avg?: number | null;
  incoming_quality_max?: number | null;
  incoming_quality_min?: number | null;
  by_category: KeyCount[]; by_location: KeyCount[]; by_item: KeyCount[]; by_type: KeyCount[];
};

export type MonthFlowItem = { month: string; receipts: number; shipments: number; turnover_rate?: number | null };
export type MonthlyFlow = {
  total_receipts: number; total_shipments: number;
  avg_turnover_rate?: number | null; max_turnover_rate?: number | null; min_turnover_rate?: number | null;
  months: MonthFlowItem[];
};

export type LeadStageStats = {
  receipt_to_start_avg_days: number;
  start_to_complete_avg_days: number;
  complete_to_ship_avg_days: number;
  receipt_to_start_min_days: number;
  receipt_to_start_max_days: number;
  start_to_complete_min_days: number;
  start_to_complete_max_days: number;
  complete_to_ship_min_days: number;
  complete_to_ship_max_days: number;
  n_receipt_to_start: number;
  n_start_to_complete: number;
  n_complete_to_ship: number;
};

// ── 포맷터
function fmtDays(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} d` : '—'; }
function fmtHours(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} h` : '—'; }
function fmtCount(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n}` : '—'; }
function fmtRate(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} %` : '—'; }

// ── 페이지
export default function LogChartPage() {
  const today = useMemo(() => new Date(), []);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');

  const [startMonth, setStartMonth] = useState(`${y}-${m}`);
  const [endMonth, setEndMonth] = useState(`${y}-${m}`);

  const [leadStages, setLeadStages] = useState<LeadStageStats | null>(null);
  const [steps, setSteps] = useState<StepStats | null>(null);
  const [defects, setDefects] = useState<DefectStats | null>(null);
  const [flows, setFlows] = useState<MonthlyFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const params = { from_month: startMonth, to_month: endMonth };
    setLoading(true); setError(null);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        axios.get(`${API_BASE}/logcharts/leadstages`, { params }),
        axios.get(`${API_BASE}/logcharts/steps`, { params }),
        axios.get(`${API_BASE}/logcharts/defects`, { params }),
        axios.get(`${API_BASE}/logcharts/flows`, { params }),
      ]);
      setLeadStages(r1.data); setSteps(r2.data); setDefects(r3.data); setFlows(r4.data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '데이터 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, []);

  // 차트 데이터
  const leadStageChart = useMemo(() => {
    if (!leadStages) return [] as Array<{ name: string; avg: number }>;
    return [
      { name: '입고→생산시작', avg: leadStages.receipt_to_start_avg_days },
      { name: '시작→완료',     avg: leadStages.start_to_complete_avg_days },
      { name: '완료→출하',     avg: leadStages.complete_to_ship_avg_days },
    ];
  }, [leadStages]);

  const stepChartData = useMemo(() => {
    if (!steps) return [] as Array<{ name: string; avg: number }>;
    return [...steps.steps]
      .sort((a,b) => b.avg_hours - a.avg_hours)
      .slice(0, 10)
      .map(s => ({ name: s.step || 'UNKNOWN', avg: Number(s.avg_hours) }));
  }, [steps]);

  const defectCatData = useMemo(() => {
    if (!defects) return [] as Array<{ name: string; count: number }>;
    return defects.by_category.slice(0, 10).map(d => ({ name: d.key, count: d.count }));
  }, [defects]);

  const flowChartData = useMemo(() => {
    if (!flows) return [] as MonthFlowItem[];
    return [...flows.months].sort((a,b) => a.month.localeCompare(b.month));
  }, [flows]);

  return (
    <div className="min-h-[calc(100vh-80px)] w-full bg-gradient-to-b from-gray-50 to-white">
      {/* 헤더 */}
      <div className="mx-auto max-w-[1600px] px-6 pt-6 pb-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log Charts</h1>
            <p className="mt-1 text-sm text-gray-500">리드/사이클타임 · Step 공수 · 불량 · 입/출하 추이</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">From</label>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
                     className="h-10 rounded-lg border border-gray-300 px-3 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">To</label>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
                     className="h-10 rounded-lg border border-gray-300 px-3 text-sm" />
            </div>
            <button onClick={loadData} className="h-10 rounded-lg bg-gray-900 text-white px-4 text-sm hover:bg-gray-800 disabled:opacity-50" disabled={loading}>
              {loading ? '불러오는 중…' : '데이터 불러오기'}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-[1600px] px-6 pb-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-7">
          {/* 1) 리드 스테이지 평균 */}
          <SectionCard
            title="리드타임 · 사이클타임"
            desc="사내입고 → 생산시작 → 생산완료(진척 100%) → 출하"
            right={<button className="h-10 rounded-lg border px-3 text-sm hover:bg-gray-50">CSV 내보내기</button>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KPI label="입고→생산시작 평균" value={fmtDays(leadStages?.receipt_to_start_avg_days)} />
              <KPI label="생산시작→완료 평균" value={fmtDays(leadStages?.start_to_complete_avg_days)} />
              <KPI label="완료→출하 평균" value={fmtDays(leadStages?.complete_to_ship_avg_days)} />
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={leadStageChart} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="avg" name="평균(일)">
                    {leadStageChart.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="avg" position="top" formatter={(v) => `${Number(v).toFixed(2)}d`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              ※ 기준: (1) 입고→가장 빠른 생산로그, (2) 생산로그 시작→진척 100% 최초, (3) 완료→출하
            </p>
          </SectionCard>

          {/* 2) Step 공수 (전체 폭 + 표) */}
          <div className="xl:col-span-2">
            <SectionCard
              title="Step별 작업 공수 (Rowdata)"
              desc="총 시간 및 각 Step 통계"
              right={<button className="h-10 rounded-lg border px-3 text-sm hover:bg-gray-50">엑셀 다운</button>}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPI className="min-w-[180px] md:min-w-[200px]" label="총 시간" value={fmtHours(steps?.total_hours)} />
                <KPI className="min-w-[180px] md:min-w-[200px]" label="Step 평균"
                     value={fmtHours(steps && steps.steps.length ? steps.steps.reduce((a, s)=>a+s.avg_hours,0)/steps.steps.length : undefined)} />
                <KPI className="min-w-[180px] md:min-w-[200px]" label="Step 최대"
                     value={fmtHours(steps && steps.steps.length ? Math.max(...steps.steps.map(s=>s.max_hours)) : undefined)} />
                <KPI className="min-w-[180px] md:min-w-[200px]" label="Step 최소"
                     value={fmtHours(steps && steps.steps.length ? Math.min(...steps.steps.map(s=>s.min_hours)) : undefined)} />
              </div>

              <div className="mt-5">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={stepChartData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={110} />
                    <Tooltip />
                    <Bar dataKey="avg" name="평균(h)">
                      {stepChartData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                      <LabelList dataKey="avg" position="right" formatter={(v) => `${Number(v).toFixed(2)}h`} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-5">
                {steps && steps.steps.length > 0 ? <StepTable items={steps.steps} /> : <MiniTableSkeleton />}
              </div>
              <p className="mt-2 text-xs text-gray-400">※ 사용 테이블: setup_sheet_all</p>
            </SectionCard>
          </div>

          {/* 3) 불량 현황 */}
          <SectionCard
            title="불량 현황"
            desc="대당 건수 · T.S 소요시간 · 입고 품질 점수 & 분류"
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <KPI label="대당 불량 건수(평균)" value={fmtCount(defects?.per_unit_avg)} />
              <KPI label="대당 불량 건수(최대)" value={fmtCount(defects?.per_unit_max)} />
              <KPI label="대당 불량 건수(최소)" value={fmtCount(defects?.per_unit_min)} />
              <KPI label="T.S 대당 시간(평균)" value={fmtHours(defects?.ts_time_per_unit_avg_hours)} />
              <KPI label="입고 품질 점수(평균)" value={fmtCount(defects?.incoming_quality_avg ?? undefined)} />
              <KPI label="입고 품질 점수(최대)" value={fmtCount(defects?.incoming_quality_max ?? undefined)} />
            </div>
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-3 gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={defectCatData} margin={{ bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={60} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="건수">
                    {defectCatData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                    <LabelList dataKey="count" position="top" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="rounded-xl border border-gray-200 p-3 bg-gray-50 flex items-center justify-center text-gray-400">
                <span className="text-sm">TS 소요시간 분포 (추가 예정)</span>
              </div>
              <div className="rounded-xl border border-gray-200 p-3 bg-gray-50">
                <div className="text-sm font-medium text-gray-700">Top 이슈 태그</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {['Bolt_Nut', 'Cover', 'Cable', 'Stage', 'Loader'].map((t) => (
                    <span key={t} className="text-xs px-2 py-1 rounded-full bg-white border text-gray-600">#{t}</span>
                  ))}
                </div>
                <div className="mt-3 text-xs text-gray-400">※ 사용 테이블: troubleshoot_entry</div>
              </div>
            </div>
          </SectionCard>

          {/* 4) 월별 입고/출하 */}
          <SectionCard
            title="월별 입고 · 출하 수"
            desc="선택 월 범위 내 입/출하 & 회전율"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="총 입고" value={fmtCount(flows?.total_receipts)} />
              <KPI label="총 출하" value={fmtCount(flows?.total_shipments)} />
              <KPI label="평균 월 회전율" value={fmtRate(flows?.avg_turnover_rate ?? undefined)} />
              <KPI label="최대 월 회전율" value={fmtRate(flows?.max_turnover_rate ?? undefined)} />
              <KPI label="최소 월 회전율" value={fmtRate(flows?.min_turnover_rate ?? undefined)} />
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={flowChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="receipts" name="입고" fill="#60a5fa" />
                  <Bar yAxisId="left" dataKey="shipments" name="출하" fill="#34d399" />
                  <Line yAxisId="right" dataKey="turnover_rate" name="회전율(%)" stroke="#f43f5e" dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-gray-400">※ 사용 테이블: equipment_receipt_log, equipment_shipment_log</p>
          </SectionCard>
        </div>

        {/* 푸터 */}
        <div className="mt-8 flex flex-wrap items-center gap-2 justify-end">
          <button onClick={()=>{ setStartMonth(`${y}-${m}`); setEndMonth(`${y}-${m}`); }}
                  className="h-10 rounded-lg border px-3 text-sm hover:bg-gray-50">필터 초기화</button>
          <button onClick={loadData} className="h-10 rounded-lg bg-gray-900 text-white px-4 text-sm hover:bg-gray-800 disabled:opacity-50" disabled={loading}>
            {loading ? '불러오는 중…' : '데이터 불러오기'}
          </button>
        </div>
      </div>
    </div>
  );
}
