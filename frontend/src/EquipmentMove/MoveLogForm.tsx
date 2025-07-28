
// 📁 frontend/src/features/EquipmentMove/EquipmentMovePage.tsx
// ─────────────────────────────────────────────────────────────
// 장비 이동 페이지 (Plain Tailwind · 최종본)
//   • 왼쪽: 체크박스 + (호기 / Site / Slot) 목록
//   • 오른쪽: 이동 Site(select) + 이동 Slot(input)
//   • 하단 "장비 이동 적용" 버튼 → useMoveEquipments() 호출
//   • 상단 ← 뒤로가기 버튼
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMachineInfo } from './hooks/moveloghook';
import { useMoveEquipments } from './hooks/useMoveEquipments';

interface MoveTarget {
  toSite: string;
  toSlot: string;
}

export default function EquipmentMovePage() {
  /* ─── 상태 ─── */
  const [selectedSite, setSelectedSite] = useState('');
  const [moveMap, setMoveMap] = useState<Record<string, MoveTarget>>({});

  /* ─── 훅 ─── */
  const nav = useNavigate();
  const { data: machines = [], isLoading, error } = useMachineInfo(selectedSite);
  const moveMutation = useMoveEquipments();

  /* ─── 리스트 ─── */
  const leftList = useMemo(() => machines, [machines]);

  /* ─── 이벤트 ─── */
  const onSiteFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSite(e.target.value);
    setMoveMap({});
  };

  const toggleCheckbox = (machineId: string) => {
    setMoveMap(prev => {
      const next = { ...prev };
      if (next[machineId]) delete next[machineId];
      else next[machineId] = { toSite: '', toSlot: '' };
      return next;
    });
  };

  const updateTargetSite = (id: string, value: string) =>
    setMoveMap(prev => ({ ...prev, [id]: { ...prev[id], toSite: value } }));

  const updateTargetSlot = (id: string, value: string) =>
    setMoveMap(prev => ({ ...prev, [id]: { ...prev[id], toSlot: value } }));

  /* ─── 이동 실행 ─── */
  const handleMoveClick = () => {
    const payload = Object.entries(moveMap).map(([machine_id, t]) => ({
      machine_id,
      site: t.toSite.trim(),
      slot_code: t.toSlot.trim(),
    }));
    moveMutation.mutate(payload);
  };

  const isReady =
    Object.keys(moveMap).length > 0 &&
    Object.values(moveMap).every(({ toSite, toSlot }) => toSite && toSlot);

  /* ─── JSX ─── */
  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 md:px-12">
      {/* 헤더 */}
      <div className="mx-auto mb-10 max-w-5xl rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 shadow-lg">
        <div className="flex items-center gap-4 px-6 py-4">
          <button
            onClick={() => nav(-1)}
            className="rounded-md bg-white/20 px-3 py-2 text-sm font-medium text-white hover:bg-white/30"
          >
            ← 뒤로가기
          </button>
          <h1 className="flex-1 text-center text-3xl md:text-4xl font-extrabold tracking-wide text-white">
            장비 이동 관리
          </h1>
        </div>

        {/* Site 필터 */}
        <div className="flex flex-col items-center gap-4 px-6 pb-6 md:flex-row">
          <label htmlFor="site-filter" className="text-lg font-semibold text-white">Site</label>
          <select
            id="site-filter"
            value={selectedSite}
            onChange={onSiteFilterChange}
            className="w-48 rounded-md border-none bg-white/80 px-3 py-2 text-slate-700 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white"
          >
            <option value="">선택</option>
            <option value="본사">본사</option>
            <option value="부항리">부항리</option>
            <option value="진우리">진우리</option>
          </select>
          {isLoading && <p className="text-sm text-white animate-pulse">불러오는 중…</p>}
          {error && <p className="text-sm text-red-200">⚠️ 데이터를 불러오지 못했습니다.</p>}
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[45%_55%]">
        {/* 왼쪽: 장비 목록 */}
        <div className="flex flex-col rounded-2xl bg-white shadow-md">
          <h2 className="border-b px-6 py-4 text-lg font-semibold">장비 목록</h2>
          <div className="flex-1 overflow-y-auto max-h-[500px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">호기</th>
                  <th className="px-3 py-2 text-left">Site</th>
                  <th className="px-3 py-2 text-left">Slot</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={3} className="py-4 text-center">불러오는 중…</td></tr>}
                {!isLoading && leftList.length === 0 && selectedSite && (
                  <tr><td colSpan={3} className="py-4 text-center text-gray-400">해당 Site에 장비가 없습니다.</td></tr>
                )}
                {leftList.map(({ machine_id, site, slot_code }, idx) => (
                  <tr key={machine_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-600"
                          checked={!!moveMap[machine_id]}
                          onChange={() => toggleCheckbox(machine_id)}
                        />
                        <span className="font-medium text-slate-700">{machine_id}</span>
                      </label>
                    </td>
                    <td className="px-3 py-2">{site}</td>
                    <td className="px-3 py-2">{slot_code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 오른쪽: 이동 설정 */}
        <div className="flex flex-col rounded-2xl bg-white shadow-md">
          <h2 className="border-b px-6 py-4 text-lg font-semibold">이동 설정</h2>
          <div className="overflow-x-auto p-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100 text-slate-700">
                  <th className="px-3 py-2 text-left">장비 ID</th>
                  <th className="px-3 py-2 text-left">이동 Site</th>
                  <th className="px-3 py-2 text-left">이동 Slot</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(moveMap).map(([id, t], idx) => (
                  <tr key={id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-3 py-2 font-medium text-slate-700">{id}</td>
                    <td className="px-3 py-2">
                      <select
                        value={t.toSite}
                        onChange={e => updateTargetSite(id, e.target.value)}
                        className="rounded-md border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">선택</option>
                        <option value="본사">본사</option>
                        <option value="부항리">부항리</option>
                        <option value="진우리">진우리</option>
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder="새 Slot"
                        value={t.toSlot}
                        onChange={e => updateTargetSlot(id, e.target.value)}
                        className="w-24 rounded-md border border-slate-300 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </td>
                  </tr>
                ))}
                {Object.keys(moveMap).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-gray-400">
                      아직 선택된 장비가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 이동 실행 버튼 */}
          <div className="flex justify-end gap-4 px-6 pb-6">
            <button
              onClick={handleMoveClick}
              disabled={!isReady || moveMutation.isPending}
              className={`rounded-md px-6 py-2 font-semibold text-white ${
                isReady ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'
              } ${moveMutation.isPending ? 'opacity-50' : ''}`}
            >
              {moveMutation.isPending ? '처리 중…' : '장비 이동 적용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
