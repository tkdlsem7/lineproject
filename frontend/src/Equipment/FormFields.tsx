// 📁 src/Equipment/FormFields.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';          // 📦 날짜 변환 유틸
import { useEquipment } from '../hooks/fieldinput';
import type { EquipmentDTO } from './equipment';
import { useLocation } from 'react-router-dom';

/* ────────────────────────────────────────────────────────────── */
/* ✨ 1) 폼 전용 타입 (shippingDate를 Date로 변환)                 */
/*    - UI ↔ hook 사이에서만 사용하고, 서버 전송 전엔             */
/*      다시 EquipmentDTO 형태(string)로 직렬화한다               */
/* ────────────────────────────────────────────────────────────── */
type EquipmentForm = Omit<EquipmentDTO, 'shippingDate'> & {
  shippingDate: Date | null;   // Date 객체 (null 허용)
};


/* ------------------------------------------------------------------ */
/* 📝 입력 폼 컴포넌트                                                 */
/* ------------------------------------------------------------------ */
export default function FormFields() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>(); // id === machineId
  const machineIdParam = id ?? '';
  console.log(id);

  const { state } = useLocation() as {
    state?: { slotCode?: string };
  };

  const {
    data,           // 장비 데이터 (EquipmentDTO)
    isPending,      // 로딩
    error,          // 에러
    save,           // 저장 함수 (POST /api/equipment)
    saving,         // 저장 중?
  } = useEquipment(id);

  /* ───────────────────────── 로컬 폼 상태 ──────────────────────── */
  const [form, setForm] = useState<EquipmentForm>({
    machineId: '',
    progress:   0,
    shippingDate: null,        // Date 객체
    customer:   '',
    manager:    '',
    note:       '',
    slotCode: state?.slotCode ?? '',
  });

  /* ───────────── 서버 데이터 → 폼으로 주입 (수정 모드) ─────────── */
  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        shippingDate: parseISO(data.shippingDate), // 'YYYY-MM-DD' → Date
      });
    }
  }, [data]);

  /* ───────────── 공통 입력 핸들러 ───────────── */
  const handleChange =
    (key: keyof EquipmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;

      // key별 형식 변환
      const value =
        key === 'progress'        ? Number(raw)              // range → number
      : key === 'shippingDate'    ? (raw ? parseISO(raw) : null) // date → Date/null
      :                             raw;                     // 나머진 string

      setForm(prev => ({ ...prev, [key]: value as any }));
    };

  /* ───────────── 저장 로직 ───────────── */
// (FormFields.tsx 중 handleSubmit 부분만 발췌)
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  /* 1) 기본 입력 검증 ------------------------------------------- */
  if (!form.machineId.trim()) {
    return alert('Machine ID는 필수입니다.');
  }
  if (!form.shippingDate) {
    return alert('출하일을 선택하세요.');
  }

  const slotCode =
  form.slotCode.trim() !== ''          // UPDATE 모드라면 기존 값 유지
    ? form.slotCode.trim()
    : machineIdParam || form.machineId // INSERT 모드 기본값

  /* 2) 직렬화(Date → "YYYY-MM-DD") ------------------------------- */
  const payload: EquipmentDTO = {
    ...form,
    slotCode,
    shippingDate: format(form.shippingDate, 'yyyy-MM-dd'),
  };

  /* 3) ───────────── 디버깅용 로그 ───────────── */
  console.log('[SAVE PAYLOAD]', payload);

  /* 4) 저장 ------------------------------------------------------ */
  try {
    await save(payload);   // INSERT or UPDATE
    alert("저장에 성공했습니다.");
    nav(-1);               // 뒤로가기
  } catch (err) {
    console.error('[SAVE ERROR]', err);
    alert('저장 실패! 콘솔을 확인하세요.');
  }
};


  /* ───────────── 로딩 / 에러 UI ───────────── */
  if (isPending)
    return (
      <p className="p-8 text-center text-gray-600">Loading equipment…</p>
    );
  if (error)
    return (
      <p className="p-8 text-center text-red-500">
        데이터를 불러오지 못했습니다.
      </p>
    );

  /* ───────────── 렌더링 ───────────── */
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow"
    >
      {/* 2열 그리드 (모바일 1열) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Machine ID */}
        <div>
          <label className="label">Machine&nbsp;ID *</label>
          <input
            value={form.machineId}
            onChange={handleChange('machineId')}
            required
            placeholder="예) J-07-02"
            className="input"
          />
        </div>

        {/* 진척도 슬라이더 */}
        <div>
          <label className="label">진척도 (%) *</label>
          <input
            type="range"
            min={0}
            max={100}
            value={form.progress}
            onChange={handleChange('progress')}
            className="w-full accent-indigo-600"
          />
          <p className="mt-2 text-sm text-right text-gray-600">
            {form.progress}%
          </p>
        </div>

        {/* 출하일 */}
        <div>
          <label className="label">출하일 *</label>
          <input
            type="date"
            /* Date → 'YYYY-MM-DD'  (input type=date는 문자열만 받음) */
            value={form.shippingDate ? format(form.shippingDate, 'yyyy-MM-dd') : ''}
            onChange={handleChange('shippingDate')}
            required
            className="input"
          />
        </div>

        {/* Customer */}
        <div>
          <label className="label">Customer</label>
          <input
            value={form.customer}
            onChange={handleChange('customer')}
            placeholder="예) ABC Corp"
            className="input"
          />
        </div>

        {/* Manager */}
        <div>
          <label className="label">Manager</label>
          <input
            value={form.manager}
            onChange={handleChange('manager')}
            placeholder="예) 홍길동"
            className="input"
          />
        </div>

        {/* 특이사항 메모: 2열 전체 차지 */}
        <div className="md:col-span-2">
          <label className="label">비고</label>
          <textarea
            value={form.note}
            onChange={handleChange('note')}
            rows={4}
            placeholder="특이사항 메모"
            className="input resize-none"
          />
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="mt-10 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="btn btn-outline"
        >
          취소
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* 🎨 Tailwind 공통 유틸 (globals.css 등) — 변경 없음                 */
/* ------------------------------------------------------------------
.label        { @apply block mb-1 font-medium text-sm text-gray-700; }
.input        { @apply w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500; }
.btn          { @apply px-4 py-2 rounded-md font-medium transition; }
.btn-primary  { @apply bg-indigo-600 text-white hover:bg-indigo-700; }
.btn-outline  { @apply border border-gray-300 text-gray-700 hover:bg-gray-100; }
*/
