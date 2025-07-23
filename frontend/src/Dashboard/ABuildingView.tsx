import React, { useEffect, useRef } from 'react';

// 슬롯별 장비 정보를 담는 타입 정의
type EquipInfo = {
  machineId: string;
  progress: number;
  shippingDate: string;
};

// A~F 라인 장비 섹션 정의 타입
interface LineSection {
  title: string;
  machines: string[];
}

// A~F 라인별 슬롯 코드 예시
const lineSections: LineSection[] = [
  { title: 'A라인', machines: ['A5','A4','A3','A2','A1','A10','A9','A8','A7','A6'] },
  { title: 'B라인', machines: ['B5','B4','B3','B2','B1','B10','B9','B8','B7','B6'] },
  { title: 'C라인', machines: ['C5','C4','C3','C2','C1','C10','C9','C8','C7','C6'] },
  { title: 'D라인', machines: ['D5','D4','D3','D2','D1','D10','D9','D8','D7','D6'] },
  { title: 'E라인', machines: ['E5','E4','E3','E2','E1','E10','E9','E8','E7','E6'] },
  { title: 'F라인', machines: ['F5','F4','F3','F2','F1','F10','F9','F8','F7','F6'] },
];

// Dashboard로부터 받아올 props 타입
interface Props {
  equipMap: Map<string, EquipInfo>;
  highlightedSlot: string | null;
}

export default function ABuildingView({ equipMap, highlightedSlot }: Props) {
  // 버튼 DOM을 슬롯 코드별로 보관하는 ref
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  // highlightedSlot이 변경될 때마다 실행: 스크롤 + 하이라이트
  useEffect(() => {
    if (highlightedSlot) {
      const btn = buttonRefs.current.get(highlightedSlot);
      if (btn) {
        // 부드럽게 중앙에 스크롤
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Tailwind ring 클래스로 강조
        btn.classList.add('ring-4', 'ring-orange-400');
        // 3초 후 강조 해제
        setTimeout(() => {
          btn.classList.remove('ring-4', 'ring-orange-400');
        }, 3000);
      }
    }
  }, [highlightedSlot]);

  // 개별 슬롯 버튼 렌더링 함수
  const renderLine = ({ title, machines }: LineSection) => (
    <section key={title} className="mb-20">
      {/* 라인 제목 */}
      <h3 className="text-2xl font-bold text-center mb-6">{title}</h3>
      {/* 5열 그리드 레이아웃 */}
      <div className="grid grid-cols-5 gap-x-12 gap-y-12">
        {machines.map((slotCode) => {
          // equipMap에서 info 가져오기 (없으면 undefined)
          const info = equipMap.get(slotCode);
          // progress 값 추출 (없으면 undefined)
          const prog = info?.progress;
          // 배경색 결정
          let bgClass = 'bg-gray-100 hover:bg-gray-200';        // 기본: 데이터 없음
          if (prog !== undefined) {
            if (prog < 30) bgClass = 'bg-blue-600 hover:bg-blue-700 text-white';
            else if (prog < 60) bgClass = 'bg-yellow-500 hover:bg-yellow-600 text-white';
            else if (prog < 100) bgClass = 'bg-green-600 hover:bg-green-700 text-white';
            else /* prog === 100 */ bgClass = 'bg-orange-600 hover:bg-orange-700 text-white';
          }

          return (
            <button
              key={slotCode}
              // ref로 DOM 노드 저장
              ref={el => {
                if (el) buttonRefs.current.set(slotCode, el);
              }}
              // 클릭 시 진척도 알림 (정보 없으면 빈 문자열)
              onClick={() =>
                info
                  ? alert(`${slotCode} 진척도: ${info.progress}%\n출하일: ${info.shippingDate}`)
                  : undefined
              }
              // 고정 크기 + flex 중앙배치 + 동적 배경색
              className={`w-36 h-28 flex flex-col items-center justify-center p-2 rounded transition-colors ${bgClass}`}
            >
              {/*
                버튼 안 내용:
                - 슬롯 코드
                - 정보가 있을 때만 기계 ID, 진척도, 출하일 표시
              */}
              <span className="font-semibold">{slotCode}</span>
              {info && (
                <>
                  <span className="text-xs">{info.machineId}</span>
                  <span className="text-sm">{info.progress}%</span>
                  <span className="text-xs">{info.shippingDate}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );

  return (
    <div className="flex gap-10">
      {/* 좌측 컬럼: B, D, F 라인 */}
      <div className="flex-1">
        {lineSections
          .filter((s) => ['B라인', 'D라인', 'F라인'].includes(s.title))
          .map(renderLine)}
      </div>

      {/* 중앙 구분선 */}
      <div className="w-px bg-gray-400" />

      {/* 우측 컬럼: A, C, E 라인 */}
      <div className="flex-1">
        {lineSections
          .filter((s) => ['A라인', 'C라인', 'E라인'].includes(s.title))
          .map(renderLine)}
      </div>
    </div>
  );
}
