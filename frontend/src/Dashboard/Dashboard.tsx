import React, { useState } from 'react';
import ABuildingView from './ABuildingView';       // A동(=A~E라인) 배치도
// TODO: B동·I라인이 준비되면 같은 방식으로 import
// import BBuildingView from './BBuildingView';
// import ILineView     from './ILineView';

function Dashboard() {
  /** ----------------------------- state ----------------------------- */
  const [selectedLine, setSelectedLine] = useState<string>('A동');  // 기본 A동

  /** 라인(동) 목록 – 필요 시 자유롭게 확장 */
  const lineList = ['A동', 'B동', 'I라인'];

  /** --------------------------- handlers ---------------------------- */
  const handleSelect = (line: string) => setSelectedLine(line);

  /** --------------------------- render ------------------------------ */
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
        {selectedLine === 'A동' && <ABuildingView />}

        {/* B동·I라인 컴포넌트가 준비되면 아래처럼 조건부 렌더링 추가 */}
        {/* {selectedLine === 'B동' && <BBuildingView />} */}
        {/* {selectedLine === 'I라인' && <ILineView     />} */}

        {/* 선택된 라인에 컴포넌트가 아직 없으면 안내 메시지 */}
        {['A동'].includes(selectedLine) || (
          <p className="text-center text-gray-500 mt-20">
            <span className="font-semibold">{selectedLine}</span> 배치도가 아직 준비되지
            않았습니다.
          </p>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
