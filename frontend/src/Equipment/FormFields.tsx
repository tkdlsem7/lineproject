// 📁 src/Equipment/FormFields.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEquipment } from '../hooks/fieldinput';
import type { EquipmentDTO } from './equipment';

/* ------------------------------------------------------------------ */
/* 📝 입력 폼 컴포넌트                                                 */
/*    - /equipment/:id   → 수정 모드 (id 파라미터 존재)               */
/*    - /equipment/new   → 신규 모드 (id 없음)                        */
/* ------------------------------------------------------------------ */
export default function FormFields() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>(); // id === machineId
  console.log('🧭 id 파라미터:', id);

  const {
    data,            // 장비 데이터 (EquipmentDTO)
    isPending,       // 로딩
    error,           // 에러
    save,            // 저장 함수 (POST /api/equipment)
    saving,          // 저장 중?
  } = useEquipment(id);

  /* ----------------------- 로컬 폼 상태 ----------------------- */
  const [form, setForm] = useState<EquipmentDTO>({
    machineId: '',                 // ★ 변경: 초깃값 공란
    progress: 0,
    shippingDate: '',
    customer: '',
    manager: '',
    note: '',
  });

  /* 서버에서 가져온 데이터를 폼에 주입 ------------------------- */
  useEffect(() => {
    if (data) {
      setForm(data);               // 수정 모드: DB 값 주입
    }
  }, [data]);

  /* 공통 입력 핸들러 ------------------------------------------- */
  const handleChange =
    (key: keyof EquipmentDTO) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value =
        key === 'progress' ? Number(e.target.value) : e.target.value;
      setForm(prev => ({ ...prev, [key]: value }));
    };

  /* 저장 ------------------------------------------------------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await save(form); // INSERT or UPDATE
      nav(-1);          // 뒤로가기
    } catch (err) {
      console.error(err);
      alert('저장 실패! 콘솔을 확인하세요.');
    }
  };

  /* 로딩 / 에러 상태 ------------------------------------------- */
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

  /* ----------------------- 렌더링 ------------------------------ */
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
/* 🎨 Tailwind 공통 유틸 (globals.css 등)                              */
/* ------------------------------------------------------------------
.label        { @apply block mb-1 font-medium text-sm text-gray-700; }
.input        { @apply w-full rounded-md border-gray-300 focus:border-indigo-500 focus:ring-indigo-500; }
.btn          { @apply px-4 py-2 rounded-md font-medium transition; }
.btn-primary  { @apply bg-indigo-600 text-white hover:bg-indigo-700; }
.btn-outline  { @apply border border-gray-300 text-gray-700 hover:bg-gray-100; }
*/
