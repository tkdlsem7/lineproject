// 📁 src/features/Dashboard/ABuildingView.tsx
import React from 'react';
import MachineButton from './MachineButton';

interface LineSection {
  title: string;
  machines: string[];
}

/* ───── A~F 라인 장비 목록 (예시 10대씩) ───── */
const lineSections: LineSection[] = [
  { title: 'A라인', machines: ['A5', 'A4', 'A3', 'A2', 'A1', 'A10', 'A9', 'A8', 'A7', 'A6'] },
  { title: 'B라인', machines: ['B5', 'B4', 'B3', 'B2', 'B1', 'B10', 'B9', 'B8', 'B7', 'B6'] },
  { title: 'C라인', machines: ['C5', 'C4', 'C3', 'C2', 'C1', 'C10', 'C9', 'C8', 'C7', 'C6'] },
  { title: 'D라인', machines: ['D5', 'D4', 'D3', 'D2', 'D1', 'D10', 'D9', 'D8', 'D7', 'D6'] },
  { title: 'E라인', machines: ['E5', 'E4', 'E3', 'E2', 'E1', 'E10', 'E9', 'E8', 'E7', 'E6'] },
  { title: 'F라인', machines: ['F5', 'F4', 'F3', 'F2', 'F1', 'F10', 'F9', 'F8', 'F7', 'F6'] },
];

function ABuildingView() {
  const leftLines  = ['B라인', 'D라인', 'F라인'];
  const rightLines = ['A라인', 'C라인', 'E라인'];

  const renderLine = ({ title, machines }: LineSection) => (
    <section key={title} className="mb-20">
      <h3 className="text-2xl font-bold text-center mb-6">{title}</h3>

      {/* 버튼 간격(gap-x/y)과 버튼 크기(w-32 h-16)는 Tailwind util로 조정 */}
      <div className="grid grid-cols-5 gap-x-12 gap-y-12">
        {machines.map((name) => (
          <div key={name} className="flex flex-col items-center gap-3">
            <span className="font-semibold">{name}</span>
            <MachineButton id={name} />
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div className="flex gap-10">
      {/* ─── 좌측 컬럼 (B, D, F) ─── */}
      <div className="flex-1">
        {lineSections.filter((s) => leftLines.includes(s.title)).map(renderLine)}
      </div>

      {/* 중앙 세로선 */}
      <div className="w-px bg-gray-400" />

      {/* ─── 우측 컬럼 (A, C, E) ─── */}
      <div className="flex-1">
        {lineSections.filter((s) => rightLines.includes(s.title)).map(renderLine)}
      </div>
    </div>
  );
}

export default ABuildingView;
