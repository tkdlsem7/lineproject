// src/SetupDefectEntryPage/SetupDefectEntryPage.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

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

// 안전한 API_BASE 계산 (문자열만 허용)
const API_BASE = (() => {
  const v1 =
    typeof import.meta !== "undefined" &&
    (import.meta as any)?.env &&
    typeof (import.meta as any).env.VITE_API_BASE === "string"
      ? ((import.meta as any).env.VITE_API_BASE as string)
      : undefined;
  const v2 =
    typeof process !== "undefined" &&
    (process as any)?.env &&
    typeof (process as any).env.REACT_APP_API_BASE === "string"
      ? ((process as any).env.REACT_APP_API_BASE as string)
      : undefined;
  const raw = v1 ?? v2 ?? "/api";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
})();

// 공통정보
type MetaState = {
  model_name: string;
  carNo: string;
  machineNo: string;
  sn: string;
  chillerSn: string;
  setupStart: string; // YYYY-MM-DD
  setupEnd: string;   // YYYY-MM-DD
};

// 스텝 입력 한 행
type StepRow = {
  setupHours: string;   // 시간
  defectDetail: string; // 세부불량(멀티라인)
  qualityScore: string; // 자동 계산
  tsMinutes: string;    // T.S 소요(분)
};

// T.S(분) → 품질점수
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

