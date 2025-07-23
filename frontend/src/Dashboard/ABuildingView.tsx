// 📁 src/features/Dashboard/ABuildingView.tsx
import React, { useEffect, useRef } from 'react';
import MachineButton from './MachineButton';

/* ── 데이터 타입 ─────────────────────────────────────────── */
export type EquipInfo = {
  machineId: string;
  progress: number;
  shippingDate: string;
};

interface LineSection {
  title: string;
  machines: string[];
}

const lineSections: LineSection[] = [
  { title: 'A라인', machines: ['A5','A4','A3','A2','A1','A10','A9','A8','A7','A6'] },
  { title: 'B라인', machines: ['B5','B4','B3','B2','B1','B10','B9','B8','B7','B6'] },
  { title: 'C라인', machines: ['C5','C4','C3','C2','C1','C10','C9','C8','C7','C6'] },
  { title: 'D라인', machines: ['D5','D4','D3','D2','D1','D10','D9','D8','D7','D6'] },
  { title: 'E라인', machines: ['E5','E4','E3','E2','E1','E10','E9','E8','E7','E6'] },
  { title: 'F라인', machines: ['F5','F4','F3','F2','F1','F10','F9','F8','F7','F6'] },
];

interface ABuildingViewProps {
  equipMap: Map<string, EquipInfo>;
  highlightedSlot: string | null;
}

/* ── ABuildingView ──────────────────────────────────────── */
export default function ABuildingView({ equipMap, highlightedSlot }: ABuildingViewProps) {
  /* 버튼 DOM 저장: slotCode → HTMLButtonElement */
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  /* 하이라이트 슬롯 변경 → 스크롤 + 링 강조 */
  useEffect(() => {
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
      <h3 className="text-2xl font-bold text-center mb-6">{title}</h3>

      <div className="grid grid-cols-5 gap-x-12 gap-y-12">
        {machines.map((slotCode) => {
          const info = equipMap.get(slotCode);
          const prog = info?.progress;

          /* 진척도 색상 계산 */
          let bgClass = 'bg-gray-100 hover:bg-gray-200';
          if (prog !== undefined) {
            if (prog < 30)       bgClass = 'bg-blue-600 hover:bg-blue-700 text-white';
            else if (prog < 60)  bgClass = 'bg-yellow-500 hover:bg-yellow-600 text-white';
            else if (prog < 100) bgClass = 'bg-green-600 hover:bg-green-700 text-white';
            else                 bgClass = 'bg-orange-600 hover:bg-orange-700 text-white';
          }

          return (
            <MachineButton
              key={slotCode}
              ref={(el) => { if (el) buttonRefs.current.set(slotCode, el); }}
              slotCode={slotCode}
              machineId={info?.machineId}
              progress={info?.progress}
              shippingDate={info?.shippingDate}
              bgClass={bgClass}
            />
          );
        })}
      </div>
    </section>
  );

  /* 레이아웃: 좌 (B·D·F) / 구분선 / 우 (A·C·E) */
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
