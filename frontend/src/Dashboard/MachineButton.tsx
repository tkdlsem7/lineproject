// 📁 src/features/Dashboard/MachineButton.tsx
/* ────────────────────────────────────────────────────────── */
/* UI · 네트워크 라이브러리 */
import { Popover, Menu, Transition } from '@headlessui/react';
import React, { Fragment, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {useDeleteEquipmentLog} from '../hooks/equipmentdel'
/* 🚚 출하 처리 Mutation 훅 */
import { useShipEquipment } from '../hooks/shipdate';

/* ────────────────────────────────────────────────────────── */
/* ① prop 타입: slotCode + machineId + progress + shippingDate + bgClass */
export interface MachineButtonProps {
  slotCode: string;              // ex) "B6"
  machineId?: string | null;     // ex) "J-07-02"
    manager?: string | null;  // ex) "2025-07-30"
  progress?: number | null;      // ex) 75
  shippingDate?: string | null;  // ex) "2025-07-30"
  bgClass?: string;              // ABuildingView에서 주입
}
/* ────────────────────────────────────────────────────────── */

/**
 * 📌 배치도용 버튼(MachineButton)
 *   • Popover 메뉴: 체크리스트 / 정보입력 / 출하
 *   • forwardRef: 부모가 스크롤·하이라이트 시 버튼 DOM 접근
 *   • bgClass: 진척도 색상·텍스트 컬러 주입
 */
const MachineButton = forwardRef<HTMLButtonElement, MachineButtonProps>(
  function MachineButton(
    { slotCode, machineId, manager, progress, shippingDate,bgClass },
    ref
  ) {
    const nav = useNavigate();

    /* 1) 출하 Mutation 훅 */
    const shipMutation = useShipEquipment();
    const delMutation = useDeleteEquipmentLog();
    /* 2) URL·Mutation 파라미터로 쓰일 고유 ID */
    const shipTargetId = machineId ?? slotCode;   // machineId 우선, 없으면 slotCode
    const dateText        = shippingDate ? `출하: ${shippingDate.slice(5)}` : '';
    const managerText     = manager ? ` (${manager})` : '';             // ★ 괄호로 구분
    const dateManagerLine = dateText || manager ? `${dateText}${managerText}` : '';

    /* 3) 페이지 이동 헬퍼 */
    const go = (path: string) => () => nav(`/equipment/${shipTargetId}/${path}`);

    /* 4) 출하일(YYYY-MM-DD) → MM-DD 로 표시 */

    /* 5) 기본 색상(fallback) ↔ 부모가 준 bgClass 우선 */
    const baseStyle =
      bgClass ?? 'bg-indigo-600 hover:bg-indigo-700 text-white';

    /* ─────────────────────────────────────────────────────── */

    return (
      <Popover className="relative">
        {/* ▼ 실제 버튼(기본 정보 표시) */}
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
          <span>
            {progress != null ? `진척도: ${progress}%` : ''}
          </span>
          <span>{dateManagerLine}</span>
        </Popover.Button>

        {/* ▼ 팝업 메뉴 (체크리스트 · 정보입력 · 출하) */}
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
                  const disabled = !machineId;                 // ★ 장비 미입고 여부
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

              {/* 2) 장비 정보 입력 → 입고/수정 모두 가능하니 그대로 둡니다 */}
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
                  const disabled = !machineId;                 // ★ 장비 미입고 여부
                  return (
                    <button
                      onClick={
                        disabled
                          ? () => alert('먼저 장비를 입고시켜주세요.')
                          : () => {
                              if (window.confirm('정말로 출하 하겠습니까?')) {
                                shipMutation.mutate(shipTargetId, {
                                  onSuccess: () => window.location.reload(),
                                });
                                delMutation.mutate({ machineNo: shipTargetId });
                                alert("출하가 완료되었습니다.");
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