export default function SetupDefectEntryPage() {
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<StepType>("Loader");
  const [sheetId, setSheetId] = useState<number | null>(null);

  // 상단 공통
  const [meta, setMeta] = useState<MetaState>({
    model_name: "",
    carNo: "",
    machineNo: "",
    sn: "",
    chillerSn: "",
    setupStart: "",
    setupEnd: "",
  });

  // 하단 스텝 행들
  const emptyRow: StepRow = { setupHours: "", defectDetail: "", qualityScore: "", tsMinutes: "" };
  const [rows, setRows] = useState<StepRow[]>([emptyRow]);

  // ─ UI helpers (대시보드 톤)
  const pageWrap = "min-h-screen bg-slate-50";
  const card = "rounded-2xl bg-white border border-slate-200 shadow-sm";
  const sectionTitle = "px-6 py-4 border-b border-slate-200 text-[15px] text-slate-700";
  const pill =
    "px-3 py-1.5 rounded-full text-sm border transition-colors";
  const hdr =
    "bg-amber-50/70 border-b border-slate-200 px-4 py-3 text-[15px] font-semibold text-slate-700";
  const cell = "border-b border-slate-200";
  const input =
    "w-full h-full px-4 py-3 text-[15px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-lg";

  // 탭 변경 → 행 초기화(공통은 유지)
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

  // 여러 행 연속 저장(같은 sheetId로 묶음)
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
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i];
        const payload = {
          sheetId: sid ?? null,
          meta: {
            model_name: meta.model_name || null,
            car_no: meta.carNo || null,
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
            // DB 컬럼명은 ts_hours지만 현재 '분' 값을 저장 중(네이밍은 나중에 마이그레이션 권장)
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
    }
  };

  return (
    <div className={pageWrap}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* 상단 Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              ← 뒤로
            </button>
            <h1 className="text-[22px] font-semibold text-slate-800">세팅·불량 입력</h1>
          </div>
          {sheetId && (
            <span className="text-sm text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
              sheetId: {sheetId}
            </span>
          )}
        </div>

        {/* 스텝 탭 (대시보드 톤의 필 버튼) */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STEPS.map((s) => {
            const active = s === currentStep;
            return (
              <button
                key={s}
                type="button"
                onClick={() => changeStep(s)}
                className={
                  pill +
                  " " +
                  (active
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-50")
                }
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* 공통 정보 카드 */}
        <div className={card + " mb-6"}>
          <div className={sectionTitle}>공통 정보</div>
          <div className="w-full overflow-x-auto">
            <div className="min-w-[1100px]">
              <div className="grid grid-cols-[140px_140px_140px_180px_180px_200px_200px]">
                <div className={hdr}>모델</div>
                <div className={hdr}>차호</div>
                <div className={hdr}>호기</div>
                <div className={hdr}>S/N</div>
                <div className={hdr}>Chiller S/N</div>
                <div className={hdr}>세팅시작일</div>
                <div className={hdr}>세팅종료일</div>
              </div>
              <div className="grid grid-cols-[140px_140px_140px_180px_180px_200px_200px]">
                <div className={cell + " p-2"}>
                  <input className={input} value={meta.model_name} onChange={(e) => onMeta("model_name", e.target.value)} placeholder="예: T5825" />
                </div>
                <div className={cell + " p-2"}>
                  <input className={input} value={meta.carNo} onChange={(e) => onMeta("carNo", e.target.value)} placeholder="예: 12" />
                </div>
                <div className={cell + " p-2"}>
                  <input className={input} value={meta.machineNo} onChange={(e) => onMeta("machineNo", e.target.value)} placeholder="예: A01" />
                </div>
                <div className={cell + " p-2"}>
                  <input className={input} value={meta.sn} onChange={(e) => onMeta("sn", e.target.value)} placeholder="예: SN-0001" />
                </div>
                <div className={cell + " p-2"}>
                  <input className={input} value={meta.chillerSn} onChange={(e) => onMeta("chillerSn", e.target.value)} placeholder="예: CH-0001" />
                </div>
                <div className={cell + " p-2"}>
                  <input type="date" className={input} value={meta.setupStart} onChange={(e) => onMeta("setupStart", e.target.value)} />
                </div>
                <div className="border-b border-slate-200 p-2">
                  <input type="date" className={input} value={meta.setupEnd} onChange={(e) => onMeta("setupEnd", e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 스텝 입력 카드 */}
        <div className={card}>
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[15px] text-slate-700">
              {currentStep} 스텝 입력 폼 <span className="text-slate-400">(여러 건 입력 가능)</span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setRows([emptyRow])}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                초기화
              </button>
              <button
                type="button"
                onClick={addRow}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
              >
                행 추가
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <div className="min-w-[1200px]">
              {/* 헤더 */}
              <div className="grid grid-cols-[130px_180px_1.6fr_160px_160px_120px]">
                <div className={hdr}>step</div>
                <div className={hdr}>세팅소요시간(시간)</div>
                <div className={hdr}>세부 불량(멀티라인)</div>
                <div className={hdr + " text-center"}>품질점수(자동)</div>
                <div className={hdr + " text-center"}>T.S 소요(분)</div>
                <div className={hdr + " text-center"}>관리</div>
              </div>

              {/* 행들 */}
              {rows.map((r, idx) => (
                <div key={idx} className="grid grid-cols-[130px_180px_1.6fr_160px_160px_120px]">
                  <div className={cell + " p-2"}>
                    <input readOnly value={currentStep} className="w-full h-full px-4 py-3 text-[15px] bg-slate-50 rounded-lg" />
                  </div>

                  <div className={cell + " p-2"}>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      className={input}
                      value={r.setupHours}
                      onChange={(e) => updateRow(idx, "setupHours", e.target.value)}
                      placeholder="예: 1.5"
                    />
                  </div>

                  <div className={cell + " p-2"}>
                    <textarea
                      className={input + " min-h-[110px] resize-y leading-6"}
                      rows={4}
                      value={r.defectDetail}
                      onChange={(e) => updateRow(idx, "defectDetail", e.target.value)}
                      placeholder="예: 케이블 접촉 불량 / 커넥터 재체결 ..."
                    />
                  </div>

                  <div className={cell + " p-2"}>
                    <input
                      readOnly
                      className="w-full h-full px-4 py-3 text-[15px] bg-slate-50 text-center rounded-lg"
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
                      className="w-full h-full px-4 py-3 text-[15px] text-center bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 rounded-lg"
                      value={r.tsMinutes}
                      onChange={(e) => updateRow(idx, "tsMinutes", e.target.value)}
                      placeholder="예: 30"
                    />
                  </div>

                  <div className="border-b border-slate-200 flex items-center justify-center p-2">
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
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

          <div className="px-6 py-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              뒤로가기
            </button>
            <button
              type="button"
              onClick={addRow}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50"
            >
              행 추가
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
