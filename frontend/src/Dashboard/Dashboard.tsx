// 📁 src/features/Dashboard/Dashboard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import ABuildingView from './ABuildingView';               // A동 전체 배치도 구성 컴포넌트
import { useEquipProgress } from '../hooks/useEquipProgress'; // 장비 진척도 가져오는 커스텀 훅

export default function Dashboard() {
  // ── UI 상태 ──
  const [selectedLine, setSelectedLine] = useState<string>('A동');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null);
  const lineList = ['A동', 'B동', 'I라인'];

  // ── 데이터 가져오기 ──
  const {
    data: progressList = [],
    isLoading,
    isError,
    refetch,
  } = useEquipProgress();

  // ── 자동 새로고침 (5분) ──
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  // ── Map 변환 ──
  const equipMap = useMemo(() => {
    const map = new Map<string, {
      machineId: string;
      progress: number;
      shippingDate: string;
    }>();
    progressList.forEach(({ slot_code, machine_id, progress, shipping_date }) => {
      map.set(slot_code, {
        machineId: machine_id,
        progress,
        shippingDate: shipping_date,
      });
    });
    return map;
  }, [progressList]);

  // ── 라인 선택 ──
  const handleSelect = (line: string) => {
    setSelectedLine(line);
    setHighlightedSlot(null); // 라인 변경 시 하이라이트 해제
  };

  // ── 수동 새로고침 ──
  const handleManualRefresh = async () => {
    try {
      await refetch();
      alert('🔄 새로고침이 완료되었습니다!');
    } catch {
      alert('🔄 새로고침 중 오류가 발생했습니다.');
    }
  };

  // ── 대소문자 구분 없는 검색 ──
  const handleSearch = () => {
    const query = searchQuery.trim().toLowerCase(); // 입력값 소문자 변환
    if (!query) {
      alert('🔍 검색어를 입력하세요.');
      return;
    }
    let found = false;
    // Map 순회: machineId도 소문자 변환 후 비교
    for (const [slotCode, info] of equipMap.entries()) {
      if (info.machineId.toLowerCase() === query) {
        alert(`✅ ${info.machineId} 장비는 '${slotCode}' 위치에 있습니다.`);
        setHighlightedSlot(slotCode);
        found = true;
        break;
      }
    }
    if (!found) {
      setHighlightedSlot(null);
      alert(`❌ '${searchQuery}' 장비를 찾을 수 없습니다.`);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header: 로고 + 검색창 + 버튼들 */}
      <header className="flex items-center p-4 bg-white shadow">
        {/* SEMICS 로고 */}
        <div
          className="text-4xl font-semibold text-orange-600"
          style={{ fontFamily: 'Semics, sans-serif' }}
        >
          SEMICS
        </div>

        {/* 검색창 + 검색 버튼 */}
        <div className="flex-1 ml-20 mr-3 flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색어를 입력하세요..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            onClick={handleSearch}
            className="ml-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
          >
            🔍 검색
          </button>
        </div>

        {/* 수동 새로고침 버튼 */}
        <button
          onClick={handleManualRefresh}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md"
        >
          🔄 새로고침
        </button>
      </header>

      {/* Body: 사이드바 + 메인 뷰 */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: 라인 선택 */}
        <aside className="w-52 shrink-0 bg-gray-800 text-gray-100">
          <h2 className="px-4 py-3 text-lg font-semibold border-b border-gray-700">
            📋 라인 선택
          </h2>
          <ul>
            {lineList.map((line) => (
              <li
                key={line}
                onClick={() => handleSelect(line)}
                className={`px-4 py-2 cursor-pointer hover:bg-gray-700 ${
                  selectedLine === line ? 'bg-gray-700' : ''
                }`}
              >
                {line}
              </li>
            ))}
          </ul>
        </aside>

        {/* 세로 분리선 */}
        <div className="w-px bg-gray-400" />

        {/* Main View */}
        <main className="flex-1 p-6 overflow-auto">
          {isLoading && (
            <p className="text-center text-gray-500 mt-20">
              데이터 불러오는 중…
            </p>
          )}
          {isError && (
            <p className="text-center text-red-500 mt-20">
              ⚠️ 장비 정보를 불러오지 못했습니다.
            </p>
          )}
          {!isLoading && !isError && (
            <>
              {selectedLine === 'A동' ? (
                <ABuildingView
                  equipMap={equipMap}
                  highlightedSlot={highlightedSlot}
                />
              ) : (
                <p className="text-center text-gray-500 mt-20">
                  <span className="font-semibold">{selectedLine}</span> 배치도가 아직 준비되지 않았습니다.
                </p>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
