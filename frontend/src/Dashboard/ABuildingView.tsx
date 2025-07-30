// 📁 src/features/Dashboard/ABuildingView.tsx
import React, { useEffect, useRef } from 'react';
import MachineButton from './MachineButton';

/* ────────────────────────────────────────────────────────── */
/* ① 데이터 타입 정의                                          */
export type EquipInfo = {
  machineId: string;
  progress: number;
  manager?: string | null;
  shippingDate: string;
};

interface LineSection {
  title: string;
  machines: string[];
}

/* ② 라인별 슬롯 목록                                          */
const lineSections: LineSection[] = [
  { title: 'A라인', machines: ['A5', 'A4', 'A3', 'A2', 'A1', 'A10', 'A9', 'A8', 'A7', 'A6'] },
  { title: 'B라인', machines: ['B5', 'B4', 'B3', 'B2', 'B1', 'B10', 'B9', 'B8', 'B7', 'B6'] },
  { title: 'C라인', machines: ['C5', 'C4', 'C3', 'C2', 'C1', 'C10', 'C9', 'C8', 'C7', 'C6'] },
  { title: 'D라인', machines: ['D5', 'D4', 'D3', 'D2', 'D1', 'D10', 'D9', 'D8', 'D7', 'D6'] },
  { title: 'E라인', machines: ['E5', 'E4', 'E3', 'E2', 'E1', 'E10', 'E9', 'E8', 'E7', 'E6'] },
  { title: 'F라인', machines: ['F5', 'F4', 'F3', 'F2', 'F1', 'F10', 'F9', 'F8', 'F7', 'F6'] },
];

/* ────────────────────────────────────────────────────────── */
/* ③ 컴포넌트 Props                                           */
interface ABuildingViewProps {
  equipMap: Map<string, EquipInfo>; // slot_code → 정보
  highlightedSlot: string | null; // 검색 결과 하이라이트
  site: string; // 본사/부항리/진우리
}

/* ────────────────────────────────────────────────────────── */
/* ④ ABuildingView                                            */
export default function ABuildingView({
  equipMap,
  highlightedSlot,
  site,
}: ABuildingViewProps) {
  // 버튼 DOM 참조 저장
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /* 하이라이트 슬롯 변경 시 스크롤 */
  React.useEffect(() => {
    if (highlightedSlot) {
      const btn = buttonRefs.current.get(highlightedSlot);
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.classList.add('ring-4', 'ring-orange-400');
        setTimeout(() => btn.classList.remove('ring-4', 'ring-orange-400'), 3000);
      }
    }
  }, [highlightedSlot]);

  /* 라인 섹션 렌더러 */
  const renderLine = ({ title, machines }: LineSection) => (
    <section key={title} className="mb-20">
      <h3 className="mb-6 text-center text-2xl font-bold">{title}</h3>

      <div className="grid grid-cols-5 gap-x-12 gap-y-12">
        {machines.map(slotCode => {
          const info = equipMap.get(slotCode);
          const prog = info?.progress;

          /* 진척도별 ― 단일(녹색계열) 팔레트
             0~10%  : 흰색
             10~25% : green-50
             25~40% : green-100
             40~55% : green-200
             55~70% : green-300
             70~85% : green-500
             85~99% : green-700
             100%   : green-900
          ------------------------------------------------------------------ */
          let bgClass = 'bg-gray-100 hover:bg-gray-200';  // 데이터 없을 때

          if (prog !== undefined) {
            if (prog < 10)       bgClass = 'bg-white hover:bg-green-50';
            else if (prog < 25)  bgClass = 'bg-green-50 hover:bg-green-100';
            else if (prog < 40)  bgClass = 'bg-green-100 hover:bg-green-200';
            else if (prog < 55)  bgClass = 'bg-green-200 hover:bg-green-300';
            else if (prog < 70)  bgClass = 'bg-green-300 hover:bg-green-400';
            else if (prog < 85)  bgClass = 'bg-green-500 hover:bg-green-600 text-white';
            else if (prog < 100) bgClass = 'bg-green-700 hover:bg-green-800 text-white';
            else                 bgClass = 'bg-green-900 hover:bg-green-900 text-white';
          }

          return (
            <div key={slotCode} className="flex flex-col items-center gap-1">
              {/* 위치 라벨 */}
              <span className="text-xs font-mono text-gray-600">{slotCode}</span>

              {/* 장비 버튼 */}
              <MachineButton
                ref={el => {
                  if (el) buttonRefs.current.set(slotCode, el);
                }}
                slotCode={slotCode}
                machineId={info?.machineId}
                progress={info?.progress}
                manager={info?.manager}
                shippingDate={info?.shippingDate}
                bgClass={bgClass}
                site={site}
              />
            </div>
          );
        })}
      </div>
    </section>
  );

  /* 레이아웃: 좌(B·D·F) | 구분선 | 우(A·C·E) */
  return (
    <div className="flex gap-10 overflow-auto">
      <div className="flex-1">
        {lineSections
          .filter(s => ['B라인', 'D라인', 'F라인'].includes(s.title))
          .map(renderLine)}
      </div>
      <div className="w-px bg-gray-400" />
      <div className="flex-1">
        {lineSections
          .filter(s => ['A라인', 'C라인', 'E라인'].includes(s.title))
          .map(renderLine)}
      </div>
    </div>
  );
}
