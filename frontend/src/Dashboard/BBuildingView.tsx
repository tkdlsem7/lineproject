import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MachineButton from "./MachineButton";
import type { SlotRow } from "./DashboardHandler";

const TILE_W = "w-[240px]";
const TILE_H = "h-[140px]";
const WRAP   = "mx-auto max-w-[1280px] px-2 md:px-4";
const COL_GAP_X = "gap-x-16";
const COL_GAP_Y = "gap-y-6";
const BLOCK_GAP = "gap-24 2xl:gap-36";
const pulseRing = "ring-4 ring-indigo-400 ring-offset-2 animate-pulse";

const LS = {
  SELECTED_SITE: "selected_site",
  SELECTED_LINE: "selected_line",
  SELECTED_SLOT: "selected_slot",
  SELECTED_IS_EMPTY: "selected_machine_is_empty",
  SELECTED_ID: "selected_machine_id",
  SELECTED_AT: "selected_machine_saved_at",
  INTENT: "machine_info_intent",
} as const;

type InfoIntent = {
  machineId: string;
  fields: { progressEmpty: boolean; shipDateEmpty: boolean; managerEmpty: boolean };
  values: {
    progress: number | null;
    shipDate: string | null;
    manager: string | null;
    customer?: string | null;
    serialNumber?: string | null;
    note?: string | null;
    status?: string | null;
  };
  hasAnyEmpty: boolean;
  setAt: string;
  origin: "dashboard";
  version: 1;
};

function buildIntentFromRow(row: SlotRow): InfoIntent {
  const p = Number.isFinite(row.progress as any) ? (row.progress as number) : NaN;
  const progressEmpty = !Number.isFinite(p);
  const shipDateEmpty = !row.shipping_date || String(row.shipping_date).trim().length === 0;
  const managerEmpty = !row.manager || String(row.manager).trim().length === 0;
  return {
    machineId: (row.machine_id ?? "").trim(),
    fields: { progressEmpty, shipDateEmpty, managerEmpty },
    values: {
      progress: !progressEmpty ? p : null,
      shipDate: (row.shipping_date as any) ?? null,
      manager: row.manager ?? null,
      customer: (row as any).customer ?? null,
      serialNumber: (row as any).serial_number ?? null,
      note: (row as any).note ?? null,
      status: (row as any).status ?? null,
    },
    hasAnyEmpty: progressEmpty || shipDateEmpty || managerEmpty,
    setAt: new Date().toISOString(),
    origin: "dashboard",
    version: 1 as const,
  };
}

function storeIntent(intent: InfoIntent) {
  try { localStorage.setItem("machine_info_intent", JSON.stringify(intent)); } catch {}
  (window as any).__MACHINE_INFO_INTENT__ = intent;
}

function setForCreate(slot: string, site = "본사", lineLabel = "B동") {
  try {
    localStorage.setItem(LS.SELECTED_SITE, site);
    localStorage.setItem(LS.SELECTED_LINE, lineLabel);
    localStorage.setItem(LS.SELECTED_SLOT, slot);
    localStorage.setItem(LS.SELECTED_IS_EMPTY, "1");
    localStorage.removeItem(LS.SELECTED_ID);
    localStorage.removeItem(LS.INTENT);
  } catch {}
}
function setForEdit(slot: string, machineId: string, site = "본사", lineLabel = "B동") {
  try {
    localStorage.setItem(LS.SELECTED_SITE, site);
    localStorage.setItem(LS.SELECTED_LINE, lineLabel);
    localStorage.setItem(LS.SELECTED_SLOT, slot);
    localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
    localStorage.setItem(LS.SELECTED_ID, machineId);
    localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
  } catch {}
}

type Props = {
  equipMap: Map<string, SlotRow>;
  highlightedSlot: string | null;
  onShipped?: (slotCode: string) => void;
};

