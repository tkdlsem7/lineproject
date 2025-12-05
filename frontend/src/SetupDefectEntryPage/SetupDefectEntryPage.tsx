// src/SetupDefectEntryPage/SetupDefectEntryPage.tsx
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/** 스텝 옵션 */
const STEPS = [
  "Common",
  "Stage",
  "Loader",
  "STAGE(Advanced)",
  "Cold Test",
  "Option&ETC",
  "개조",
  "HW",
  "Packing&Delivery",
] as const;
type StepType = (typeof STEPS)[number];

/** 안전한 API_BASE */
const API_BASE = "http://192.168.101.1:8000/api";

/** ---------- 타입 ---------- */
type MetaState = {
  machineNo: string;   // machine_no
  sn: string;          // sn
  chillerSn: string;   // chiller_sn
  setupStart: string;  // setup_start_date
  setupEnd: string;    // setup_end_date
};

type StepRow = {
  setupHours: string;
  defectDetail: string;
  qualityScore: string;
  tsMinutes: string;   // DB ts_hours 컬럼(분 저장)
};

type RowRead = {
  id: number;
  sheet_id: number;
  step_name: StepType;
  machine_no: string | null;
  sn: string | null;
  chiller_sn: string | null;
  setup_start_date: string | null;
  setup_end_date: string | null;
  setup_hours: number | null;
  defect_detail: string | null;
  quality_score: number | null;
  ts_hours: number | null;
  created_at: string;
};

type UIRow = {
  id: number;
  sheetId: number;
  stepName: StepType;
  setupHours: string;
  defectDetail: string;
  qualityScore: string;
  tsMinutes: string;
  createdAt: string;
};

/** ---------- 유틸 ---------- */
function scoreFromMinutes(mins: number | null): number | null {
  if (mins === null || isNaN(mins) || mins < 0) return null;
  if (mins < 10) return 1;
  if (mins < 30) return 2;
  if (mins < 60) return 5;
  if (mins < 120) return 10;
  if (mins < 240) return 20;
  if (mins < 600) return 40;
  return 60;
}

/** ---------- 스타일 토큰 ---------- */
const pageWrap = "min-h-screen bg-slate-50";
const card = "rounded-2xl bg-white border border-slate-200 shadow-sm";
const sectionTitle = "px-6 py-4 border-b border-slate-200 text-[15px] text-slate-700";
const cell = "border-b border-slate-200";

