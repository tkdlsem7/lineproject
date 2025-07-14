import React, { useState, useMemo } from 'react';
import ABuildingView from './ABuildingView';
import { useEquipProgress } from '../hooks/useEquipProgress'; // 장비 진척도 가져오기 hook

function Dashboard() {
  const [selectedLine, setSelectedLine] = useState<string>('A동');
  const lineList = ['A동', 'B동', 'I라인'];

  const {
    data: progressList = [],
    isLoading,
    isError,
  } = useEquipProgress();

  /**
   * ✅ slot_code ➜ { machineId, progress, shippingDate } 매핑 Map
   * ex) { A3 → { machineId: 'J-08-01', progress: 100, shippingDate: '2025-08-20' } }
   */
  const equipMap = useMemo(() => {
    const map = new Map<
      string,
      { machineId: string; progress: number; shippingDate: string }
    >();
    progressList.forEach(({ slot_code, machine_id, progress, shipping_date }) => {
      map.set(slot_code, {
        machineId: machine_id,
        progress,
        shippingDate: shipping_date,
      });
    });
    return map;
  }, [progressList]);

  const handleSelect = (line: string) => setSelectedLine(line);

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
              className={`px-4 py-2 cursor-pointer hover:bg-gray-700 ${
                selectedLine === line ? 'bg-gray-700' : ''
              }`}
            >
              {line}
            </li>
          ))}
        </ul>
      </aside>

      <div className="w-px bg-gray-400" />

      {/* ─────────────── Main View ─────────────── */}
      <main className="flex-1 p-6 overflow-auto">
        {isLoading && (
          <p className="text-center text-gray-500 mt-20">데이터 불러오는 중…</p>
        )}
        {isError && (
          <p className="text-center text-red-500 mt-20">
            ⚠️ 장비 정보를 불러오지 못했습니다.
          </p>
        )}

        {!isLoading && !isError && (
          <>
            {selectedLine === 'A동' && (
              // ✅ ABuildingView에 equipMap 넘김
              <ABuildingView equipMap={equipMap} />
            )}

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
