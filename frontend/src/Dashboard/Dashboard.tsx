/**
 * Dashboard.tsx
 * ① 라인(동) 선택 사이드바
 * ② 선택된 라인의 배치도(ABuildingView 등) 표시
 *    ─ slot_code ↔ machine_id 매핑은 progressMap 으로 넘김
 */
import React, { useState, useMemo } from 'react';
import ABuildingView from './ABuildingView';   // A동(=A~E라인) 배치도
// TODO: B동·I라인이 준비되면 같은 방식으로 import
// import BBuildingView from './BBuildingView';
// import ILineView     from './ILineView';

import { useEquipProgress } from '../hooks/useEquipProgress'; // ⭐ 새로 추가 (경로는 프로젝트 구조에 맞게 조정)

function Dashboard() {
  /* ----------------------------- UI state ----------------------------- */
  const [selectedLine, setSelectedLine] = useState<string>('A동'); // 기본 A동
  const lineList = ['A동', 'B동', 'I라인'];                        // 라인(동) 목록

  /* --------------------------- 서버 데이터 ---------------------------- */
  /**
   * FastAPI → `/equip-progress` → @tanstack/react-query
   *  - data: [{ slot_code: 'A3', machine_id: 'J-08-01' }, ...]
   *  - isLoading, isError: 로딩/에러 상태 플래그
   */
  const {
    data: progressList = [],   // 네트워크 OK → 배열 / 로딩·에러 시 fallback
    isLoading,
    isError,
  } = useEquipProgress();

  /**
   * slot_code ➜ machine_id 매핑을 O(1)로 조회하기 위해
   * 배열 → Map 으로 변환 (useMemo 로 재연산 최소화)
   */
  const progressMap = useMemo(() => {
    const map = new Map<string, string>();
    progressList.forEach(({ slot_code, machine_id }) => {
      map.set(slot_code, machine_id);
    });
    return map;
  }, [progressList]);

  /* --------------------------- handlers ---------------------------- */
  const handleSelect = (line: string) => setSelectedLine(line);

  /* --------------------------- render ------------------------------ */

  const query = useEquipProgress();
  console.log("query.error →", query.error);

  return (
    <div className="flex h-screen">
      {/* ─────────────── Sidebar ─────────────── */}
      <aside className="w-52 shrink-0 bg-gray-800 text-gray-100">
        <h2 className="px-4 py-3 text-lg font-semibold border-b border-gray-700">
          📋 라인 선택
        </h2>
        <ul>
          {lineList.map((line) => (
            <li
              key={line}
              onClick={() => handleSelect(line)}
              className={`px-4 py-2 cursor-pointer hover:bg-gray-700
                          ${selectedLine === line ? 'bg-gray-700' : ''}`}
            >
              {line}
            </li>
          ))}
        </ul>
      </aside>

      {/* 세로 구분선 */}
      <div className="w-px bg-gray-400" />

      {/* ─────────────── Main View ─────────────── */}
      <main className="flex-1 p-6 overflow-auto">
        {/* 1) 로딩/에러 안내 */}
        {isLoading && (
          <p className="text-center text-gray-500 mt-20">데이터 불러오는 중…</p>
        )}
        {isError && (
          <p className="text-center text-red-500 mt-20">
            ⚠️ 장비 정보를 불러오지 못했습니다.
          </p>
        )}

        {/* 2) 정상일 때만 배치도 렌더링 */}
        {!isLoading && !isError && (
          <>
            {selectedLine === 'A동' && (
              /** progressMap을 prop으로 전달(⭐) */
              <ABuildingView progressMap={progressMap} />
            )}

            {/* B동·I라인 컴포넌트가 준비되면 아래처럼 조건부 렌더링 추가 */}
            {/* {selectedLine === 'B동' && <BBuildingView progressMap={progressMap} />} */}
            {/* {selectedLine === 'I라인' && <ILineView     progressMap={progressMap} />} */}

            {/* 선택된 라인에 컴포넌트가 아직 없으면 안내 메시지 */}
            {['A동'].includes(selectedLine) || (
              <p className="text-center text-gray-500 mt-20">
                <span className="font-semibold">{selectedLine}</span> 배치도가 아직
                준비되지 않았습니다.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}



export default Dashboard;
