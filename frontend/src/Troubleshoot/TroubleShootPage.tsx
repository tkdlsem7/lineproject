// src/pages/TroubleShootPage.tsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/** API Base: Vite/CRA 환경변수 우선, 없으면 '/api' */
export const API_BASE = "http://192.168.101.1:8000/api";

type HwSw = 'H/W' | 'S/W';

/** ---------- 타입 ---------- */
type TSForm = {
  month: number;          // 내부적으로는 1~12 숫자 유지
  machineNo: string;
  hwSw: HwSw;
  step: string;
  defectCategory: string;
  location: string;
  defect: string;
  defectType: string;
  detail: string;
  photoRef?: string;
  tsMinutes?: number;
  reporter: string;
};

type TroubleShootCreate = {
  month: number;          // 서버에 1~12 숫자 전송
  machine_no: string;
  hw_sw: HwSw;
  step: string;
  defect_category: string;
  location: string;
  defect: string;
  defect_type: string;
  detail?: string;
  photo_ref?: string;
  ts_minutes?: number;
  reporter: string;
};

type TroubleShootRead = TroubleShootCreate & {
  id: number;
  created_at: string;
};

/** 테이블 표시용(프론트 카멜케이스) */
type TSRow = TSForm & {
  id?: number;
  created_at?: string;
};

/** 불량 → 불량유형 매핑 */
const DEFECT_TYPES_BY_DEFECT: Record<string, string[]> = {
  Bolt_Nut_Tab: ['체결불량', '파손', '오사용', '누락'],
  Cover: ['도장불량', '스크래치', '파손', '누락', '미조립불량'],
  Cable: ['단선', '반삽입', '탈삽입', '파손', '전장불량'],
  CableTie: ['커팅불량', '누락', '오사용'],
  'SpeedValve&Peeting': ['고정불량', '파트불량', '조립불량'],
  'I-Marking': ['누락', '작업불량'],
  'Air&Vac line': ['전장불량', '파손', '누락', '오배선', '꺾임'],
  Mount: ['파손', '체결불량', '오사용', '누락', '작업불량'],
  'Label&Sticker': ['누락', '오사용'],
  Setting: ['설정미스'],
  Sensor: ['파손'],
  Module: ['조립불량', '파트불량', '파손'],
  Chuck: ['파트불량', '파손'],
  Board: ['파트불량', '파손'],
  Camera: ['조명불량', '파트불량', '파손'],
  Chain: ['파트불량', '전장불량'],
  Driver: ['전원불량', '파트불량', '파손'],
  Terminal: ['누락', '조립불량'],
  'Axis Base': ['파트불량', '파손', '조립불량'],
  CC: ['파트불량', '파손', '누락'],
  'B/K & Dog': ['조립불량', '누락'],
  'Top Plate': ['도장불량', '기타'],
  Chiller: ['기타'],
  SMPS: ['전원불량', '파트불량', '파손'],
  ETC: ['기타'],
  Fan: ['파트불량'],
  CardHolder: ['스크래치', '오사용'],
  'Auto Tilt': ['조립불량', '파손'],
  'Belt Tensic': ['장력불량'],
  'Parameter axis base': ['도장불량'],
  FOUP: ['기타'],
};

const STEP_OPTIONS = [
  'Common',
  'Stage',
  'Loader',
  'STAGE(Advanced)',
  'Cold Test',
  'Option&ETC',
  '개조',
  'HW',
  'Packing&Delivery',
] as const;

/* ── 유틸 ─────────────────────────────────────────── */
// 1~12 범위 보정
const clampMonth = (m: number) => Math.max(1, Math.min(12, Number(m || 0)));

