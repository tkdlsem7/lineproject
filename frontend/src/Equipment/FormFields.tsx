// 📁 src/pages/EquipmentFormDemo.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParams } from 'react-router-dom';

/* ------------------------------------------------------------------ */
/* 📌 입력 폼 상태 타입 정의                                           */
/* ------------------------------------------------------------------ */
interface FormState {
  machineId: string;   // 장비 ID
  progress: number;    // 진척도 (%)
  shippingDate: string; // 출하일 (YYYY-MM-DD)
  customer: string;    // 고객사
  manager: string;     // 담당자
  note: string;        // 특이사항 메모
}



/* ------------------------------------------------------------------ */
/* 🖥  장비 정보 입력/수정 데모 컴포넌트 (백엔드 연동 X)                */
/* ------------------------------------------------------------------ */
export default function EquipmentFormDemo() {
  const nav = useNavigate();
  const { id } = useParams<{ id: string }>(); // id === "J-07-02" 또는 "B6"

  alert(id);

  /* 로컬 상태: 실제 DB 저장 대신 화면 데모용으로만 관리 */
  const [form, setForm] = useState<FormState>({
    machineId: '',
    progress: 0,
    shippingDate: '',
    customer: '',
    manager: '',
    note: '',
  });

  /* 공통 입력 핸들러 (keyof FormState 타입 안전) */
  const handleChange =
    (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm({ ...form, [key]: e.target.value });

  /* 저장 버튼 클릭 시: 콘솔 출력만 하고 뒤로가기 */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('📝 입력된 데이터', form);
    // TODO: fetch/axios 로 API 연동
    nav(-1);
  };

  /* ---------------------------------------------------------------- */
  /* 🖼  UI                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ───────────── 헤더 (뒤로가기) ───────────── */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => nav(-1)}
            className="text-indigo-600 font-medium hover:underline"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold">장비 정보 입력 (데모)</h1>
        </div>
      </header>

      {/* ───────────── 본문 폼 ───────────── */}
      <form
        onSubmit={handleSubmit}
        className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow"
      >
        {/* 2-열 그리드 (모바일 1-열) : 간격 여유 있게 gap-y-6 */}
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

          {/* 진척도 (슬라이더 + 숫자) */}
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
              value={form.shippingDate}
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

          {/* 특이사항 메모: 2-열 전체 차지 */}
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

        {/* 하단 액션 버튼 */}
        <div className="mt-10 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => nav(-1)}
            className="btn btn-outline"
          >
            취소
          </button>
          <button type="submit" className="btn btn-primary">
            저장
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 🎨 Tailwind 헬퍼 클래스 (globals.css 등에서 @apply)                 */
/* ------------------------------------------------------------------ */
/*
.label        { @apply block mb-1 font-medium text-sm text-gray-700; }      // ⬆︎ 라벨-입력창 간격 확대
.input        { @apply w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500; }
.btn          { @apply px-4 py-2 rounded-md font-medium; }
.btn-primary  { @apply text-white bg-indigo-600 hover:bg-indigo-700; }
.btn-outline  { @apply border border-gray-300 text-gray-700 hover:bg-gray-100; }
*/
