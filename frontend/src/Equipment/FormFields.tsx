// -----------------------------------------------------------------------------
// 장비 정보 등록/수정 폼
//   1) machineId에 '-' 포함 → 수정 모드, 입력 불가(read-only)
//   2) Progress 슬라이더는 항상 비활성(disabled)
//   3) URL 쿼리 ?site=본사 를 읽어 useEquipment·payload에 전달
// -----------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import {
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import { format, parseISO } from 'date-fns';

import { useEquipment } from '../hooks/fieldinput';           // ✅ 경로 수정
import type { EquipmentDTO } from './equipment';
import { useInputEquipment } from '../hooks/equipment_loginput';

/* ────────────────────────────────────────────────────────── */
/* ① 폼 내부 전용 타입                                         */
/*    - shippingDate: Date 객체
/*    - site          은 스테이트에 두지 않고, URL 쿼리에서 직접 가져옴
/* ────────────────────────────────────────────────────────── */
type EquipmentForm = Omit<EquipmentDTO, 'shippingDate' | 'site'> & {
  shippingDate: Date | null;
};

export default function FormFields() {
  /* ─── 라우터 파라미터 / 쿼리 ─── */
  const nav = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const machineIdParam = id ?? '';
  const { state } = useLocation() as { state?: { slotCode?: string } };
  const { search } = useLocation();
  const site = new URLSearchParams(search).get('site') ?? '본사';   // 🆕 기본값

  /* ─── 모드 판단 ─── */
  const isUpdateMode = machineIdParam.includes('-');

  /* ─── API 훅 ─── */
  const shipMutation  = useInputEquipment();              // equipment_log 입력
  const {
    data,
    isPending,
    error,
    save,
    saving,
  } = useEquipment(machineIdParam, site);                 // 🆕 site 전달

  /* ─── 로컬 폼 상태 ─── */
  const [form, setForm] = useState<EquipmentForm>({
    machineId: '',
    progress: 0,
    shippingDate: null,
    customer: '',
    manager: '',
    note: '',
    slotCode: state?.slotCode ?? '',
  });

  /* 서버 데이터 수신 → 폼 채우기 */
  useEffect(() => {
    if (data) {
      setForm({
        ...data,
        shippingDate: data.shippingDate
          ? parseISO(data.shippingDate)
          : null,
      });
    }
  }, [data]);

  /* ─── 공통 onChange 핸들러 ─── */
  const handleChange =
    (key: keyof EquipmentForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const raw = e.target.value;
      const value =
        key === 'progress'
          ? Number(raw)
          : key === 'shippingDate'
          ? raw
            ? parseISO(raw)
            : null
          : raw;

      setForm(prev => ({ ...prev, [key]: value as any }));
    };

  /* ─── 제출 ─── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.machineId.trim()) return alert('Machine ID는 필수입니다.');
    if (!form.shippingDate) return alert('출하일을 선택하세요.');

    const slotCode =
      form.slotCode.trim() !== ''
        ? form.slotCode.trim()
        : machineIdParam || form.machineId;

    const payload: EquipmentDTO = {
      ...form,
      slotCode,
      shippingDate: format(form.shippingDate, 'yyyy-MM-dd'),
      machineId: form.machineId,
      site,                         // 🆕 site 포함
    };

    /* 출하 로그 입력 */
    shipMutation.mutate({
      machineNo: form.machineId,
      manager: form.manager,
    });

    try {
      await save(payload);
      alert('저장에 성공했습니다.');
      nav(-1);
    } catch (err) {
      console.error('[SAVE ERROR]', err);
      alert('저장 실패! 콘솔을 확인하세요.');
    }
  };

  /* ─── 로딩 / 에러 처리 ─── */
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

  /* ─── 렌더링 ─── */
  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-3xl mx-auto mt-8 bg-white p-8 rounded-2xl shadow"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Machine ID */}
        <div>
          <label className="label">Machine&nbsp;ID *</label>
          <input
            value={form.machineId}
            onChange={handleChange('machineId')}
            required
            disabled={isUpdateMode}
            placeholder="예) J-07-02"
            className="input"
          />
        </div>

        {/* 진척도 */}
        <div>
          <label className="label">진척도 (%) *</label>
          <input
            type="range"
            min={0}
            max={100}
            value={form.progress}
            disabled
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
            value={
              form.shippingDate ? format(form.shippingDate, 'yyyy-MM-dd') : ''
            }
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

        {/* 비고 */}
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
