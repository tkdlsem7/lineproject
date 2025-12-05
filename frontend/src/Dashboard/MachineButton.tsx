import React from "react";
import { shipEquipment } from "./DashboardHandler";

const colorByProgress = (p: number) => {
  if (p >= 100) return "bg-green-600 text-white";
  if (p >= 50) return "bg-amber-500 text-white";
  if (p > 0) return "bg-blue-600 text-white";
  return "bg-gray-300 text-gray-700";
};

const LS = {
  
  SELECTED_IS_EMPTY: "selected_machine_is_empty",
  SELECTED_ID: "selected_machine_id",
  SELECTED_AT: "selected_machine_saved_at",
  INTENT: "machine_info_intent",
} as const;

const EMPTY_MARKERS = new Set(["", "-", "empty", "빈슬롯"]);

type InfoIntent = {
  machineId: string;
  fields: { progressEmpty: boolean; shipDateEmpty: boolean; managerEmpty: boolean };
  values: { progress: number | null; shipDate: string | null; manager: string | null };
  hasAnyEmpty: boolean;
  setAt: string;
  origin: "dashboard";
  version: 1;
};

type Props = {
  title: string;
  progress: number;
  shipDate?: string | Date | null;
  manager?: string | null;
  slotCode: string;                   
  sizeClass?: string;
  className?: string;
  isOpen?: boolean;
  onToggleMenu?: () => void;
  onOpenInfo?: () => void;
  onOpenChecklist?: (machineId: string) => void;
  onOpenMove?: (machineId: string) => void;
  onShipped?: (slotCode: string) => void;
};

