// 📁 src/features/Dashboard/MachineButton.tsx
/* ────────────────────────────────────────────────────────── */
/* UI · 네트워크 라이브러리 */
import { Popover, Menu, Transition } from '@headlessui/react';
import React, { Fragment, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDeleteEquipmentLog } from '../hooks/equipmentdel';   // 삭제 Mutation
import { useShipEquipment }    from '../hooks/shipdate';         // 출하 Mutation

/* ────────────────────────────────────────────────────────── */
/* ① prop 타입 확장: site 추가                                */
export interface MachineButtonProps {
  slotCode:     string;              // ex) "B6"
  machineId?:   string | null;       // ex) "J-07-02"
  manager?:     string | null;       // ex) "홍길동"
  progress?:    number | null;       // ex) 75
  shippingDate?: string | null;      // ex) "2025-07-30"
  bgClass?:     string;              // ABuildingView에서 주입
  site:         string;              // ★ NEW: '본사' | '부항리' | '진우리'
}
/* ────────────────────────────────────────────────────────── */

const MachineButton = forwardRef<HTMLButtonElement, MachineButtonProps>(
  function MachineButton(
    {
      slotCode,
      machineId,
      manager,
      progress,
      shippingDate,
      bgClass,
      site,                         /* ★ NEW */
    },
    ref
  ) {
    /* ─── 훅 ─── */
    const nav = useNavigate();
    const shipMutation = useShipEquipment();
    const delMutation  = useDeleteEquipmentLog();

    /* ─── 공통 파생 값 ─── */
    const shipTargetId   = machineId ?? slotCode;
    const dateText       = shippingDate ? `출하: ${shippingDate.slice(5)}` : '';
    const managerText    = manager ? ` (${manager})` : '';
    const dateManager    = dateText || manager ? `${dateText}${managerText}` : '';
    const baseStyle      = bgClass ?? 'bg-indigo-600 hover:bg-indigo-700 text-white';

    /* ② 페이지 이동: site 를 쿼리스트링으로 붙여 전파 --------------- */
    const go = (path: string) => () =>
      nav(
        `/equipment/${shipTargetId}/${path}?site=${encodeURIComponent(site)}`
      );

    /* ──────────────────────────────────────────────────────────── */
    return (
      <Popover className="relative">
        {/* ▼ 버튼 본체 */}
        <Popover.Button
          ref={ref}
          aria-label={slotCode}
          className={`w-32 h-20 rounded-md transition active:scale-[.97]
                     focus:outline-none shadow-lg flex flex-col items-center
                     justify-center text-xs font-medium space-y-[2px] text-center
                     ${baseStyle}`}
        >
          <span className="text-sm font-semibold">
            {machineId ?? ''}
          </span>
          <span>{progress != null ? `진척도: ${progress}%` : ''}</span>
          <span>{dateManager}</span>
        </Popover.Button>

        {/* ▼ 팝업 메뉴 */}
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="scale-95 opacity-0"
          enterTo="scale-100 opacity-100"
          leave="transition ease-in duration-75"
          leaveFrom="scale-100 opacity-100"
          leaveTo="scale-95 opacity-0"
        >
          <Popover.Panel
            className="absolute z-20 mt-2 w-44 rounded-md bg-white
                       shadow-lg ring-1 ring-black/10"
          >
            <Menu as="div" className="p-1 space-y-1">
              {/* 1) 체크리스트 */}
              <Menu.Item>
                {({ active }) => {
                  const disabled = !machineId;
                  return (
                    <button
                      onClick={
                        disabled
                          ? () => alert('먼저 장비를 입고시켜주세요.')
                          : go('checklist')
                      }
                      disabled={disabled}
                      className={`w-full px-3 py-2 text-left rounded ${
                        disabled
                          ? 'cursor-not-allowed text-gray-400'
                          : active
                          ? 'bg-gray-100'
                          : ''
                      }`}
                    >
                      ✔️ 체크리스트
                    </button>
                  );
                }}
              </Menu.Item>

              {/* 2) 장비 정보 입력 */}
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

              {/* 3) 출하 처리 */}
              <Menu.Item>
                {({ active }) => {
                  const disabled = !machineId;
                  return (
                    <button
                      onClick={
                        disabled
                          ? () => alert('먼저 장비를 입고시켜주세요.')
                          : () => {
                              if (window.confirm('정말로 출하 하겠습니까?')) {
                                /* 출하 → 성공 후 새로고침 */
                                shipMutation.mutate(shipTargetId, {
                                  onSuccess: () => window.location.reload(),
                                });
                                /* 로그 정리 */
                                delMutation.mutate({ machineNo: shipTargetId });
                                alert('출하가 완료되었습니다.');
                              }
                            }
                      }
                      disabled={disabled || shipMutation.isPending}
                      className={`w-full px-3 py-2 text-left rounded ${
                        disabled
                          ? 'cursor-not-allowed text-gray-400'
                          : active
                          ? 'bg-gray-100'
                          : ''
                      } ${shipMutation.isPending ? 'opacity-50' : ''}`}
                    >
                      🚚 출하 처리
                    </button>
                  );
                }}
              </Menu.Item>
            </Menu>
          </Popover.Panel>
        </Transition>
      </Popover>
    );
  }
);

export default MachineButton;