// YYYY-MM-DD 문자열로 변환 (input[type="date"] 용)
const toDateInput = (year: number, month: number, day = 1) => {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// date input 값에서 월(1~12)만 추출
const getMonthFromDateInput = (value: string): number => {
  const m = Number((value || '').split('-')[1]);
  return clampMonth(m);
};

// ISO 날짜에서 연도 추출(없으면 올해)
const getYearFromISO = (iso?: string) => {
  if (!iso) return new Date().getFullYear();
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
};

/* 공용 카드 래퍼 */
const Shell: React.FC<{
  children: React.ReactNode;
  header?: string;
  right?: React.ReactNode;
  className?: string;
}> = ({ children, header, right, className }) => (
  <section className={`rounded-2xl bg-white shadow-md ring-1 ring-gray-100 ${className ?? ''}`}>
    <div className="h-2 rounded-t-2xl bg-gradient-to-r from-sky-200 via-cyan-200 to-sky-200" />
    {(header || right) && (
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
        <h3 className="text-base font-semibold text-gray-800">{header}</h3>
        {right}
      </div>
    )}
    {children}
  </section>
);

const TroubleShootPage: React.FC<{ userName?: string }> = ({ userName }) => {
  const reporter = userName ?? localStorage.getItem('user_name') ?? '사용자';
  const navigate = useNavigate();

  // 폼 상태 (추가용)
  const [form, setForm] = useState<TSForm>({
    month: new Date().getMonth() + 1,
    machineNo: '',
    hwSw: 'H/W',
    step: 'Common',
    defectCategory: '단순 하드웨어',
    location: 'PC & Monitor',
    defect: '',
    defectType: '',
    detail: '',
    photoRef: '',
    tsMinutes: 1,
    reporter,
  });

  // 조회 조건: machine_no 단일
  const [qMachineNo, setQMachineNo] = useState<string>('');
  // 테이블/로딩
  const [rows, setRows] = useState<TSRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 인라인 수정 상태
  const [editId, setEditId] = useState<number | null>(null);
  const [edit, setEdit] = useState<TSForm | null>(null);

  const locationOptions = ['PC & Monitor', 'Loader', 'Stage', 'Chiller'];
  const categoryOptions = ['단순 하드웨어', '단순 소프트웨어'];
  const defectOptions = useMemo(() => Object.keys(DEFECT_TYPES_BY_DEFECT), []);
  const defectTypeOptions = useMemo(
    () => (form.defect ? DEFECT_TYPES_BY_DEFECT[form.defect] ?? [] : []),
    [form.defect]
  );
  const editDefectTypeOptions = useMemo(
    () => (edit?.defect ? DEFECT_TYPES_BY_DEFECT[edit.defect] ?? [] : []),
    [edit?.defect]
  );

  const authHeader = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // form → 서버 payload (snake_case)
  const toPayload = (f: TSForm): TroubleShootCreate => ({
    month: clampMonth(f.month),        // 숫자(1~12)
    machine_no: f.machineNo,
    hw_sw: f.hwSw,
    step: f.step,
    defect_category: f.defectCategory,
    location: f.location,
    defect: f.defect,
    defect_type: f.defectType,
    detail: f.detail || undefined,
    photo_ref: f.photoRef || undefined,
    ts_minutes: f.tsMinutes ?? 0,
    reporter: f.reporter,
  });

  // 서버 → 표시용(카멜)
  const fromServer = (r: TroubleShootRead): TSRow => ({
    month: clampMonth(Number(r.month)),
    machineNo: r.machine_no,
    hwSw: r.hw_sw,
    step: r.step,
    defectCategory: r.defect_category,
    location: r.location,
    defect: r.defect,
    defectType: r.defect_type,
    detail: r.detail ?? '',
    photoRef: r.photo_ref ?? '',
    tsMinutes: r.ts_minutes ?? 0,
    reporter: r.reporter,
    id: r.id,
    created_at: r.created_at,
  });

  // ▼ 입력 변경 (추가 폼)
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'defect') {
      const nextTypes = DEFECT_TYPES_BY_DEFECT[value] ?? [];
      setForm((prev) => ({ ...prev, defect: value, defectType: nextTypes[0] ?? '' }));
      return;
    }
    if (name === 'monthDate') {
      setForm((prev) => ({ ...prev, month: getMonthFromDateInput(value) }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'month' ? clampMonth(Number(value)) :
        name === 'tsMinutes' ? Number(value) :
        value,
    }));
  };

  // ▼ 입력 변경 (인라인 수정 폼)
  const handleEditChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    if (!edit) return;
    const { name, value } = e.target;

    if (name === 'defect') {
      const nextTypes = DEFECT_TYPES_BY_DEFECT[value] ?? [];
      setEdit({ ...edit, defect: value, defectType: nextTypes[0] ?? '' });
      return;
    }
    if (name === 'monthDate') {
      setEdit({ ...edit, month: getMonthFromDateInput(value) });
      return;
    }

    setEdit({
      ...edit,
      [name]:
        name === 'month' ? clampMonth(Number(value)) :
        name === 'tsMinutes' ? Number(value) :
        value,
    });
  };

  // 저장(POST)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.machineNo || !form.location || !form.defect || !form.defectType) {
      alert('장비번호, 불량 위치, 불량, 불량유형은 필수입니다.');
      return;
    }
    try {
      setLoading(true);
      const payload = toPayload(form);
      const res = await axios.post<TroubleShootRead>(
        `${API_BASE}/troubleshoot`,
        payload,
        { headers: { 'Content-Type': 'application/json', ...authHeader() } }
      );
      const saved = fromServer(res.data);
      setRows((prev) => [saved, ...prev]);
      // 일부 필드 리셋
      setForm((prev) => ({
        ...prev,
        defect: '',
        defectType: '',
        detail: '',
        photoRef: '',
        tsMinutes: 1,
      }));
      alert('저장되었습니다.');
    } catch (err) {
      console.error(err);
      alert('저장에 실패했습니다. (로그인/네트워크 확인)');
    } finally {
      setLoading(false);
    }
  };

  // 조회(GET): machine_no
  const handleSearch = async () => {
    try {
      setLoading(true);
      const res = await axios.get<TroubleShootRead[]>(
        `${API_BASE}/troubleshoot/search`,
        { params: { machine_no: qMachineNo.trim() }, headers: authHeader() }
      );
      setRows(res.data.map(fromServer));
    } catch (err) {
      console.error(err);
      alert('조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 수정 시작
  const startEdit = (r: TSRow) => {
    if (!r.id) return;
    setEditId(r.id);
    setEdit({
      month: r.month,
      machineNo: r.machineNo,
      hwSw: r.hwSw,
      step: r.step,
      defectCategory: r.defectCategory,
      location: r.location,
      defect: r.defect,
      defectType: r.defectType,
      detail: r.detail,
      photoRef: r.photoRef,
      tsMinutes: r.tsMinutes,
      reporter: r.reporter,
    });
  };

  // 수정 취소
  const cancelEdit = () => {
    setEditId(null);
    setEdit(null);
  };

  // 수정 저장(PUT)
  const saveEdit = async () => {
    if (!edit || editId == null) return;
    try {
      setLoading(true);
      const res = await axios.put<TroubleShootRead>(
        `${API_BASE}/troubleshoot/${editId}`,
        toPayload(edit),
        { headers: { 'Content-Type': 'application/json', ...authHeader() } }
      );
      const updated = fromServer(res.data);
      setRows((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      cancelEdit();
      alert('수정되었습니다.');
    } catch (err) {
      console.error(err);
      alert('수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 삭제(DELETE)
  const handleDelete = async (r: TSRow) => {
    if (!r.id) return;
    if (!window.confirm(`ID ${r.id} 항목을 삭제할까요?`)) return;
    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/troubleshoot/${r.id}`, { headers: authHeader() });
      setRows((prev) => prev.filter((x) => x.id !== r.id));
      alert('삭제되었습니다.');
    } catch (err) {
      console.error(err);
      alert('삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        {/* 상단 헤더 */}
        <Shell
          header="Trouble Shoot 입력"
          right={
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700">
                로그인:{' '}
                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-800">
                  {form.reporter}
                </span>
              </span>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="rounded-full bg-gray-200 px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                ← 뒤로가기
              </button>
            </div>
          }
        >
          <div className="px-5 pb-4 pt-2 text-sm text-gray-600">
            장비 불량∙수정 사항을 기록하고, 장비번호 기준으로 조회/수정/삭제할 수 있습니다.
          </div>
        </Shell>

        {/* 저장 폼 */}
        <Shell header="신규 등록">
          <form onSubmit={handleAdd} className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              {/* MONTH → 달력 입력으로 변경 */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">MONTH</label>
                <input
                  type="date"
                  name="monthDate"
                  value={toDateInput(new Date().getFullYear(), form.month, 1)}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  장비번호 (machine_no) <span className="text-rose-500">*</span>
                </label>
                <input
                  name="machineNo"
                  value={form.machineNo}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="예) STP-11-10"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">HW/SW</label>
                <select
                  name="hwSw"
                  value={form.hwSw}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="H/W">H/W</option>
                  <option value="S/W">S/W</option>
                </select>
              </div>

              {/* step */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">step</label>
                <select
                  name="step"
                  value={form.step}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  {STEP_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">불량구분</label>
                <select
                  name="defectCategory"
                  value={form.defectCategory}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">불량 위치</label>
                <select
                  name="location"
                  value={form.location}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  {locationOptions.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>

              {/* 불량 / 불량유형 (연동) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  불량 <span className="text-rose-500">*</span>
                </label>
                <select
                  name="defect"
                  value={form.defect}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="" disabled>
                    선택하세요
                  </option>
                  {defectOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  불량유형 <span className="text-rose-500">*</span>
                </label>
                <select
                  name="defectType"
                  value={form.defectType}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  disabled={!form.defect}
                >
                  {!form.defect && <option value="">먼저 불량을 선택하세요</option>}
                  {form.defect &&
                    defectTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">세부 불량</label>
                <input
                  name="detail"
                  value={form.detail}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="예) 볼트 체결 불량 / 케이블 타이 누락 등"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">사진(참조)</label>
                <input
                  name="photoRef"
                  value={form.photoRef}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="예) j-11-10 (3)"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">TS 소요 시간(분)</label>
                <input
                  type="number"
                  name="tsMinutes"
                  value={form.tsMinutes ?? 0}
                  onChange={handleChange}
                  min={0}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className={`rounded-full px-5 py-2 text-sm font-semibold text-white ${
                  loading ? 'bg-gray-400' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                {loading ? '저장 중…' : '저장(서버)'}
              </button>
            </div>
          </form>
        </Shell>

        {/* 조회 박스: 장비번호(machine_no) */}
        <Shell header="장비번호(machine_no)로 조회">
          <div className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <div className="md:col-span-3">
                <label className="mb-1 block text-sm font-medium text-gray-700">장비번호</label>
                <input
                  value={qMachineNo}
                  onChange={(e) => setQMachineNo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-sky-400 focus:ring-2 focus:ring-sky-200"
                  placeholder="예) STP-11-10"
                />
              </div>
              <div className="md:col-span-2 flex items-end gap-2">
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className={`rounded-full px-5 py-2 text-sm font-semibold text-white ${
                    loading ? 'bg-gray-400' : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {loading ? '조회 중…' : '조회'}
                </button>
                {qMachineNo && (
                  <button
                    onClick={() => setQMachineNo('')}
                    className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>
          </div>
        </Shell>

        {/* 결과 테이블 */}
        <Shell
          header="조회 결과"
          right={
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-sky-200">
              {rows.length}건
            </span>
          }
        >
          <div className="max-h-[560px] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-sky-50 text-sky-900">
                <tr>
                  <th className="px-3 py-2">MONTH</th>
                  <th className="px-3 py-2">장비번호</th>
                  <th className="px-3 py-2">HW/SW</th>
                  <th className="px-3 py-2">step</th>
                  <th className="px-3 py-2">불량구분</th>
                  <th className="px-3 py-2">불량 위치</th>
                  <th className="px-3 py-2">불량</th>
                  <th className="px-3 py-2">불량유형</th>
                  <th className="px-3 py-2">세부 불량</th>
                  <th className="px-3 py-2">사진</th>
                  <th className="px-3 py-2">TS(분)</th>
                  <th className="px-3 py-2">작성자</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={13}>
                      저장하거나 조회하면 여기에 표시됩니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => {
                    const isEdit = editId === r.id;
                    return (
                      <tr key={r.id ?? `${r.machineNo}-${Math.random()}`} className="border-t hover:bg-gray-50">
                        {/* MONTH: 수정 시 달력 입력 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.month
                          ) : (
                            <input
                              type="date"
                              name="monthDate"
                              value={toDateInput(getYearFromISO(r.created_at), edit?.month ?? r.month, 1)}
                              onChange={handleEditChange}
                              className="w-36 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            />
                          )}
                        </td>
                        {/* 장비번호 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.machineNo
                          ) : (
                            <input
                              name="machineNo"
                              value={edit?.machineNo ?? r.machineNo}
                              onChange={handleEditChange}
                              className="w-40 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            />
                          )}
                        </td>
                        {/* HW/SW */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.hwSw
                          ) : (
                            <select
                              name="hwSw"
                              value={edit?.hwSw ?? r.hwSw}
                              onChange={handleEditChange}
                              className="w-24 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              <option value="H/W">H/W</option>
                              <option value="S/W">S/W</option>
                            </select>
                          )}
                        </td>
                        {/* step */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.step
                          ) : (
                            <select
                              name="step"
                              value={edit?.step ?? r.step}
                              onChange={handleEditChange}
                              className="w-40 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              {STEP_OPTIONS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 카테고리 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.defectCategory
                          ) : (
                            <select
                              name="defectCategory"
                              value={edit?.defectCategory ?? r.defectCategory}
                              onChange={handleEditChange}
                              className="w-36 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              {categoryOptions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 위치 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.location
                          ) : (
                            <select
                              name="location"
                              value={edit?.location ?? r.location}
                              onChange={handleEditChange}
                              className="w-40 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              {locationOptions.map((loc) => (
                                <option key={loc} value={loc}>
                                  {loc}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 불량 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.defect
                          ) : (
                            <select
                              name="defect"
                              value={edit?.defect ?? r.defect}
                              onChange={handleEditChange}
                              className="w-40 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              {defectOptions.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 불량유형 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.defectType
                          ) : (
                            <select
                              name="defectType"
                              value={edit?.defectType ?? r.defectType}
                              onChange={handleEditChange}
                              className="w-36 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            >
                              {(editDefectTypeOptions.length ? editDefectTypeOptions : [r.defectType]).map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {/* 세부 불량 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.detail
                          ) : (
                            <input
                              name="detail"
                              value={edit?.detail ?? r.detail}
                              onChange={handleEditChange}
                              className="w-48 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            />
                          )}
                        </td>
                        {/* 사진 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.photoRef
                          ) : (
                            <input
                              name="photoRef"
                              value={edit?.photoRef ?? r.photoRef}
                              onChange={handleEditChange}
                              className="w-36 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            />
                          )}
                        </td>
                        {/* TS */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            r.tsMinutes
                          ) : (
                            <input
                              type="number"
                              min={0}
                              name="tsMinutes"
                              value={edit?.tsMinutes ?? r.tsMinutes ?? 0}
                              onChange={handleEditChange}
                              className="w-24 rounded border border-gray-200 p-1 focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                            />
                          )}
                        </td>
                        {/* 작성자 (보기만) */}
                        <td className="px-3 py-2">{r.reporter}</td>

                        {/* 액션 */}
                        <td className="px-3 py-2">
                          {!isEdit ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEdit(r)}
                                className="rounded-full bg-amber-500 px-3 py-1 text-white hover:bg-amber-600"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => handleDelete(r)}
                                className="rounded-full bg-rose-500 px-3 py-1 text-white hover:bg-rose-600"
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="rounded-full bg-sky-600 px-3 py-1 text-white hover:bg-sky-700 disabled:opacity-60"
                                disabled={loading}
                              >
                                저장
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-full bg-gray-200 px-3 py-1 text-gray-800 hover:bg-gray-300"
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
        </Shell>

        <p className="text-xs text-gray-500">
          401이면 로그인 토큰이 없을 수 있어요. <code>localStorage.access_token</code> 확인 및 요청 URL에
          <code> /api </code> 프리픽스가 붙었는지 점검해 주세요.
        </p>
      </div>
    </div>
  );
};

export default TroubleShootPage;
