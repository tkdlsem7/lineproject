// 📁 src/features/Dashboard/Dashboard.tsx
import React, { useState, useMemo } from 'react';
import ABuildingView from './ABuildingView';               // A동 전체 배치도 구성 컴포넌트
import { useEquipProgress } from '../hooks/useEquipProgress'; // ⭐ 장비 진척도 가져오는 커스텀 훅 (React Query 사용)

// 🧩 Dashboard 컴포넌트 정의
function Dashboard() {
  /* -------------------------- ✅ UI 상태 -------------------------- */
  const [selectedLine, setSelectedLine] = useState<string>('A동'); // 현재 선택된 라인(기본 A동)
  const lineList = ['A동', 'B동', 'I라인'];                        // 라인 목록 (추후 B동/I라인도 추가 예정)

  /* ------------------------ ✅ 서버에서 데이터 가져오기 ------------------------ */
  /**
   * FastAPI → /equip_progress API → React Query → useEquipProgress 훅으로 데이터 가져옴
   * 응답 데이터 구조 예시:
   * [
   *   {
   *     slot_code: "A3",
   *     machine_id: "J-08-01",
   *     progress: 100,
   *     shipping_date: "2025-08-20"
   *   },
   *   ...
   * ]
   */
  const {
    data: progressList = [],   // 요청 성공 시: 장비 배열 / 실패 또는 로딩 시: 빈 배열 fallback
    isLoading,
    isError,
  } = useEquipProgress();

  /* ------------------------ ✅ 데이터 가공 ------------------------ */
  /**
   * slot_code ➜ { machineId, progress, shippingDate } 형태로 빠르게 참조할 수 있도록 Map으로 변환
   * 예시:
   * {
   *   "A3": { machineId: "J-08-01", progress: 100, shippingDate: "2025-08-20" },
   *   ...
   * }
   */
  const equipMap = useMemo(() => {
    const map = new Map<
      string,
      { machineId: string; progress: number; shippingDate: string }
    >();

    // 서버에서 받아온 각 장비 데이터 → map에 저장
    progressList.forEach(({ slot_code, machine_id, progress, shipping_date }) => {
      map.set(slot_code, {
        machineId: machine_id,
        progress,
        shippingDate: shipping_date,
      });
    });

    return map;
  }, [progressList]);

  /* ------------------------ ✅ 라인 선택 핸들러 ------------------------ */
  const handleSelect = (line: string) => setSelectedLine(line);

  /* ------------------------ ✅ 렌더링 ------------------------ */
  return (
    <div className="flex h-screen">
      {/* ───────────── Sidebar: 라인 선택 메뉴 ───────────── */}
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

      {/* 세로 구분선 */}
      <div className="w-px bg-gray-400" />

      {/* ───────────── Main View: 배치도 영역 ───────────── */}
      <main className="flex-1 p-6 overflow-auto">
        {/* 로딩 중일 때 안내 문구 */}
        {isLoading && (
          <p className="text-center text-gray-500 mt-20">데이터 불러오는 중…</p>
        )}

        {/* 에러 발생 시 안내 문구 */}
        {isError && (
          <p className="text-center text-red-500 mt-20">
            ⚠️ 장비 정보를 불러오지 못했습니다.
          </p>
        )}

        {/* 데이터가 정상일 때만 배치도 렌더링 */}
        {!isLoading && !isError && (
          <>
            {/* A동이 선택되었을 때 ABuildingView 렌더링 */}
            {selectedLine === 'A동' && (
              <ABuildingView equipMap={equipMap} />
            )}

            {/* 추후 B동, I라인도 조건부 렌더링 추가 예정 */}
            {/* {selectedLine === 'B동' && <BBuildingView equipMap={equipMap} />} */}
            {/* {selectedLine === 'I라인' && <ILineView equipMap={equipMap} />} */}

            {/* 아직 컴포넌트 없는 라인일 경우 안내 메시지 */}
            {['A동'].includes(selectedLine) || (
              <p className="text-center text-gray-500 mt-20">
                <span className="font-semibold">{selectedLine}</span> 배치도가 아직 준비되지 않았습니다.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Dashboard;