export default function MachineButton({
  title,
  progress,
  shipDate,
  manager,
  slotCode,
  sizeClass = "w-[220px] h-[120px]",
  className = "",
  isOpen,
  onToggleMenu,
  onOpenInfo,
  onOpenChecklist,
  onOpenMove,
  onShipped,
}: Props) {
  const [openLocal, setOpenLocal] = React.useState(false);
  const open = typeof isOpen === "boolean" ? isOpen : openLocal;
  const toggle = () =>
    typeof isOpen === "boolean" ? onToggleMenu?.() : setOpenLocal((v) => !v);

  const lastToken = React.useMemo(() => {
    const raw = title ?? "";
    const parts = raw.split(/[/|>]/); // 전역 confirm ESLint 등의 경고 피하려 escape 제거
    const tail = parts[parts.length - 1] ?? "";
    return tail.trim().toLowerCase();
  }, [title]);

  const isEmptyMachine = React.useMemo(() => EMPTY_MARKERS.has(lastToken), [lastToken]);

  const shipDateText = React.useMemo(() => {
    if (!shipDate) return "-";
    if (shipDate instanceof Date) return shipDate.toISOString().slice(0, 10);
    return String(shipDate);
  }, [shipDate]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (isEmptyMachine) {
        localStorage.setItem(LS.SELECTED_IS_EMPTY, "1");
        localStorage.removeItem(LS.SELECTED_ID);
        localStorage.removeItem(LS.INTENT);
        (window as any).__MACHINE_INFO_INTENT__ = undefined;
      } else {
        localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
        localStorage.setItem(LS.SELECTED_ID, title);
        localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
      }
    } catch {}
    toggle();
  };

  const buildInfoIntent = (): InfoIntent => {
    if (isEmptyMachine) {
      return {
        machineId: "",
        fields: { progressEmpty: true, shipDateEmpty: true, managerEmpty: true },
        values: { progress: null, shipDate: null, manager: null },
        hasAnyAny: true,
        hasAnyEmpty: true,
        setAt: new Date().toISOString(),
        origin: "dashboard",
        version: 1 as const,
      } as any;
    }
    const progressEmpty = !Number.isFinite(progress);
    const shipDateEmpty = shipDateText === "-";
    const managerEmpty = !manager || manager.trim().length === 0;
    return {
      machineId: title ?? "",
      fields: { progressEmpty, shipDateEmpty, managerEmpty },
      values: {
        progress: Number.isFinite(progress) ? progress : null,
        shipDate: shipDateEmpty ? null : shipDateText,
        manager: manager ?? null,
      },
      hasAnyEmpty: progressEmpty || shipDateEmpty || managerEmpty,
      setAt: new Date().toISOString(),
      origin: "dashboard",
      version: 1 as const,
    };
  };

  const storeInfoIntent = (intent: InfoIntent) => {
    try { localStorage.setItem(LS.INTENT, JSON.stringify(intent)); } catch {}
    (window as any).__MACHINE_INFO_INTENT__ = intent;
  };

  const handleOpenInfo = () => {
    try {
      const intent = buildInfoIntent();
      localStorage.setItem(LS.SELECTED_IS_EMPTY, isEmptyMachine ? "1" : "0");
      if (isEmptyMachine) {
        localStorage.removeItem(LS.SELECTED_ID);
      } else {
        localStorage.setItem(LS.SELECTED_ID, title);
        localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
      }
      storeInfoIntent(intent);
    } catch {}
    onOpenInfo?.();
  };

  const handleOpenChecklist = () => {
    if (isEmptyMachine) return window.alert("빈 슬롯은 체크리스트를 열 수 없습니다.");
    try {
      localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
      localStorage.setItem(LS.SELECTED_ID, title);
      localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
    } catch {}
    onOpenChecklist?.(title);
  };

  const handleOpenMove = () => {
    if (isEmptyMachine) return window.alert("빈 슬롯은 이동할 장비가 없습니다.");
    try {
      localStorage.setItem(LS.SELECTED_IS_EMPTY, "0");
      localStorage.setItem(LS.SELECTED_ID, title);
      localStorage.setItem(LS.SELECTED_AT, new Date().toISOString());
    } catch {}
    onOpenMove?.(title);
  };

  const handleShip = async () => {

    // eslint-disable-next-line no-alert
    const ok = typeof window !== "undefined" &&
      window.confirm(`[${slotCode}] 슬롯의 ${title} 장비를 출하 처리할까요?`);
    if (!ok) return;

    try {
      await shipEquipment(slotCode);
      alert("출하 처리 완료!");
      setOpenLocal(false);
      onShipped?.(slotCode);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "출하 처리 중 오류가 발생했습니다.");
    }
  };

  const menuItems = [
    { label: "🛠 장비 정보 입력", onClick: handleOpenInfo },
    { label: "✅ 체크리스트", onClick: handleOpenChecklist },
    { label: "🔁 장비 이동", onClick: handleOpenMove },
    { label: "🚚 출하 처리", onClick: handleShip },
  ];

  return (
    <div
      data-card-root="1"
      className={`relative ${sizeClass} rounded-2xl px-4 py-3 shadow-md ${colorByProgress(progress)} ${className}`}
      onClick={handleClick}
      title="메뉴 보기"
    >
      <div className="text-base sm:text-lg font-extrabold leading-6">{title || "-"}</div>

      <div className="mt-1 text-[12px] sm:text-[13px] leading-5 opacity-95">
        <div>진척도: {Number.isFinite(progress) ? `${progress}%` : "-"}</div>
        <div>
          출하: {shipDateText}
          {Number.isFinite(progress) && progress >= 100 && (
            <span className="ml-2 rounded bg-white/20 px-1.5 py-[1px] text-[10px]">출하 준비됨</span>
          )}
        </div>
        <div>담당: {manager ?? "-"}</div>
      </div>

      {open && (
        <div
          data-menu-root="1"
          className="absolute left-0 top-full z-50 mt-2 w-[220px] rounded-2xl border bg-white p-2 text-slate-800 shadow-2xl"
          onClick={(ev) => ev.stopPropagation()}
        >
          {menuItems.map((mi) => (
            <button
              key={mi.label}
              type="button"
              onClick={(ev) => { ev.stopPropagation(); mi.onClick(); }}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[15px] hover:bg-slate-50"
            >
              {mi.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
