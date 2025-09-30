// src/LogChart/LogChartPage.tsx
// ──────────────────────────────────────────────────────────────────────────────
// "디자인+기본 연동" 레이아웃 코드입니다.
// - 목표: 4개 영역(리드/사이클타임, Step 공수, 불량 현황, 입·출하 추이)
// - 이번 변경: KPI를 백엔드(/api/logcharts/*)와 연동해 수치 표시
// - 차트는 여전히 placeholder (다음 단계에서 Recharts 연결)
// ──────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import axios from 'axios';

// CRA/Vite 공용: 환경변수 → 없으면 '/api'
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

// ▼ 공통 유틸 컴포넌트들
function SectionCard({ title, desc, right, children }: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm p-5">
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

function KPI({ label, value = '—', sub }: { label: string; value?: string | number; sub?: string; }) {
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function ChartPlaceholder({ height = 220, label = 'Chart placeholder' }: { height?: number; label?: string; }) {
  return (
    <div
      className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400"
      style={{ height }}
    >
      <div className="animate-pulse select-none text-sm">{label}</div>
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

// ▼ 백엔드 응답 타입 (schemas.py 참고)
export type LeadCycleStats = {
  lead_avg_days: number; lead_min_days: number; lead_max_days: number;
  cycle_avg_days: number; cycle_min_days: number; cycle_max_days: number;
};

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

function fmtDays(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} d` : '—'; }
function fmtHours(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} h` : '—'; }
function fmtCount(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n}` : '—'; }
function fmtRate(n?: number | null) { return typeof n === 'number' && isFinite(n) ? `${n.toFixed(1)} %` : '—'; }

// ▼ 페이지
export default function LogChartPage() {
  // 필터: 월 범위 + 사이트/빌딩/라인 (디자인만)
  const today = useMemo(() => new Date(), []);
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');

  const [startMonth, setStartMonth] = useState(`${y}-${m}`);
  const [endMonth, setEndMonth] = useState(`${y}-${m}`);
  const [site, setSite] = useState('ALL');
  const [building, setBuilding] = useState('ALL');
  const [line, setLine] = useState('ALL');

  const [lead, setLead] = useState<LeadCycleStats | null>(null);
  const [steps, setSteps] = useState<StepStats | null>(null);
  const [defects, setDefects] = useState<DefectStats | null>(null);
  const [flows, setFlows] = useState<MonthlyFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    const params = { from_month: startMonth, to_month: endMonth, site, building, line };
    setLoading(true); setError(null);
    try {
      const [r1, r2, r3, r4] = await Promise.all([
        axios.get(`${API_BASE}/logcharts/leadcycle`, { params }),
        axios.get(`${API_BASE}/logcharts/steps`, { params }),
        axios.get(`${API_BASE}/logcharts/defects`, { params }),
        axios.get(`${API_BASE}/logcharts/flows`, { params }),
      ]);
      setLead(r1.data); setSteps(r2.data); setDefects(r3.data); setFlows(r4.data);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || '데이터 불러오기 실패');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-80px)] w-full bg-gradient-to-b from-gray-50 to-white">
      {/* 헤더 */}
      <div className="mx-auto max-w-7xl px-4 pt-6 pb-2">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Log Charts</h1>
            <p className="mt-1 text-sm text-gray-500">리드/사이클타임 · Step 공수 · 불량 · 입/출하 추이</p>
          </div>

          {/* 필터 바 */}
          <div className="grid grid-cols-1 md:grid-cols-6 gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">From</label>
              <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)}
                     className="h-9 rounded-lg border border-gray-300 px-3 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500 w-20">To</label>
              <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)}
                     className="h-9 rounded-lg border border-gray-300 px-3 text-sm" />
            </div>
            <select value={site} onChange={(e) => setSite(e.target.value)}
                    className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
              <option value="ALL">전체 Site</option>
              <option value="HQ">본사</option>
            </select>
            <select value={building} onChange={(e) => setBuilding(e.target.value)}
                    className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
              <option value="ALL">전체 동</option>
              <option value="A">A동</option>
              <option value="B">B동</option>
              <option value="I">I동</option>
            </select>
            <select value={line} onChange={(e) => setLine(e.target.value)}
                    className="h-9 rounded-lg border border-gray-300 px-3 text-sm">
              <option value="ALL">전체 라인</option>
              <option value="L1">L1</option>
              <option value="L2">L2</option>
            </select>
            <button onClick={loadData} className="h-9 rounded-lg bg-gray-900 text-white px-4 text-sm hover:bg-gray-800 disabled:opacity-50" disabled={loading}>
              {loading ? '불러오는 중…' : '데이터 불러오기'}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. 리드타임/사이클타임 */}
          <SectionCard
            title="리드타임 · 사이클타임"
            desc="사내입고 → 생산시작 → 생산완료 → 출하"
            right={<button className="h-9 rounded-lg border px-3 text-sm hover:bg-gray-50">CSV 내보내기</button>}
          >
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <KPI label="리드타임 평균" value={fmtDays(lead?.lead_avg_days)} />
              <KPI label="리드타임 최대" value={fmtDays(lead?.lead_max_days)} />
              <KPI label="리드타임 최소" value={fmtDays(lead?.lead_min_days)} />
              <KPI label="사이클타임 평균" value={fmtDays(lead?.cycle_avg_days)} />
              <KPI label="사이클타임 최대" value={fmtDays(lead?.cycle_max_days)} />
              <KPI label="사이클타임 최소" value={fmtDays(lead?.cycle_min_days)} />
            </div>
            <div className="mt-4">
              <ChartPlaceholder height={240} label="리드/사이클타임 분포(박스·바이올린·히스토그램 등)" />
            </div>
            <p className="mt-2 text-xs text-gray-400">※ 사용 테이블: equipment_progress_log, equip_progress, equipment_receipt_log</p>
          </SectionCard>

          {/* 2. Step별 작업 공수 */}
          <SectionCard
            title="Step별 작업 공수 (Rowdata)"
            desc="총 시간 및 각 Step 통계"
            right={<button className="h-9 rounded-lg border px-3 text-sm hover:bg-gray-50">엑셀 다운</button>}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KPI label="총 시간" value={fmtHours(steps?.total_hours)} />
                <KPI label="Step 평균" value={fmtHours(steps && steps.steps.length ? steps.steps.reduce((a, s)=>a+s.avg_hours,0)/steps.steps.length : undefined)} />
                <KPI label="Step 최대" value={fmtHours(steps && steps.steps.length ? Math.max(...steps.steps.map(s=>s.max_hours)) : undefined)} />
                <KPI label="Step 최소" value={fmtHours(steps && steps.steps.length ? Math.min(...steps.steps.map(s=>s.min_hours)) : undefined)} />
              </div>
              <div>
                <ChartPlaceholder height={160} label="Step별 막대 차트" />
              </div>
            </div>
            <div className="mt-4">
              <MiniTableSkeleton />
            </div>
            <p className="mt-2 text-xs text-gray-400">※ 사용 테이블: setup_sheet_all</p>
          </SectionCard>

          {/* 3. 불량 현황 */}
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
              <ChartPlaceholder height={220} label="불량 구분/위치/항목/유형 - 스택/트리맵" />
              <ChartPlaceholder height={220} label="TS 소요시간 분포" />
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

          {/* 4. 월별 입고/출하 */}
          <SectionCard
            title="월별 입고 · 출하 수"
            desc="선택 월 범위 내 입/출하 & 라인 회전율"
          >
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <KPI label="총 입고" value={fmtCount(flows?.total_receipts)} />
              <KPI label="총 출하" value={fmtCount(flows?.total_shipments)} />
              <KPI label="평균 월 회전율" value={fmtRate(flows?.avg_turnover_rate ?? undefined)} />
              <KPI label="최대 월 회전율" value={fmtRate(flows?.max_turnover_rate ?? undefined)} />
              <KPI label="최소 월 회전율" value={fmtRate(flows?.min_turnover_rate ?? undefined)} />
            </div>
            <div className="mt-4">
              <ChartPlaceholder height={240} label="월별 입고/출하(이중 막대) & 회전율(라인 그래프)" />
            </div>
            <p className="mt-2 text-xs text-gray-400">※ 사용 테이블: equipment_receipt_log, equipment_shipment_log</p>
          </SectionCard>
        </div>

        {/* 푸터 액션 */}
        <div className="mt-8 flex flex-wrap items-center gap-2 justify-end">
          <button onClick={()=>{ setStartMonth(`${y}-${m}`); setEndMonth(`${y}-${m}`); setSite('ALL'); setBuilding('ALL'); setLine('ALL'); }}
                  className="h-9 rounded-lg border px-3 text-sm hover:bg-gray-50">필터 초기화</button>
          <button onClick={loadData} className="h-9 rounded-lg bg-gray-900 text-white px-4 text-sm hover:bg-gray-800 disabled:opacity-50" disabled={loading}>
            {loading ? '불러오는 중…' : '데이터 불러오기'}
          </button>
        </div>
      </div>
    </div>
  );
}
