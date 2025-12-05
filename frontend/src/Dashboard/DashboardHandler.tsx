// 대시보드 API 유틸 (fetch만, 훅 없음)

// -------------------- ENV & URL 조립 --------------------
type AnyEnv = Record<string, any>;

const getEnv = () => {
  const viteEnv: AnyEnv = ((import.meta as any)?.env ?? {}) as AnyEnv; // Vite
  const craEnv: AnyEnv =
    (typeof process !== "undefined" ? (process as any)?.env : {}) ?? {}; // CRA

  // 1) .env에 값이 있으면 그거 사용
  let API_BASE = String(
    viteEnv.VITE_API_BASE || craEnv.REACT_APP_API_BASE || ""
  ).replace(/\/+$/, "");

  // 2) 아무것도 없으면 우리 서버 기본값으로 고정
  if (!API_BASE) {
    API_BASE = "http://192.168.101.1:8000";
  }

  // PREFIX: 'api' 또는 '/api' 모두 허용, 기본은 '/api'
  const rawPrefix =
    viteEnv.VITE_API_PREFIX ?? craEnv.REACT_APP_API_PREFIX ?? "/api";
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

// -------------------- 타입 --------------------
export type SlotStatus = "가능" | "불가능" | null;

export type SlotRow = {
  id: string;
  slot_code: string;
  machine_id: string | null;
  progress: number;
  shipping_date: string | null;
  manager: string | null;
  site: string | null;

  // 프리필용 기타 필드
  customer: string | null;
  serial_number: string | null;
  note: string | null;
  status: SlotStatus;
};

// -------------------- 노멀라이저 --------------------
const toDateString = (v: any): string | null => {
  if (!v) return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

const normalizeSlotRow = (raw: any): SlotRow => {
  const statusRaw = raw?.status;
  const status: SlotStatus =
    statusRaw === "가능" ? "가능" : statusRaw === "불가능" ? "불가능" : null;

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
    note: raw?.note ?? null,
    status,
  };
};

// -------------------- API --------------------
/** 슬롯 목록 조회 (/api 경로 우선 + 폴백) */
export async function fetchSlots(opts: { site: string; building: "A" | "B" | "I" }): Promise<SlotRow[]> {
  const qs = new URLSearchParams({ site: opts.site, building: opts.building }).toString();
  const path = `/dashboard/slots?${qs}`;

  const urls = Array.from(
    new Set([
      `/api${path}`,            // ✅ CRA 프록시(동일 출처) 1순위
      buildUrl(path),           // VITE/CRA ENV 조합 (API_BASE+API_PREFIX)
      `${API_BASE}${path}`,     // BASE만 설정된 경우
      path,                     // 최후 폴백(동일 출처/리버스 프록시)
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

/** 출하 처리 (/api 경로 우선 + 폴백) */
export async function shipEquipment(slotCode: string): Promise<void> {
  const path = `/dashboard/ship/${encodeURIComponent(slotCode)}`;
  const urls = Array.from(
    new Set([
      `/api${path}`,            // ✅ CRA 프록시 1순위
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
