// 📁 src/Equipment/FormFields.tsx
// -----------------------------------------------------------------------------
// 해당 컴포넌트는 장비 정보를 등록/수정하는 폼입니다.
// 🔑 변경 사항
//   1. machineId에 '-'가 포함되어 있으면 수정 모드로 판단하여 입력 불가(read-only)
//   2. Progress(진척도) 슬라이더는 항상 읽기 전용(disabled)
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { format, parseISO } from 'date-fns';          // 📦 날짜 변환 유틸
import { useEquipment } from '../hooks/fieldinput';
import type { EquipmentDTO } from './equipment';

/* ✨ 폼 전용 타입 */
type EquipmentForm = Omit<EquipmentDTO, 'shippingDate'> & {
  shippingDate: Date | null;
};

export default function FormFields() {
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const machineIdParam = id ?? '';
  const { state } = useLocation() as { state?: { slotCode?: string } };
  const isUpdateMode = machineIdParam.includes('-');

  const { data, isPending, error, save, saving } = useEquipment(machineIdParam);

  const [form, setForm] = useState<EquipmentForm>({
    machineId: '',
    progress: 0,
    shippingDate: null,
    customer: '',
    manager: '',
    note: '',
    slotCode: state?.slotCode ?? '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        shippingDate: parseISO(data.shippingDate),
      });
    }
  }, [data]);

  const handleChange =
    (key: keyof EquipmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const value =
        key === 'progress' ? Number(raw) :
        key === 'shippingDate' ? (raw ? parseISO(raw) : null) :
        raw;
      setForm(prev => ({ ...prev, [key]: value as any }));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.machineId.trim()) return alert('Machine ID는 필수입니다.');
    if (!form.shippingDate) return alert('출하일을 선택하세요.');

    const slotCode =
      form.slotCode.trim() !== '' ? form.slotCode.trim() :
      machineIdParam || form.machineId;

    const payload: EquipmentDTO = {
      ...form,
      slotCode,
      shippingDate: format(form.shippingDate, 'yyyy-MM-dd'),
      machineId: machineIdParam || form.machineId,
    };

    console.log('[SAVE PAYLOAD]', payload);

    try {
      await save(payload);
      alert('저장에 성공했습니다.');
      nav(-1);
    } catch (err) {
      console.error('[SAVE ERROR]', err);
      alert('저장 실패! 콘솔을 확인하세요.');
    }
  };

  if (isPending) return <p className="p-8 text-center text-gray-600">Loading equipment…</p>;
  if (error) return <p className="p-8 text-center text-red-500">데이터를 불러오지 못했습니다.</p>;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Machine ID */}
        <div>
          <label className="label">Machine&nbsp;ID *</label>
          <input
            value={form.machineId}
            onChange={handleChange('machineId')}
            required
            disabled={isUpdateMode}    // 🔒 수정 모드일 경우 입력 불가
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
            disabled                     // 항상 비활성화
            onChange={handleChange('progress')}
            className="w-full accent-indigo-600"
          />
          <p className="mt-2 text-sm text-right text-gray-600">{form.progress}%</p>
        </div>

        {/* 출하일 */}
        <div>
          <label className="label">출하일 *</label>
          <input
            type="date"
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

        {/* 특이사항 메모 */}
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

      <div className="mt-10 flex justify-end gap-3">
        <button type="button" onClick={() => nav(-1)} className="btn btn-outline">취소</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </form>
  );
}
