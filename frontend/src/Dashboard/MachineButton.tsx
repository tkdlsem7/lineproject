// 📁 src/features/Dashboard/MachineButton.tsx
import { Popover, Menu, Transition } from '@headlessui/react';
import React, { Fragment, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';

/* ────────────────────────────────────────────────────────── */
/* ① prop 타입: slotCode + machineId + progress + shippingDate + bgClass */
export interface MachineButtonProps {
  slotCode: string;            // ex) "B6"
  machineId?: string | null;   // ex) "J-07-02"
  progress?: number | null;    // ex) 75
  shippingDate?: string | null;// ex) "2025-07-30"
  bgClass?: string;            // ABuildingView에서 동적으로 주입
}
/* ────────────────────────────────────────────────────────── */

/**
 * 배치도용 버튼
 * - Popover + 메뉴(체크리스트 / 정보입력 / 출하)
 * - forwardRef: 버튼 DOM을 상위로 전달 → 스크롤·하이라이트
 * - bgClass: 진척도 색상·텍스트 컬러 주입
 */
const MachineButton = forwardRef<HTMLButtonElement, MachineButtonProps>(
  function MachineButton(
    { slotCode, machineId, progress, shippingDate, bgClass },
    ref
  ) {
    const nav = useNavigate();

    /* URL용 ID: machineId 우선, 없으면 slotCode 사용 */
    const idForPath = machineId ?? slotCode;
    const go = (path: string) => () => nav(`/equipment/${idForPath}/${path}`);

    /* 출하일(YYYY-MM-DD) → MM-DD 로 잘라 표시 */
    const formattedShippingDate = shippingDate ? shippingDate.slice(5) : '';

    /* 기본 색상 (indigo) 대신 부모가 준 bgClass 있으면 덮어씀 */
    const baseStyle =
      bgClass ??
      'bg-indigo-600 hover:bg-indigo-700 text-white'; // fallback

    return (
      <Popover className="relative">
        {/* 실제 클릭 영역 */}
        <Popover.Button
          ref={ref}
          aria-label={slotCode}
          className={`w-32 h-20 rounded-md transition active:scale-[.97]
                     focus:outline-none shadow-lg flex flex-col items-center
                     justify-center text-xs font-medium space-y-[2px] text-center
                     ${baseStyle}`}
        >
          <span className="text-sm font-semibold">{machineId ?? ''}</span>
          <span>{progress != null ? `진척도: ${progress}%` : ''}</span>
          <span>{formattedShippingDate ? `출하: ${formattedShippingDate}` : ''}</span>
        </Popover.Button>

        {/* ----- 팝업 메뉴 ----- */}
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="scale-95 opacity-0"
          enterTo="scale-100 opacity-100"
          leave="transition ease-in duration-75"
          leaveFrom="scale-100 opacity-100"
          leaveTo="scale-95 opacity-0"
        >
          <Popover.Panel className="absolute z-20 mt-2 w-44 rounded-md bg-white shadow-lg ring-1 ring-black/10">
            <Menu as="div" className="p-1">
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={go('checklist')}
                    className={`w-full px-3 py-2 text-left rounded ${
                      active ? 'bg-gray-100' : ''
                    }`}
                  >
                    ✔️ 체크리스트
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={go('edit')}
                    className={`w-full px-3 py-2 text-left rounded ${
                      active ? 'bg-gray-100' : ''
                    }`}
                  >
                    🛠 장비 정보 입력
                  </button>
                )}
              </Menu.Item>

              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={go('shipping')}
                    className={`w-full px-3 py-2 text-left rounded ${
                      active ? 'bg-gray-100' : ''
                    }`}
                  >
                    🚚 출하 처리
                  </button>
                )}
              </Menu.Item>
            </Menu>
          </Popover.Panel>
        </Transition>
      </Popover>
    );
  }
);

export default MachineButton;