const BBuildingView: React.FC<Props> = ({ equipMap, highlightedSlot, onShipped }) => {
  const navigate = useNavigate();

  // 왼쪽 H블럭(2열) / 오른쪽 G블럭(2열)
  const H_COL1 = useMemo(() => ["H16","H15","H14","H13","H12","H11","H10","H9"], []);
  const H_COL2 = useMemo(() => ["H8","H7","H6","H5","H4","H3","H2","H1"], []);
  const G_COL1 = useMemo(() => ["G16","G15","G14","G13","G12","G11","G10","G9"], []);
  const G_COL2 = useMemo(() => ["G8","G7","G6","G5","G4","G3","G2","G1"], []);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const onToggleMenu = (slot: string) => setOpenMenuId(cur => (cur === slot ? null : slot));

  const goInfoCreate = (slot: string) => {
    setForCreate(slot, "본사", "B동");
    const qs = new URLSearchParams({ mode: "create", site: "본사", line: "B동", slot });
    navigate(`/equipment?${qs.toString()}`);
  };
    const goInfoEdit = (slot: string, machineId: string) => {
    // 슬롯 row 찾아 INTENT 저장 → 폼 프리필
    const row = equipMap.get(slot.toUpperCase());
    if (row) storeIntent(buildIntentFromRow(row));

    setForEdit(slot, machineId, "본사", "B동"); // I동이면 "I동"
    const qs = new URLSearchParams({ mode: "edit", site: "본사", line: "B동", slot, machine: machineId });
    navigate(`/equipment?${qs.toString()}`);
    };
  const goChecklist = (slot: string, machineId: string) =>
    navigate(`/progress-checklist?machine_id=${encodeURIComponent(machineId)}`);
    const goMove = (slot: string, machineId: string) => {
    try {
        localStorage.setItem("selected_site", "본사");
        localStorage.setItem("selected_line", "B동"); // I동이면 I동
        localStorage.setItem("selected_slot", slot);
        localStorage.setItem("selected_machine_is_empty", "0");
        localStorage.setItem("selected_machine_id", machineId.trim());
        localStorage.setItem("selected_machine_saved_at", new Date().toISOString());
    } catch {}

    const qs = new URLSearchParams({
        machine_id: machineId.trim(),
        site: "본사",
        line: "B동", // I동이면 I동
        slot,        // ★ A동과 동일하게 slot 사용
    });
    navigate(`/machine-move?${qs.toString()}`); // ★ 경로도 A동과 동일
    };

  const renderTile = (code: string) => {
    const row = equipMap.get(code.toUpperCase()) ?? null;
    const isHighlight = !!row && highlightedSlot === row.slot_code;

    if (row?.machine_id) {
      const machineId = String(row.machine_id);
      const isOpen = openMenuId === row.slot_code;
      return (
        <div key={code} className="flex flex-col items-center">
          <div className="mb-2 text-xs font-medium text-slate-500">{code}</div>
          <div className={isHighlight ? pulseRing : ""}>
            <MachineButton
              title={machineId}
              progress={row.progress ?? 0}
              shipDate={row.shipping_date ?? null}
              manager={row.manager ?? null}
              slotCode={row.slot_code}
              sizeClass={`${TILE_W} ${TILE_H}`}
              isOpen={isOpen}
              onToggleMenu={() => onToggleMenu(row.slot_code)}
              onOpenInfo={() => goInfoEdit(row.slot_code, machineId)}
              onOpenChecklist={(mid) => goChecklist(row.slot_code, mid)}
              onOpenMove={(mid) => goMove(row.slot_code, mid)}
              onShipped={onShipped}
            />
          </div>
        </div>
      );
    }

    return (
      <div key={code} className="flex flex-col items-center">
        <div className="mb-2 text-xs font-medium text-slate-500">{code}</div>
        <button
          type="button"
          onClick={() => goInfoCreate(code)}
          className={`rounded-2xl shadow-md ${TILE_W} ${TILE_H} bg-slate-100 flex items-center justify-center hover:ring-2 hover:ring-indigo-300`}
          title="장비 정보 입력으로 이동"
        >
          <span className="text-xs text-slate-400">빈 슬롯</span>
        </button>
      </div>
    );
  };

  const renderColumn = (codes: string[]) => (
    <div className={`flex flex-col ${COL_GAP_Y}`}>{codes.map(renderTile)}</div>
  );

  return (
    <div className={`${WRAP} flex items-start justify-center ${BLOCK_GAP}`}>
      {/* 왼쪽 H 블록 */}
      <div className={`grid grid-cols-2 ${COL_GAP_X}`}>
        {renderColumn(H_COL1)}
        {renderColumn(H_COL2)}
      </div>

      {/* 오른쪽 G 블록 */}
      <div className={`grid grid-cols-2 ${COL_GAP_X}`}>
        {renderColumn(G_COL1)}
        {renderColumn(G_COL2)}
      </div>
    </div>
  );
};

export default BBuildingView;