/** ---------- 컴포넌트 ---------- */
export default function SetupDefectEntryPage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<StepType>("Loader");
  const [sheetId, setSheetId] = useState<number | null>(null);

  // 공통 정보
  const [meta, setMeta] = useState<MetaState>({
    machineNo: "",
    sn: "",
    chillerSn: "",
    setupStart: "",
    setupEnd: "",
  });

  // 새 입력 폼
  const emptyRow: StepRow = { setupHours: "", defectDetail: "", qualityScore: "", tsMinutes: "" };
  const [rows, setRows] = useState<StepRow[]>([emptyRow]);

  // 조회/결과 상태
  const [qSheetId, setQSheetId] = useState<string>("");
  const [qMachineNo, setQMachineNo] = useState<string>("");
  const [qStep, setQStep] = useState<"" | StepType>("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UIRow[]>([]);

  // 인라인 수정 상태
  const [editId, setEditId] = useState<number | null>(null);
  const [editRow, setEditRow] = useState<UIRow | null>(null);

  /** 액션 */
  const changeStep = (s: StepType) => {
    setCurrentStep(s);
    setRows([emptyRow]);
  };
  const onMeta = (k: keyof MetaState, v: string) => setMeta((p) => ({ ...p, [k]: v }));

  const updateRow = (idx: number, key: keyof StepRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [key]: value };
      if (key === "tsMinutes") {
        const score = scoreFromMinutes(value.trim() === "" ? null : parseFloat(value));
        row.qualityScore = score == null ? "" : String(score);
      }
      next[idx] = row;
      return next;
    });
  };
  const addRow = () => setRows((p) => [...p, { ...emptyRow }]);
  const removeRow = (idx: number) =>
    setRows((p) => (p.length === 1 ? p : p.filter((_, i) => i !== idx)));
  const handleBack = () => navigate(-1);

  /** 저장(여러 행) */
  const handleSave = async () => {
    const valid = rows.filter(
      (r) => r.setupHours || r.defectDetail || r.tsMinutes || r.qualityScore
    );
    if (valid.length === 0) {
      alert("저장할 행이 없습니다.");
      return;
    }
    try {
      let sid = sheetId;
      setLoading(true);
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i];
        const payload = {
          sheetId: sid ?? null,
          meta: {
            machine_no: meta.machineNo || null,
            sn: meta.sn || null,
            chiller_sn: meta.chillerSn || null,
            setup_start_date: meta.setupStart || null,
            setup_end_date: meta.setupEnd || null,
          },
          step: {
            step_name: currentStep,
            setup_hours: r.setupHours === "" ? null : parseFloat(r.setupHours),
            defect_detail: r.defectDetail === "" ? null : r.defectDetail,
            quality_score: r.qualityScore === "" ? null : parseInt(r.qualityScore, 10),
            ts_hours: r.tsMinutes === "" ? null : parseFloat(r.tsMinutes),
          },
        };
        const res = await axios.post(`${API_BASE}/setup-sheets/save`, payload);
        sid = res.data.sheetId;
        if (i === 0) setSheetId(sid);
      }
      alert(`총 ${valid.length}건 저장되었습니다. (sheetId=${sid})`);
    } catch (e) {
      console.error(e);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /** 조회 */
  const handleSearch = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (qSheetId.trim()) params.sheet_id = qSheetId.trim();
      if (qMachineNo.trim()) params.machine_no = qMachineNo.trim();
      if (qStep) params.step_name = qStep;

      const res = await axios.get<RowRead[]>(`${API_BASE}/setup-sheets/search`, { params });
      const rows = (res.data ?? []).map<UIRow>((r) => ({
        id: r.id,
        sheetId: r.sheet_id,
        stepName: r.step_name,
        setupHours: r.setup_hours == null ? "" : String(r.setup_hours),
        defectDetail: r.defect_detail ?? "",
        qualityScore: r.quality_score == null ? "" : String(r.quality_score),
        tsMinutes: r.ts_hours == null ? "" : String(r.ts_hours),
        createdAt: r.created_at,
      }));
      setResult(rows);

      // 공통정보 프리필(첫 행 기준)
      if (res.data.length > 0) {
        const h = res.data[0];
        setMeta({
          machineNo: h.machine_no ?? "",
          sn: h.sn ?? "",
          chillerSn: h.chiller_sn ?? "",
          setupStart: h.setup_start_date ?? "",
          setupEnd: h.setup_end_date ?? "",
        });
        setSheetId(h.sheet_id);
      }
    } catch (e) {
      console.error(e);
      alert("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /** 인라인 수정/삭제 */
  const startEdit = (row: UIRow) => {
    setEditId(row.id);
    setEditRow({ ...row });
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditRow(null);
  };
  const saveEdit = async () => {
    if (editId == null || !editRow) return;
    try {
      setLoading(true);
      const payload = {
        sheetId: editRow.sheetId,
        meta: {
          machine_no: meta.machineNo || null,
          sn: meta.sn || null,
          chiller_sn: meta.chillerSn || null,
          setup_start_date: meta.setupStart || null,
          setup_end_date: meta.setupEnd || null,
        },
        step: {
          id: editRow.id, // UPDATE
          step_name: editRow.stepName,
          setup_hours: editRow.setupHours === "" ? null : parseFloat(editRow.setupHours),
          defect_detail: editRow.defectDetail === "" ? null : editRow.defectDetail,
          quality_score: editRow.qualityScore === "" ? null : parseInt(editRow.qualityScore, 10),
          ts_hours: editRow.tsMinutes === "" ? null : parseFloat(editRow.tsMinutes),
        },
      };
      await axios.post(`${API_BASE}/setup-sheets/save`, payload);
      setResult((prev) => prev.map((r) => (r.id === editRow.id ? { ...editRow } : r)));
      cancelEdit();
      alert("수정되었습니다.");
    } catch (e) {
      console.error(e);
      alert("수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };
  const handleDelete = async (row: UIRow) => {
    if (!window.confirm(`행 #${row.id} 을(를) 삭제할까요?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/setup-sheets/${row.id}`);
      setResult((prev) => prev.filter((r) => r.id !== row.id));
      alert("삭제되었습니다.");
    } catch (e) {
      console.error(e);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /** ---------- UI ---------- */
  return (
    <div className={pageWrap}>
      <div className="mx-auto max-w-[1600px] px-8 py-6">
        {/* 2열: 사이드바 + 본문 (세로높이 동기화) */}
        <div className="grid grid-cols-[240px_1fr] items-stretch gap-6">
          {/* 좌측 사이드바: Step 선택 (화이트 + 블랙) */}
          <aside className="h-full rounded-2xl bg-white border border-slate-200 p-4 text-slate-900 shadow-sm">
            <div className="mb-3 text-sm font-semibold tracking-wide text-slate-800">
              Step 선택
            </div>
            <nav className="space-y-1">
              {STEPS.map((s) => {
                const active = s === currentStep;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => changeStep(s)}
                    className={`w-full rounded-lg px-4 py-2 text-left transition ${
                      active
                        ? "bg-slate-400 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </nav>
            
          </aside>

          {/* 본문 */}
          <main className="flex h-full flex-col gap-6">
            {/* 상단 바 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 hover:bg-slate-50"
                >
                  ← 뒤로가기
                </button>
                <h1 className="text-[22px] font-semibold text-slate-800">세팅·불량 입력</h1>
              </div>
              {sheetId && (
                <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-500">
                  sheetId: {sheetId}
                </span>
              )}
            </div>

            {/* 공통 정보 카드 — 블루 헤더 셀 */}
            <section className={card}>
              <div className={sectionTitle}>공통 정보</div>
              <div className="w-full overflow-x-auto">
                <div className="min-w-[900px]">
                  <div className="grid grid-cols-[200px_200px_200px_200px_200px]">
                    {["장비번호", "S/N", "Chiller S/N", "세팅시작일", "세팅종료일"].map((h) => (
                      <div
                        key={h}
                        className="border-b border-slate-200 bg-sky-200/70 px-4 py-3 text-[15px] font-semibold text-slate-700"
                      >
                        {h}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[200px_200px_200px_200px_200px]">
                    <div className={cell + " p-2"}>
                      <input
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={meta.machineNo}
                        onChange={(e) => onMeta("machineNo", e.target.value)}
                        placeholder="예: j-11-10"
                      />
                    </div>
                    <div className={cell + " p-2"}>
                      <input
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={meta.sn}
                        onChange={(e) => onMeta("sn", e.target.value)}
                        placeholder="예: SN-0001"
                      />
                    </div>
                    <div className={cell + " p-2"}>
                      <input
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={meta.chillerSn}
                        onChange={(e) => onMeta("chillerSn", e.target.value)}
                        placeholder="예: CH-0001"
                      />
                    </div>
                    <div className={cell + " p-2"}>
                      <input
                        type="date"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={meta.setupStart}
                        onChange={(e) => onMeta("setupStart", e.target.value)}
                      />
                    </div>
                    <div className="border-b border-slate-200 p-2">
                      <input
                        type="date"
                        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                        value={meta.setupEnd}
                        onChange={(e) => onMeta("setupEnd", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 스텝 입력 폼 */}
            <section className="rounded-2xl border border-sky-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-sky-200 px-6 py-3">
                <div className="text-[15px] font-semibold text-slate-800">
                  {currentStep} 스텝 입력 폼{" "}
                  <span className="font-normal text-slate-500">(여러 건 입력 가능)</span>
                </div>
                <div className="flex gap-2">
                  {/* ▶ 주황색 버튼 통일 */}
                  <button
                    type="button"
                    onClick={() => setRows([emptyRow])}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    초기화
                  </button>
                  <button
                    type="button"
                    onClick={addRow}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    행 추가
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="rounded-lg bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                    disabled={loading}
                  >
                    저장
                  </button>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <div className="min-w-[1200px]">
                  {/* 헤더(하늘색) */}
                  <div className="grid grid-cols-[130px_180px_1.6fr_160px_160px_120px]">
                    {[
                      "step",
                      "세팅소요시간(시간)",
                      "세부 불량(멀티라인)",
                      "품질점수(자동)",
                      "T.S 소요(분)",
                      "관리",
                    ].map((h, i) => (
                      <div
                        key={i}
                        className="border-b border-sky-200 bg-sky-100 px-4 py-3 text-center text-[15px] font-semibold text-slate-700 first:text-left"
                      >
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* 행들 */}
                  {rows.map((r, idx) => (
                    <div key={idx} className="grid grid-cols-[130px_180px_1.6fr_160px_160px_120px]">
                      <div className={cell + " p-2"}>
                        <input
                          readOnly
                          value={currentStep}
                          className="h-11 w-full rounded-lg bg-slate-50 px-4 text-[15px]"
                        />
                      </div>
                      <div className={cell + " p-2"}>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                          value={r.setupHours}
                          onChange={(e) => updateRow(idx, "setupHours", e.target.value)}
                          placeholder="예: 1.5"
                        />
                      </div>
                      <div className={cell + " p-2"}>
                        <textarea
                          className="min-h-[110px] w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] leading-6 focus:outline-none focus:ring-2 focus:ring-sky-200"
                          rows={4}
                          value={r.defectDetail}
                          onChange={(e) => updateRow(idx, "defectDetail", e.target.value)}
                          placeholder="예: 케이블 접촉 불량 / 커넥터 재체결 ..."
                        />
                      </div>
                      <div className={cell + " p-2"}>
                        <input
                          readOnly
                          className="h-11 w-full rounded-lg bg-slate-50 px-4 text-center text-[15px]"
                          value={r.qualityScore}
                          placeholder="자동"
                          title="T.S 소요(분)에 따라 자동 계산"
                        />
                      </div>
                      <div className={cell + " p-2"}>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-center text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                          value={r.tsMinutes}
                          onChange={(e) => updateRow(idx, "tsMinutes", e.target.value)}
                          placeholder="예: 30"
                        />
                      </div>
                      <div className="flex items-center justify-center border-b border-slate-200 p-2">
                        {/* 삭제도 주황 톤의 아웃라인 버튼 */}
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                          disabled={rows.length === 1}
                          title={rows.length === 1 ? "마지막 행은 삭제 불가" : "이 행 삭제"}
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}

                  <div className="px-6 py-3 text-sm text-slate-500">
                    점수표: &lt;10분=1, 10~&lt;30=2, 30~&lt;60=5, 60~&lt;120=10, 120~&lt;240=20,
                    240~&lt;600=40, 600분 이상=60
                  </div>
                </div>
              </div>
            </section>

            {/* 데이터 조회 카드 */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className={sectionTitle}>데이터 조회</div>
              <div className="p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-slate-700">sheet_id</label>
                    <input
                      value={qSheetId}
                      onChange={(e) => setQSheetId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                      placeholder="예: 1001"
                      inputMode="numeric"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs font-medium text-slate-700">machine_no</label>
                    <input
                      value={qMachineNo}
                      onChange={(e) => setQMachineNo(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                      placeholder="예: j-11-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700">step</label>
                    <select
                      value={qStep}
                      onChange={(e) => setQStep(e.target.value as typeof qStep)}
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                    >
                      <option value="">전체</option>
                      {STEPS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setQSheetId("");
                      setQMachineNo("");
                      setQStep("");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    초기화
                  </button>
                  {/* ▶ 조회도 주황색 */}
                  <button
                    type="button"
                    onClick={handleSearch}
                    disabled={loading}
                    className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {loading ? "조회 중…" : "조회"}
                  </button>
                </div>
              </div>
            </section>

            {/* 조회 결과 테이블 */}
            <section className={card}>
              <div className={sectionTitle}>조회 결과</div>
              <div className="w-full overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2">ID</th>
                      <th className="px-3 py-2">sheet_id</th>
                      <th className="px-3 py-2">step</th>
                      <th className="px-3 py-2">setup_hours</th>
                      <th className="px-3 py-2">defect_detail</th>
                      <th className="px-3 py-2">quality_score</th>
                      <th className="px-3 py-2">TS(분)</th>
                      <th className="px-3 py-2">생성일</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-slate-500" colSpan={9}>
                          조회 결과가 없습니다. 조건을 입력하고 ‘조회’를 눌러주세요.
                        </td>
                      </tr>
                    ) : (
                      result.map((r) => {
                        const isEdit = editId === r.id;
                        return (
                          <tr key={r.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{r.id}</td>
                            <td className="px-3 py-2">{r.sheetId}</td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                r.stepName
                              ) : (
                                <select
                                  value={editRow?.stepName ?? r.stepName}
                                  onChange={(e) =>
                                    setEditRow((prev) =>
                                      prev ? { ...prev, stepName: e.target.value as StepType } : prev
                                    )
                                  }
                                  className="rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                >
                                  {STEPS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                r.setupHours
                              ) : (
                                <input
                                  value={editRow?.setupHours ?? r.setupHours}
                                  onChange={(e) =>
                                    setEditRow((p) => (p ? { ...p, setupHours: e.target.value } : p))
                                  }
                                  className="w-28 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                r.defectDetail
                              ) : (
                                <input
                                  value={editRow?.defectDetail ?? r.defectDetail}
                                  onChange={(e) =>
                                    setEditRow((p) => (p ? { ...p, defectDetail: e.target.value } : p))
                                  }
                                  className="w-[360px] rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                r.qualityScore
                              ) : (
                                <input
                                  value={editRow?.qualityScore ?? r.qualityScore}
                                  onChange={(e) =>
                                    setEditRow((p) => (p ? { ...p, qualityScore: e.target.value } : p))
                                  }
                                  className="w-24 rounded border border-slate-300 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-sky-200"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                r.tsMinutes
                              ) : (
                                <input
                                  value={editRow?.tsMinutes ?? r.tsMinutes}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setEditRow((p) => {
                                      if (!p) return p;
                                      const score =
                                        val.trim() === ""
                                          ? ""
                                          : String(scoreFromMinutes(parseFloat(val)) ?? "");
                                      return { ...p, tsMinutes: val, qualityScore: score };
                                    });
                                  }}
                                  className="w-24 rounded border border-slate-300 px-2 py-1 text-right focus:outline-none focus:ring-2 focus:ring-sky-200"
                                />
                              )}
                            </td>
                            <td className="px-3 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                            <td className="px-3 py-2">
                              {!isEdit ? (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => startEdit(r)}
                                    className="rounded bg-orange-500 px-3 py-1 text-white hover:bg-orange-600"
                                  >
                                    수정
                                  </button>
                                  <button
                                    onClick={() => handleDelete(r)}
                                    className="rounded bg-orange-500 px-3 py-1 text-white hover:bg-orange-600"
                                  >
                                    삭제
                                  </button>
                                </div>
                              ) : (
                                <div className="flex gap-2">
                                  <button
                                    onClick={saveEdit}
                                    className="rounded bg-orange-500 px-3 py-1 text-white hover:bg-orange-600 disabled:opacity-60"
                                    disabled={loading}
                                  >
                                    저장
                                  </button>
                                  <button
                                    onClick={cancelEdit}
                                    className="rounded bg-gray-200 px-3 py-1 text-gray-800 hover:bg-gray-300"
                                  >
                                    취소
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
