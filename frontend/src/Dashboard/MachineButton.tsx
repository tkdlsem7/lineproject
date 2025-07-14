// 📁 src/features/Dashboard/MachineButton.tsx
import { Popover, Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

/* ────────────────────────────────────────────────────────── */
/* ① prop 타입 확장: slotCode + machineId + progress + shippingDate */
interface MachineButtonProps {
  slotCode: string;            // ex) "B6"
  machineId?: string | null;   // ex) "J-07-02"
  progress?: number | null;    // ex) 75
  shippingDate?: string | null; // ex) "2025-07-30"
}
/* ────────────────────────────────────────────────────────── */

/**
 * 배치도용 공용 버튼
 * - machineId / 진척도 / 출하일 표시
 * - 클릭 → 팝업 메뉴(체크리스트 / 장비 정보 입력) → 라우팅
 */
export default function MachineButton({ slotCode, machineId, progress, shippingDate }: MachineButtonProps) {
  const nav = useNavigate();

  /* URL용 ID: machineId 우선, 없으면 slotCode 사용 */
  const idForPath = machineId ?? slotCode;
  const go = (path: string) => () => nav(`/equipment/${idForPath}/${path}`);

  /* 출하일 포맷 (YYYY-MM-DD → MM-DD 로 잘라서 보여줌) */
  const formattedShippingDate = shippingDate ? shippingDate.slice(5) : '';

  return (
    <Popover className="relative">
      {/* 실제 클릭 영역 */}
      <Popover.Button
        aria-label={slotCode}
        className="w-32 h-20 rounded-md bg-indigo-600 hover:bg-indigo-700
                   transition active:scale-[.97] focus:outline-none shadow-lg
                   flex flex-col items-center justify-center text-white text-xs font-medium space-y-[2px] text-center"
      >
        {/* 버튼 내부 표시 */}
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
          </Menu>
        </Popover.Panel>
      </Transition>
    </Popover>
  );
}
