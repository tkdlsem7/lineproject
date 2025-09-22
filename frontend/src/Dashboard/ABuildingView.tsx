// A동 대시보드 뷰
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MachineButton from "./MachineButton";
import type { SlotRow } from "./DashboardHandler";

const TILE_W = "w-[220px]";
const TILE_H = "h-[120px]";
const GAP = "gap-6";
const pulseRing = "ring-4 ring-indigo-400 ring-offset-2 animate-pulse";
const LEFT = ["B", "D", "F"] as const;
const RIGHT = ["A", "C", "E"] as const;

const LS = {
  SELECTED_SITE: "selected_site",
  SELECTED_LINE: "selected_line",
  SELECTED_SLOT: "selected_slot",
  SELECTED_ID: "selected_machine_id",
  SELECTED_IS_EMPTY: "selected_machine_is_empty",
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
  try { localStorage.setItem(LS.INTENT, JSON.stringify(intent)); } catch {}
  (window as any).__MACHINE_INFO_INTENT__ = intent;
}

const safeGet = (k: string, def: string) => {
  try {
    const v = localStorage.getItem(k);
    return v && v.trim() ? v : def;
  } catch {
    return def;
  }
};

type LineSectionProps = {
  lineChar: string;
  equipMap: Map<string, SlotRow>;
  highlightedSlot: string | null;
  openMenuId: string | null;
  onToggleMenu: (slot: string) => void;
  goInfoCreate: (slot: string) => void;
  goInfoEdit: (slot: string, machineId: string) => void;
  goChecklist: (slot: string, machineId: string) => void;
  goMove: (slot: string, machineId: string) => void;
  onShipped?: (slotCode: string) => void;
};

