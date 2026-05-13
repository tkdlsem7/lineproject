export const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const getStoredToken = (): string | null => {
  return (
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token")
  );
};

export const authHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.detail) return String(data.detail);
  } catch {}

  try {
    const text = await res.text();
    if (text) return text;
  } catch {}

  return `요청 실패: ${res.status}`;
}

/* ------------------ 장비 목록 ------------------ */
export type EquipmentListItem = {
  id: number;
  machine_no: string;
  model?: string | null;
  customer_name?: string | null;
  cold_type?: string | null;
  current_status?: string | null;
  is_shipped: boolean;
  last_event_name?: string | null;
  last_event_date?: string | null;
};

export type EquipmentListResponse = {
  items: EquipmentListItem[];
  total: number;
  page: number;
  page_size: number;
};

export async function fetchEquipmentList(params: {
  search?: string;
  tab?: "pending" | "shipped" | "all";
  page?: number;
  page_size?: number;
}): Promise<EquipmentListResponse> {
  const q = new URLSearchParams({
    search: params.search ?? "",
    tab: params.tab ?? "pending",
    page: String(params.page ?? 1),
    page_size: String(params.page_size ?? 50),
  });

  const res = await fetch(`${API_BASE}/schedule-hub/equipment?${q.toString()}`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/* ------------------ 장비 상세 ------------------ */
export type ScheduleEvent = {
  id: number;
  source_type: string;
  event_type: string;
  event_name: string;
  event_date: string;
  status?: string | null;
  team_name?: string | null;
  mo_no?: string | null;
  previous_date?: string | null;
  is_changed: boolean;
  extra_data?: Record<string, any>;
};

export type EquipmentDetailResponse = {
  equipment: {
    id: number;
    machine_no: string;
    model?: string | null;
    customer_name?: string | null;
    stage_sn?: string | null;
    loader_sn?: string | null;
    cold_type?: string | null;
    mani_type?: string | null;
    current_status?: string | null;
    is_shipped: boolean;
    created_at?: string | null;
    updated_at?: string | null;
  };
  events: ScheduleEvent[];
  changed_count: number;
};

export async function fetchEquipmentDetail(
  equipmentId: number
): Promise<EquipmentDetailResponse> {
  const res = await fetch(`${API_BASE}/schedule-hub/equipment/${equipmentId}`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

/* ------------------ 업로드 히스토리 ------------------ */
export type UploadHistoryItem = {
  id: number;
  team_name: string;
  file_name: string;
  uploaded_by?: string | null;
  upload_status: string;
  message?: string | null;
  created_at: string;
};

export async function fetchUploadHistory(): Promise<UploadHistoryItem[]> {
  const res = await fetch(`${API_BASE}/schedule-hub/upload-history`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadScheduleExcel(params: {
  team_name: string;
  uploaded_by?: string;
  file: File;
}): Promise<any> {
  const formData = new FormData();
  formData.append("team_name", params.team_name);
  formData.append("uploaded_by", params.uploaded_by ?? "");
  formData.append("file", params.file);

  const res = await fetch(`${API_BASE}/schedule-hub/upload`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...authHeaders(),
    },
    body: formData,
  });

  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}