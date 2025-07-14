// 📁 src/features/Dashboard/MachineButton.tsx
import { Popover, Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

/* ────────────────────────────────────────────────────────── */
/* ① prop 타입 확장 : slotCode + machineId                   */
interface MachineButtonProps {
  slotCode: string;            // ex) "B6"
  machineId?: string | null;   // ex) "J-07-02" (없으면 undefined)
}
/* ────────────────────────────────────────────────────────── */

/**
 * 배치도용 공용 버튼
 * - 버튼 안에 machineId를 표시(없으면 빈칸)
 * - 클릭 → 팝업 메뉴(체크리스트 / 장비 정보 입력) → 라우팅
 */
export default function MachineButton({ slotCode, machineId }: MachineButtonProps) {
  const nav = useNavigate();

  /* ② URL용 ID: machineId 우선, 없으면 slotCode */
  const idForPath = machineId ?? slotCode;
  const go = (path: string) => () => nav(`/equipment/${idForPath}/${path}`);

  return (
    <Popover className="relative">
      {/* 실제 클릭 영역 */}
      <Popover.Button
        aria-label={slotCode}
        className="w-32 h-16 rounded-md bg-indigo-600 hover:bg-indigo-700
                   transition active:scale-[.97] focus:outline-none shadow-lg
                   flex items-center justify-center text-white text-sm font-medium"
      >
        {/* ③ 버튼 안에 machineId 표시 (없으면 공백) */}
        {machineId ?? ''}
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
          </Menu>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