function LineSection({
  lineChar,
  equipMap,
  highlightedSlot,
  openMenuId,
  onToggleMenu,
  goInfoCreate,
  goInfoEdit,
  goChecklist,
  goMove,
  onShipped,
}: LineSectionProps) {
  const codes = useMemo(
    () => Array.from({ length: 10 }, (_, i) => `${lineChar}${i + 1}`),
    [lineChar]
  );

  return (
    <section className="mb-14">
      <h3 className="mb-5 text-xl sm:text-2xl font-semibold text-slate-900">{lineChar}라인</h3>

      <div className={`grid grid-cols-5 ${GAP}`}>
        {codes.map((code) => {
          const row = equipMap.get(code.toUpperCase()) ?? null;
          const isHighlight = !!row && highlightedSlot === row?.slot_code;
          const baseTile = `rounded-2xl shadow-md ${TILE_W} ${TILE_H}`;

          if (row && row.machine_id) {
            const machineId = row.machine_id as string;
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
                    slotCode={row.slot_code}                   // ✅ 필수
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

          // 빈 슬롯
          return (
            <div key={code} className="flex flex-col items-center">
              <div className="mb-2 text-xs font-medium text-slate-500">{code}</div>
              <button
                type="button"
                onClick={() => goInfoCreate(code)}
                className={`${baseTile} bg-slate-100 ${isHighlight ? pulseRing : ""} flex items-center justify-center hover:ring-2 hover:ring-indigo-300`}
                title="장비 정보 입력으로 이동"
              >
                <span className="text-xs text-slate-400">빈 슬롯</span>
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span className="inline-block rounded-full bg-blue-600 px-2 py-0.5 text-white">1–49%</span>
      <span className="inline-block rounded-full bg-amber-500 px-2 py-0.5 text-white">50–99%</span>
      <span className="inline-block rounded-full bg-green-600 px-2 py-0.5 text-white">100% (출하 준비)</span>
      <span className="inline-block rounded-full bg-gray-300 px-2 py-0.5 text-gray-700">빈 슬롯</span>
    </div>
  );
}

export default function ABuildingView({
  equipMap,
  highlightedSlot,
  onShipped,
}: {
  equipMap: Map<string, SlotRow>;
  highlightedSlot: string | null;
  onShipped?: (slotCode: string) => void;
}) {
  const navigate = useNavigate();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const onToggleMenu = useCallback((slotCode: string) => {
    setOpenMenuId((cur) => (cur === slotCode ? null : slotCode));
  }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest?.("[data-menu-root='1']") || el.closest?.("[data-card-root='1']")) return;
      setOpenMenuId(null);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  const siteLabel = safeGet("selected_site", "본사");
  const lineLabel = safeGet("selected_line", "A동");

  const goForm = (mode: "create" | "edit", slotCode: string, machineId?: string) => {
    try {
      localStorage.setItem(LS.SELECTED_SITE, siteLabel);
      localStorage.setItem(LS.SELECTED_LINE, lineLabel);
      localStorage.setItem(LS.SELECTED_SLOT, slotCode);

      if (machineId && machineId.trim()) {
        localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
        localStorage.setItem(LS.SELECTED_ID, machineId.trim());
        localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
      } else {
        localStorage.setItem(LS.SELECTED_IS_EMPTY, "1");
        localStorage.removeItem(LS.SELECTED_ID);
        localStorage.removeItem(LS.INTENT);
      }
    } catch {}

    const qs = new URLSearchParams({ mode, site: siteLabel, line: lineLabel, slot: slotCode });
    if (machineId && machineId.trim()) qs.set("machine", machineId.trim());
    navigate(`/equipment?${qs.toString()}`);
  };

  const goInfoCreate = (slotCode: string) => goForm("create", slotCode);

  const goInfoEdit = (slotCode: string, machineId: string) => {
    const row = equipMap.get(slotCode.toUpperCase());
    if (row) storeIntent(buildIntentFromRow(row));
    goForm("edit", slotCode, machineId);
  };

  const goChecklist = (slotCode: string, machineId: string) => {
    try {
      localStorage.setItem(LS.SELECTED_SITE, siteLabel);
      localStorage.setItem(LS.SELECTED_LINE, lineLabel);
      localStorage.setItem(LS.SELECTED_SLOT, slotCode);
      localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
      localStorage.setItem(LS.SELECTED_ID, machineId.trim());
      localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
    } catch {}
    navigate(`/progress-checklist?machine_id=${encodeURIComponent(machineId.trim())}`);
  };

  const goMove = (slotCode: string, machineId: string) => {
    try {
      localStorage.setItem(LS.SELECTED_SITE, siteLabel);
      localStorage.setItem(LS.SELECTED_LINE, lineLabel);
      localStorage.setItem(LS.SELECTED_SLOT, slotCode);
      localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
      localStorage.setItem(LS.SELECTED_ID, machineId.trim());
      localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
    } catch {}
    const qs = new URLSearchParams({
      machine_id: machineId.trim(),
      site: siteLabel,
      line: lineLabel,
      slot: slotCode,
    });
    navigate(`/machine-move?${qs.toString()}`);
  };

  return (
    <div className="grid grid-cols-2 gap-12">
      <div className="pr-12 border-r">
        <Legend />
        {LEFT.map((g) => (
          <LineSection
            key={g}
            lineChar={g}
            equipMap={equipMap}
            highlightedSlot={highlightedSlot}
            openMenuId={openMenuId}
            onToggleMenu={onToggleMenu}
            goInfoCreate={goInfoCreate}
            goInfoEdit={goInfoEdit}
            goChecklist={goChecklist}
            goMove={goMove}
            onShipped={onShipped}
          />
        ))}
      </div>
      <div className="pl-12">
        <Legend />
        {RIGHT.map((g) => (
          <LineSection
            key={g}
            lineChar={g}
            equipMap={equipMap}
            highlightedSlot={highlightedSlot}
            openMenuId={openMenuId}
            onToggleMenu={onToggleMenu}
            goInfoCreate={goInfoCreate}
            goInfoEdit={goInfoEdit}
            goChecklist={goChecklist}
            goMove={goMove}
            onShipped={onShipped}
          />
        ))}
      </div>
    </div>
  );
}
