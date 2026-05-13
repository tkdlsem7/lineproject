type AnyEnv = Record<string, any>;

const getEnv = () => {
  const craEnv: AnyEnv =
    (typeof process !== "undefined" ? (process as any).env : {}) || {};

  const nodeEnv = craEnv.NODE_ENV || process.env.NODE_ENV || "development";

  let API_BASE = String(craEnv.REACT_APP_API_BASE || "").replace(/\/+$/, "");

  if (!API_BASE) {
    if (nodeEnv === "development") {
      API_BASE = "http://192.168.101.1:8000/api";
    } else {
      API_BASE = "";
    }
  }

  const rawPrefix = craEnv.REACT_APP_API_PREFIX ?? "/api";
  const API_PREFIX = rawPrefix
    ? `/${String(rawPrefix).replace(/^\/+/, "").replace(/\/+$/, "")}`
    : "";

  return { API_BASE, API_PREFIX };
};

const { API_BASE, API_PREFIX } = getEnv();

const buildUrl = (path: string) => {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${API_PREFIX}${p}`;
};

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

export type SlotStatus = "가능" | "불가능" | null;
export type ImprovementStatus = "need" | "done" | null;
export type RemodelProgressStatus = "planned" | "completed" | "io_done" | null;

export type SlotRow = {
  id: string;
  slot_code: string;
  machine_id: string | null;
  progress: number;
  shipping_date: string | null;
  manager: string | null;
  site: string | null;

  customer: string | null;
  serial_number: string | null;
  chiller_serial_number: string | null;

  note: string | null;
  status: SlotStatus;

  // ✅ equipment_remodel 에서 내려주는 상태
  improvement_status: ImprovementStatus;
  remodel_progress_status: RemodelProgressStatus;
};

const toDateString = (v: any): string | null => {
  if (!v) return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const normalizeStatus = (v: any): SlotStatus => {
  if (v === "가능") return "가능";
  if (v === "불가능") return "불가능";
  return null;
};

const normalizeImprovementStatus = (v: any): ImprovementStatus => {
  if (v === "need") return "need";
  if (v === "done") return "done";
  return null;
};

const normalizeRemodelProgressStatus = (v: any): RemodelProgressStatus => {
  if (v === "planned") return "planned";
  if (v === "completed") return "completed";
  if (v === "io_done") return "io_done";
  return null;
};

const normalizeSlotRow = (raw: any): SlotRow => {
  const progressNum = Number(raw?.progress);
  const progress = Number.isFinite(progressNum) ? progressNum : 0;

  return {
    id: raw?.id ?? raw?.slot_code ?? "",
    slot_code: String(raw?.slot_code ?? "").toUpperCase(),
    machine_id: raw?.machine_id ?? null,
    progress,
    shipping_date: toDateString(raw?.shipping_date),
    manager: raw?.manager ?? null,
    site: raw?.site ?? null,

    customer: raw?.customer ?? null,
    serial_number: raw?.serial_number ?? null,
    chiller_serial_number: raw?.chiller_serial_number ?? null,

    note: raw?.note ?? null,
    status: normalizeStatus(raw?.status),

    improvement_status: normalizeImprovementStatus(raw?.improvement_status),
    remodel_progress_status: normalizeRemodelProgressStatus(raw?.remodel_progress_status),
  };
};

export async function fetchSlots(opts: {
  site: string;
  building: "A" | "B" | "I" | "JIN";
}): Promise<SlotRow[]> {
  const qs = new URLSearchParams({ site: opts.site, building: opts.building }).toString();
  const path = `/dashboard/slots?${qs}`;

  const urls = Array.from(
    new Set([
      `/api${path}`,
      buildUrl(path),
      `${API_BASE}${path}`,
      path,
    ])
  );

  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    try {
      const res = await fetch(url, { credentials: "include", headers: { ...authHeaders() } });
      if (res.ok) {
        const rows = await res.json();
        return (Array.isArray(rows) ? rows : []).map(normalizeSlotRow);
      }
      if (res.status !== 404) {
        const text = await res.text().catch(() => "");
        throw new Error(`슬롯 조회 실패: ${res.status}${text ? ` - ${text}` : ""}`);
      }
    } catch (e) {
      if (i === urls.length - 1) throw e;
    }
  }
  throw new Error("슬롯 조회 실패: 모든 후보 URL 404");
}

export async function shipEquipment(slotCode: string): Promise<void> {
  const path = `/dashboard/ship/${encodeURIComponent(slotCode)}`;
  const urls = Array.from(
    new Set([
      `/api${path}`,
      buildUrl(path),
      `${API_BASE}${path}`,
      path,
    ])
  );

  let lastStatus = 0;
  let lastText = "";
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i];
    try {
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { ...authHeaders() },
      });
      if (res.ok) return;
      lastStatus = res.status;
      lastText = await res.text().catch(() => "");
      if (res.status !== 404) break;
    } catch (e) {
      if (i === urls.length - 1) throw e;
    }
  }
  throw new Error(`출하 처리 실패: ${lastStatus}${lastText ? ` - ${lastText}` : ""}`);
}
