// 📁 src/features/Dashboard/Dashboard.tsx
import React, { useState, useMemo, useEffect } from 'react';
import ABuildingView from './ABuildingView';               // A동 전체 배치도 구성 컴포넌트
import { useEquipProgress } from '../hooks/useEquipProgress'; // 장비 진척도 가져오는 커스텀 훅

export default function Dashboard() {
  // ─── 상태 정의 ───
  const [selectedLine, setSelectedLine] = useState<string>('');            // 현재 선택된 라인/트리 노드
  const [searchQuery, setSearchQuery] = useState<string>('');              // 검색창 입력 값
  const [highlightedSlot, setHighlightedSlot] = useState<string | null>(null); // 검색 결과 하이라이트 슬롯
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set()); // 확장(열림) 상태 노드 집합

  // ─── 트리 구조 데이터 ───
  // 본사, 부항리, 진우리 각각의 자식 라인 목록 정의
  const lineTree = [
    { name: '본사', children: ['A동', 'B동', 'I라인'] },
    { name: '부항리', children: ['A라인', 'B라인'] },
    { name: '진우리', children: ['A라인', 'B라인'] },
  ];

  // ─── 장비 진척도 데이터 가져오기 ───
  const { data: progressList = [], isLoading, isError, refetch } = useEquipProgress();

  // ─── 5분마다 자동 새로고침 ───
  useEffect(() => {
    const interval = setInterval(() => { refetch(); }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refetch]);

  // ─── 조회된 데이터를 Map으로 변환 ───
  const equipMap = useMemo(() => {
    const map = new Map<string, { machineId: string; progress: number; shippingDate: string }>();
    progressList.forEach(({ slot_code, machine_id, progress, shipping_date }) => {
      map.set(slot_code, { machineId: machine_id, progress, shippingDate: shipping_date });
    });
    return map;
  }, [progressList]);

  // ─── 노드(라인) 선택 핸들러 ───
  const handleSelect = (name: string) => {
    setSelectedLine(name);            // 선택 상태 업데이트
    setHighlightedSlot(null);         // 하이라이트 해제
  };

  // ─── 노드 열림/닫힘 토글 ───
  const toggleExpand = (name: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); // 이미 확장되어 있으면 닫기
      else next.add(name);                    // 열려있지 않으면 확장
      return next;
    });
  };

  // ─── 수동 새로고침 버튼 핸들러 ───
  const handleManualRefresh = async () => {
    try { await refetch(); alert('🔄 새로고침이 완료되었습니다!'); }
    catch { alert('🔄 새로고침 중 오류가 발생했습니다.'); }
  };

  // ─── 검색 기능 (machineId 기준, 대소문자 무시) ───
  const handleSearch = () => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) { alert('🔍 검색어를 입력하세요.'); return; }
    let found = false;
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
      {/* 헤더: 로고, 검색창, 새로고침 */}
      <header className="flex items-center p-4 bg-white shadow">
        <div className="text-4xl font-semibold text-orange-600" style={{ fontFamily: 'Semics, sans-serif' }}>SEMICS</div>
        <div className="flex-1 ml-20 mr-3 flex items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="검색어를 입력하세요..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button onClick={handleSearch} className="ml-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md">🔍 검색</button>
        </div>
        <button onClick={handleManualRefresh} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md">🔄 새로고침</button>
      </header>

      {/* 본문: 사이드바 + 메인 뷰 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바: 트리 구조 라인 선택 */}
        <aside className="w-64 shrink-0 bg-gray-800 text-gray-100 p-4">
          <h2 className="text-lg font-semibold border-b border-gray-700 pb-2 mb-2">📋 라인 선택</h2>
          <ul>
            {lineTree.map(node => (
              <li key={node.name}>
                {/* 트리 상위 노드 (본사/부항리/진우리) */}
                <div
                  className="flex items-center px-2 py-1 cursor-pointer hover:bg-gray-700"
                  onClick={() => toggleExpand(node.name)}
                >
                  <span className="mr-1 select-none">
                    {expandedNodes.has(node.name) ? '▾' : '▸'}
                  </span>
                  <span
                    className={`${selectedLine === node.name ? 'font-bold text-white' : 'text-gray-200'}`}
                    onClick={() => handleSelect(node.name)}
                  >
                    {node.name}
                  </span>
                </div>
                {/* 서브 라인: 확장된 경우에만 표시 */}
                {expandedNodes.has(node.name) && (
                  <ul className="pl-6 mt-1">
                    {node.children.map(child => (
                      <li key={child}>
                        <div
                          className={`px-2 py-1 cursor-pointer hover:bg-gray-700 ${selectedLine === child ? 'bg-gray-700' : ''}`}
                          onClick={() => handleSelect(child)}
                        >
                          {child}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* 세로 분리선 */}
        <div className="w-px bg-gray-400" />

        {/* 메인 뷰: 선택된 라인에 따라 렌더링 */}
        <main className="flex-1 p-6 overflow-auto">
          {isLoading && <p className="text-center text-gray-500 mt-20">데이터 불러오는 중…</p>}
          {isError && <p className="text-center text-red-500 mt-20">⚠️ 장비 정보를 불러오지 못했습니다.</p>}
          {!isLoading && !isError && (
            selectedLine === 'A동' || selectedLine === 'B동' || selectedLine === 'I라인'
            ? <ABuildingView equipMap={equipMap} highlightedSlot={highlightedSlot} />
            : <p className="text-center text-gray-500 mt-20"><span className="font-semibold">{selectedLine}</span> 배치도가 아직 준비되지 않았습니다.</p>
          )}
        </main>
      </div>
    </div>
  );
}
