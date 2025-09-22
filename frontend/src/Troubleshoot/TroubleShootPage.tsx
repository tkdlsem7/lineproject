// src/pages/TroubleShootPage.tsx
import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

/** API Base: Vite/CRA 환경변수 우선, 없으면 '/api' */
const rawBase =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined) ??
  (typeof process !== 'undefined'
    ? ((process as any)?.env?.REACT_APP_API_BASE as string | undefined)
    : undefined);

export const API_BASE: string = rawBase ? rawBase.replace(/\/+$/, '') : '';

type HwSw = 'H/W' | 'S/W';

type TSForm = {
  month: number;
  model: string;
  diff: number;          // 차분
  unitNo: number;        // 호기 (서버 전송 시 unit_no 로 변환)
  hwSw: HwSw;
  step: string;          // 선택형
  defectCategory: string;
  location: string;
  defect: string;        // 불량
  defectType: string;    // 불량유형
  detail: string;        // 세부 불량
  photoRef?: string;     // 사진 참조 텍스트
  tsMinutes?: number;    // TS 소요(분)
  reporter: string;
};

type TroubleShootCreate = {
  month: number;
  model: string;
  diff: number;
  unit_no: number;
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


/** 불량 → 불량유형 매핑 (필요시 수정/추가) */
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

const TroubleShootPage: React.FC<{ userName?: string }> = ({ userName }) => {
  const reporter = userName ?? localStorage.getItem('user_name') ?? '사용자';

  // 폼 상태
  const [form, setForm] = useState<TSForm>({
    month: new Date().getMonth() + 1,
    model: 'STP',
    diff: 11,
    unitNo: 10,
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

  // 조회 조건 (모델/차분/호기)
  const [qModel, setQModel] = useState(form.model);
  const [qDiff, setQDiff] = useState<number>(form.diff);
  const [qUnitNo, setQUnitNo] = useState<number>(form.unitNo);
  const navigate = useNavigate();
  // 테이블 행
  const [rows, setRows] = useState<TSRow[]>([]);
  const [loading, setLoading] = useState(false);

  // 옵션들
  const modelOptions = ['STP', 'STG', 'SFA'];
  const locationOptions = ['PC & Monitor', 'Loader', 'Stage', 'Chiller'];
  const categoryOptions = ['단순 하드웨어', '단순 소프트웨어'];
  const defectOptions = useMemo(() => Object.keys(DEFECT_TYPES_BY_DEFECT), []);
  const defectTypeOptions = useMemo(
    () => (form.defect ? DEFECT_TYPES_BY_DEFECT[form.defect] ?? [] : []),
    [form.defect]
  );
  const monthOptions = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  // 공통: 토큰 헤더
  const authHeader = () => {
    const token = localStorage.getItem('access_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // form → 서버 payload(snake_case) 매핑
  const toPayload = (f: TSForm): TroubleShootCreate => ({
    month: f.month,
    model: f.model,
    diff: f.diff,
    unit_no: f.unitNo,
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

  // 서버 → 표시용(카멜) 매핑
  const fromServer = (r: TroubleShootRead): TSRow => ({
    month: r.month,
    model: r.model,
    diff: r.diff,
    unitNo: r.unit_no,
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

  // 입력 변경
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    // 불량 선택 → 유형 첫값 자동 설정
    if (name === 'defect') {
      const nextTypes = DEFECT_TYPES_BY_DEFECT[value] ?? [];
      setForm((prev) => ({
        ...prev,
        defect: value,
        defectType: nextTypes[0] ?? '',
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      [name]:
        name === 'month' || name === 'diff' || name === 'unitNo' || name === 'tsMinutes'
          ? Number(value)
          : value,
    }));
  };

  // 저장(POST)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.model || !form.location || !form.defect || !form.defectType) {
      alert('모델, 불량 위치, 불량, 불량유형은 필수입니다.');
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
      // 간단 리셋 (불량/유형/세부/사진/시간만)
      setForm((prev) => ({
        ...prev,
        defect: '',
        defectType: '',
        detail: '',
        photoRef: '',
        tsMinutes: 1,
      }));
      alert('저장되었습니다.');
    } catch (err: any) {
      console.error(err);
      alert('저장에 실패했습니다. (로그인/네트워크 확인)');
    } finally {
      setLoading(false);
    }
  };

  // 조회(GET)
  const handleSearch = async () => {
    try {
      setLoading(true);
      const res = await axios.get<TroubleShootRead[]>(
        `${API_BASE}/troubleshoot/search`,
        {
          params: { model: qModel, diff: qDiff, unit_no: qUnitNo },
          headers: authHeader(),
        }
      );
      setRows(res.data.map(fromServer));
    } catch (err) {
      console.error(err);
      alert('조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-gray-900">Trouble Shoot 입력</h1>

        {/* 제목 아래: 로그인 + 뒤로가기 버튼 */}
        <div className="mt-2 flex items-center justify-between">
        <div className="text-gray-700">
            로그인한 사용자: <span className="font-semibold">{reporter}</span>
        </div>
        <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
            ← 뒤로가기
        </button>
        </div>

        {/* 저장 폼 */}
        <form onSubmit={handleAdd} className="mt-6 rounded-xl bg-white p-6 shadow">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="block text-sm text-gray-600">MONTH</label>
              <select
                name="month"
                value={form.month}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600">모델</label>
              <select
                name="model"
                value={form.model}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600">차분</label>
              <input
                type="number"
                name="diff"
                value={form.diff}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600">호기</label>
              <input
                type="number"
                name="unitNo"
                value={form.unitNo}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600">HW/SW</label>
              <select
                name="hwSw"
                value={form.hwSw}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                <option value="H/W">H/W</option>
                <option value="S/W">S/W</option>
              </select>
            </div>

            {/* step */}
            <div>
              <label className="block text-sm text-gray-600">step</label>
              <select
                name="step"
                value={form.step}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {STEP_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600">불량구분</label>
              <select
                name="defectCategory"
                value={form.defectCategory}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600">불량 위치</label>
              <select
                name="location"
                value={form.location}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {locationOptions.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>
            </div>

            {/* 불량 / 불량유형 (연동) */}
            <div>
              <label className="block text-sm text-gray-600">불량</label>
              <select
                name="defect"
                value={form.defect}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                <option value="" disabled>선택하세요</option>
                {defectOptions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600">불량유형</label>
              <select
                name="defectType"
                value={form.defectType}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                disabled={!form.defect}
              >
                {!form.defect && <option value="">먼저 불량을 선택하세요</option>}
                {form.defect && defectTypeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm text-gray-600">세부 불량</label>
              <input
                name="detail"
                value={form.detail}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                placeholder="예) 볼트 체결 불량 / 케이블 타이 누락 등"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600">사진(참조)</label>
              <input
                name="photoRef"
                value={form.photoRef}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                placeholder="예) j-11-10 (3)"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600">TS 소요 시간(분)</label>
              <input
                type="number"
                name="tsMinutes"
                value={form.tsMinutes ?? 0}
                onChange={handleChange}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
                min={0}
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? '저장 중…' : '저장(서버)'}
            </button>
          </div>
        </form>

        {/* 조회 박스: 모델/차분/호기 */}
        <div className="mt-6 rounded-xl bg-white p-6 shadow">
          <div className="mb-3 text-sm font-semibold text-gray-800">모델/차분/호기로 조회</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="block text-sm text-gray-600">모델</label>
              <select
                value={qModel}
                onChange={(e) => setQModel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              >
                {modelOptions.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600">차분</label>
              <input
                type="number"
                value={qDiff}
                onChange={(e) => setQDiff(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600">호기</label>
              <input
                type="number"
                value={qUnitNo}
                onChange={(e) => setQUnitNo(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-gray-300 p-2"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <button
                onClick={handleSearch}
                disabled={loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
              >
                {loading ? '조회 중…' : '조회'}
              </button>
            </div>
          </div>
        </div>

        {/* 결과 테이블 */}
        <div className="mt-6 overflow-x-auto rounded-xl bg-white shadow">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-3 py-2">MONTH</th>
                <th className="px-3 py-2">모델</th>
                <th className="px-3 py-2">차분</th>
                <th className="px-3 py-2">호기</th>
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
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-gray-500" colSpan={14}>
                    저장하거나 조회하면 여기에 표시됩니다.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id ?? `${r.model}-${r.diff}-${r.unitNo}-${Math.random()}`} className="border-t">
                    <td className="px-3 py-2">{r.month}</td>
                    <td className="px-3 py-2">{r.model}</td>
                    <td className="px-3 py-2">{r.diff}</td>
                    <td className="px-3 py-2">{r.unitNo}</td>
                    <td className="px-3 py-2">{r.hwSw}</td>
                    <td className="px-3 py-2">{r.step}</td>
                    <td className="px-3 py-2">{r.defectCategory}</td>
                    <td className="px-3 py-2">{r.location}</td>
                    <td className="px-3 py-2">{r.defect}</td>
                    <td className="px-3 py-2">{r.defectType}</td>
                    <td className="px-3 py-2">{r.detail}</td>
                    <td className="px-3 py-2">{r.photoRef}</td>
                    <td className="px-3 py-2">{r.tsMinutes}</td>
                    <td className="px-3 py-2">{r.reporter}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 작은 안내 */}
        <p className="mt-3 text-xs text-gray-500">
          저장/조회가 401이면 로그인 토큰이 없을 수 있어요. <code>localStorage.access_token</code> 확인 및 요청 URL에 <code>/api</code> 프리픽스가 붙었는지 점검해 주세요.
        </p>
      </div>
    </div>
  );
};

export default TroubleShootPage;
