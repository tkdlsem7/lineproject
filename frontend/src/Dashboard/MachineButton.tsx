// 📁 src/features/Dashboard/MachineButton.tsx
import { Popover, Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * 배치도용 공용 버튼
 * - 버튼 자체에는 텍스트가 없고(빈 사각형) ID를 aria-label로만 남김
 * - 클릭 → 팝업 메뉴(체크리스트 / 장비 정보 입력) → 라우팅
 */
export default function MachineButton({ id }: { id: string }) {
  const nav = useNavigate();
  const go = (path: string) => () => nav(`/equipment/${id}/${path}`);

  return (
    <Popover className="relative">
      {/* 실제 클릭 영역(빈 사각형) */}
      <Popover.Button
        aria-label={id}
        className="w-32 h-16 rounded-md bg-indigo-600 hover:bg-indigo-700
                   transition active:scale-[.97] focus:outline-none shadow-lg"
      />

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
