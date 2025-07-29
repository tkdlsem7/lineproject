// src/pages/OptionDetailPage.tsx
import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {useOptionLogInput} from './hooks/optionlog'
import { useOptionChecklist} from '../hooks/OptionDetail';
import { useAuth } from '../context/AuthContext';

/**
 * 옵션 상세 페이지 컴포넌트
 * - useOptionChecklist 훅을 통해 데이터 조회
 * - 테이블 형태로 체크리스트 디자인 적용
 * - 총 합계 및 퍼센트 컬럼 추가
 * - 한번에 전체 선택/해제 기능
 * - 뒤로가기 및 저장 버튼(백엔드로 전송)
 */
export default function OptionDetailPage() {
  const { id = '', optionName = '' } =
    useParams<{ id?: string; optionName?: string }>();
  const navigate = useNavigate();
  const optionLog = useOptionLogInput();
  const { manager } = useAuth();

  

  // 데이터 조회
  const {
    data: items = [],
    isLoading,
    error,
  } = useOptionChecklist(optionName);

  // 체크 상태 관리
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 총 소요 시간
  const totalHours = useMemo(
    () => items.reduce((sum, item) => sum + item.hours, 0),
    [items]
  );

  // 전체 선택 상태
  const allChecked = useMemo(
    () => items.length > 0 && checkedItems.size === items.length,
    [items, checkedItems]
  );

  // 전체 선택/해제
  const handleSelectAll = () => {
    if (allChecked) setCheckedItems(new Set());
    else setCheckedItems(new Set(items.map(item => item.no)));
  };

  // 개별 토글
  const toggleItem = (no: number) => {
    const newSet = new Set(checkedItems);
    if (newSet.has(no)) newSet.delete(no);
    else newSet.add(no);
    setCheckedItems(newSet);
  };

  // 저장: 체크된 퍼센트 합 계산 후 백엔드로 POST
  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    // 체크된 퍼센트 합산
    const sumPercent = items.reduce((sum, item) =>
      checkedItems.has(item.no)
        ? sum + (totalHours ? (item.hours / totalHours) * 100 : 0)
        : sum
    , 0).toFixed(1);

    try {
      const res = await fetch(
        `/api/options/${encodeURIComponent(id)}/percent`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, percent: parseFloat(sumPercent) }),
        }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);

      await optionLog.mutateAsync({
        machine_no : id,
        manager : manager ?? '',
      });


      alert('저장 완료!');
      navigate(-2);
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!optionName) {
    return <div className="text-center text-red-500 mt-10">⚠️ 옵션 이름이 없습니다.</div>;
  }
  if (isLoading) {
    return <div className="animate-pulse text-center">로딩 중…</div>;
  }
  if (error) {
    return <div className="text-red-500 text-center">에러 발생: {error.message}</div>;
  }

  return (
    <section className="px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-center">
        {id} 옵션: {optionName}
      </h1>

      <table className="w-full max-w-4xl mx-auto border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-100 text-center">
            <th className="border p-2 w-12">
              <input
                type="checkbox"
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                checked={allChecked}
                onChange={handleSelectAll}
              />
            </th>
            <th className="border p-2">Step ({items.length}개)</th>
            <th className="border p-2">항목</th>
            <th className="border p-2">표준작업공수시간</th>
            <th className="border p-2">퍼센트</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => {
            const percent = totalHours ? (item.hours / totalHours) * 100 : 0;
            const isChecked = checkedItems.has(item.no);
            return (
              <tr key={item.no} className="hover:bg-gray-50 transition-colors">
                <td className="border p-2 text-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    checked={isChecked}
                    onChange={() => toggleItem(item.no)}
                  />
                </td>
                <td className="border p-2 text-center">Step {item.step}</td>
                <td className="border p-2">{item.item}</td>
                <td className="border p-2 text-right">{item.hours}h</td>
                <td className="border p-2 text-right">{percent.toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-semibold">
            <td className="border p-2"></td>
            <td className="border p-2 text-center">합계</td>
            <td className="border p-2"></td>
            <td className="border p-2 text-right">{totalHours}h</td>
            <td className="border p-2 text-right">100%</td>
          </tr>
        </tfoot>
      </table>

      {/* 저장 에러 */}
      {saveError && <p className="text-red-500 text-center mt-2">저장 실패: {saveError}</p>}

      <div className="flex justify-center gap-4 mt-8">
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
          disabled={saving}
        >
          ← 뒤로가기
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
          disabled={saving}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </section>
  );
}
