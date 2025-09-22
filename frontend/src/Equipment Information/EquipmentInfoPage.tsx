import React, { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/* -----------------------------------------------------------------------------
  공통 유틸
  - API_BASE: 개발환경에선 VITE_API_BASE(예: http://localhost:8000/api), 없으면 "/api"
  - authHeaders: JWT 토큰(Bearer) 헤더 붙이기
  - safeGet: localStorage 안전 접근
  - useQuery: URLSearchParams 헬퍼
----------------------------------------------------------------------------- */
const API_BASE: string = (() => {


  try {
    const env = (import.meta as any)?.env;
    const v = env?.VITE_API_BASE as string | undefined;
    return v && v.trim() ? v : "/api";
  } catch {
    return "/api";
  }
})();

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

async function fetchEquipmentOptionCodes(machineId: string): Promise<string[]> {
  if (!machineId.trim()) return [];
  const url = `${API_BASE}/dashboard/equipment/options/${encodeURIComponent(machineId.trim())}`;
  const res = await fetch(url, { credentials: "include", headers: { ...authHeaders() } });
  if (!res.ok) return [];
  const data = await res.json(); // { option_codes: string[] }
  return Array.isArray(data?.option_codes) ? data.option_codes as string[] : [];
}

// ✅ 전체 옵션 목록 조회(이름 매칭용)
async function fetchAllTaskOptions(): Promise<OptionRow[]> {
  const res = await fetch(`${API_BASE}/task-options?q=&limit=1000`, {
    credentials: "include",
    headers: { ...authHeaders() },
  });
  if (!res.ok) return [];
  const list = (await res.json()) as OptionRow[];
  return Array.isArray(list) ? list : [];
}

const safeGet = (k: string) => {
  try {
    const v = localStorage.getItem(k);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
};

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

/* -----------------------------------------------------------------------------
  타입
----------------------------------------------------------------------------- */
type OptionRow = { id: number; name: string };

// intent 최소 타입
type InfoIntentLite = {
  machineId?: string;
  values?: {
    shipDate?: string | null;
    manager?: string | null;
    // 확장 필드
    customer?: string | null;
    status?: "가능" | "불가능" | string | null;
    serialNumber?: string | null;
    note?: string | null;
  };
};

/* -----------------------------------------------------------------------------
  옵션 선택 모달
----------------------------------------------------------------------------- */
const OptionSelectModal: React.FC<{
  open: boolean;
  initialSelected: OptionRow[];
  onClose: () => void;
  onConfirm: (rows: OptionRow[]) => void;
}> = ({ open, initialSelected, onClose, onConfirm }) => {
  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<OptionRow[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Map<number, OptionRow>>(new Map());

  // 모달이 열릴 때 현재 선택 복원
  useEffect(() => {
    if (!open) return;
    const m = new Map<number, OptionRow>();
    initialSelected.forEach((r) => m.set(r.id, r));
    setPicked(m);
  }, [open, initialSelected]);

  // 목록 조회(검색 디바운스)
  const fetchList = async (keyword = "") => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch(
        `${API_BASE}/task-options?q=${encodeURIComponent(keyword)}&limit=200`,
        { credentials: "include", headers: { ...authHeaders() } }
      );
      if (!res.ok) throw new Error(`옵션 조회 실패: ${res.status}`);
      const data: OptionRow[] = await res.json();
      setList(data);
    } catch (e: any) {
      setError(e?.message ?? "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchList("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchList(q), 200);
    return () => clearTimeout(t);
  }, [q, open]);

  const togglePick = (row: OptionRow) =>
    setPicked((prev) => {
      const m = new Map(prev);
      m.has(row.id) ? m.delete(row.id) : m.set(row.id, row);
      return m;
    });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">장비 옵션 선택</h3>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
          >
            닫기
          </button>
        </div>

        {/* 검색 */}
        <div className="mb-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="옵션 검색(예: cold, T5825)"
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
          />
        </div>

        {/* 목록 */}
        <div className="max-h-[420px] overflow-y-auto rounded-lg border">
          {loading ? (
            <div className="py-12 text-center text-sm text-gray-500">
              불러오는 중…
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-red-600">
              {error}
            </div>
          ) : list.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              표시할 옵션이 없습니다.
            </div>
          ) : (
            <ul className="divide-y">
              {list.map((row) => {
                const checked = picked.has(row.id);
                return (
                  <li
                    key={row.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePick(row)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span className="text-sm text-slate-800">{row.name}</span>
                    </div>
                    {checked && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700">
                        선택됨
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 푸터 */}
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-gray-500">선택: {picked.size}건</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            >
              취소
            </button>
            <button
              onClick={() => onConfirm(Array.from(picked.values()))}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              완료
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* -----------------------------------------------------------------------------
  메인 페이지
  - 진입 경로: 대시보드 → (빈 슬롯인지 아닌지에 따라) 로컬스토리지 플래그와 함께 이동
  - 빈 슬롯이면 selected_machine_is_empty="1" 로 들어오고, 최초 렌더에서 모든 값 초기화
  - 저장 성공 시 대시보드로 복귀
----------------------------------------------------------------------------- */
const EquipmentInfoPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();

  /* ── 1) 진입정보 구성(쿼리 > 로컬스토리지) */
  const site = query.get("site") ?? safeGet("selected_site") ?? "본사";
  const line = query.get("line") ?? safeGet("selected_line") ?? "A동";
  const slot = query.get("slot") ?? safeGet("selected_slot") ?? "-";

  // 빈 슬롯 여부 플래그
  const emptyFlag = safeGet("selected_machine_is_empty"); // "1" | "0" | null

  // Machine ID 초기값: 빈 슬롯이면 무조건 ""
  const machineFromQuery = query.get("machine");
  const machineFromStorage = emptyFlag === "1" ? "" : safeGet("selected_machine_id") ?? "";

  // ✅ CHANGED: 빈 슬롯이면 query 무시하고 무조건 공란
  const machineInit =
    emptyFlag === "1"
      ? ""
      : ((machineFromQuery ?? machineFromStorage) || "").trim();

  /* ── 2) 폼 상태 */
  const [machineId, setMachineId] = useState<string>(machineInit);
  const [shippingDate, setShippingDate] = useState<string>(""); // YYYY-MM-DD
  const [manager, setManager] = useState<string>("");
  const [customer, setCustomer] = useState<string>("");
  const [status, setStatus] = useState<"가능" | "불가능">("불가능");
  const [serialNumber, setSerialNumber] = useState<string>("");
  const [note, setNote] = useState<string>("");

  // 저장 중 상태
  const [saving, setSaving] = useState(false); // ✅ ADDED

  // 옵션 선택 상태(저장은 추후 별도 테이블)
  const [selectedOptions, setSelectedOptions] = useState<OptionRow[]>([]);
  const [optOpen, setOptOpen] = useState(false);

  /* ── 3) 안내 메시지 (초기 1회만) */
  const announcedRef = useRef(false); // ✅ ADDED
  useEffect(() => {
    if (announcedRef.current) return;
    announcedRef.current = true;
    alert(`${site} > ${line} > ${slot} / ${machineId || "-"} 호기를 선택하셨습니다.`);
    // machineId가 나중에 프리필되어도 다시 뜨지 않음
  }, [site, line, slot, machineId]); // ✅ machineId를 의존에 두되 ref로 1회 제한

  /* ── 4) 최초 진입 가드: 빈 슬롯이면 폼/흔적 초기화 */
  useEffect(() => {
    const isEmpty = emptyFlag === "1" || !machineInit;
    if (isEmpty) {
      setMachineId("");
      setShippingDate("");
      setManager("");
      setCustomer("");
      setStatus("불가능");
      setSerialNumber("");
      setNote("");
      try {
        localStorage.removeItem("selected_machine_is_empty");
        localStorage.removeItem("selected_machine_id");
        localStorage.removeItem("machine_info_intent");
        (window as any).__MACHINE_INFO_INTENT__ = undefined;
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── 4.5) 프리필: 빈 슬롯이 아니면 intent 읽어서 상태 채우기 */
  useEffect(() => {
    const isEmpty = emptyFlag === "1" || !machineInit;
    if (isEmpty) return;

    try {
      const raw = localStorage.getItem("machine_info_intent");
      if (!raw) return;

      const intent = JSON.parse(raw) as InfoIntentLite | any;
      const v = intent?.values ?? {};

      // 날짜 보정: YYYY-MM-DD
      const toDateInput = (d: any): string | null => {
        if (d == null) return null;
        const s = String(d);
        return s.length >= 10 ? s.slice(0, 10) : s;
      };

      // Machine ID (빈 문자열도 허용)
      if (typeof intent?.machineId === "string") {
        setMachineId(intent.machineId);
      }

      // 출하일
      if ("shipDate" in v) {
        const ds = toDateInput(v.shipDate);
        if (ds !== null) setShippingDate(ds);
      }

      // 담당자
      if ("manager" in v && typeof v.manager === "string") {
        setManager(v.manager ?? "");
      }

      // ✅ ADDED: 확장 필드 프리필
      if ("customer" in v && typeof v.customer === "string") {
        setCustomer(v.customer ?? "");
      }
      if ("serialNumber" in v && typeof v.serialNumber === "string") {
        setSerialNumber(v.serialNumber ?? "");
      }
      if ("note" in v && typeof v.note === "string") {
        setNote(v.note ?? "");
      }
      if ("status" in v && (v.status === "가능" || v.status === "불가능")) {
        setStatus(v.status);
      }
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ 장비가 있는 경우: equipment_option에서 코드 불러와 선택된 옵션 채우기
useEffect(() => {
  let aborted = false;

  const load = async () => {
    const mid = (machineId || "").trim();
    if (!mid) return;                 // 빈 슬롯이면 스킵

    try {
      // 1) 해당 장비의 기존 옵션 코드들 (["hot","cold"...])
      const codes = await fetchEquipmentOptionCodes(mid);
      if (aborted || codes.length === 0) {
        setSelectedOptions([]);       // 없으면 비움
        return;
      }

      // 2) 전체 옵션 목록(OptionRow[])에서 이름으로 매칭
      const all = await fetchAllTaskOptions();
      if (aborted) return;

      // name 이 codes 중 하나인 항목만 선택
      const pickSet = new Set(codes.map(c => c.toLowerCase()));
      const picked = all.filter(o => pickSet.has((o.name || "").toLowerCase()));

      setSelectedOptions(picked);     // ✅ "선택된 옵션" 칩에 표시 + 모달 사전 체크
    } catch {
      // 실패 시 조용히 무시
    }
  };

  load();
  return () => { aborted = true; };
  // machineId가 확정됐을 때만 시도
}, [machineId]);


  const pageTitle = machineId ? `${machineId} 장비 정보 수정` : "장비 정보 입력";

  /* ── 5) 옵션 모달 콜백 */
  const handleOptionConfirm = (rows: OptionRow[]) => {
    const map = new Map<number, OptionRow>();
    rows.forEach((r) => map.set(r.id, r));
    setSelectedOptions(Array.from(map.values()));
    setOptOpen(false);
  };
  const removeOne = (id: number) =>
    setSelectedOptions((prev) => prev.filter((r) => r.id !== id));

  /* ── 6) 저장 → 성공 시 대시보드로 복귀 */
  const handleSave = async () => {
    try {
      if (!machineId.trim()) return alert("Machine ID를 입력해주세요.");
      if (!shippingDate) return alert("출하일을 선택해주세요.");
      if (!slot.trim())
        return alert("슬롯 정보가 없습니다. 대시보드에서 다시 시도해주세요.");

      setSaving(true); // ✅ ADDED

      const optionCodesStr = selectedOptions
        .map(o => (o.name || "").trim())
        .filter(Boolean)
        .join(", "); 

      const body = {
        machine_id: machineId.trim(),
        shipping_date: shippingDate,
        manager: manager || "",
        customer: customer || "",
        slot_code: slot,
        site: site || null,
        serial_number: serialNumber || null,
        status,
        note: note || null,

        option_ids: selectedOptions.map(o => o.id), // 기존 유지(원하면 제거)
        replace_options: true,                      // 기존 유지(원하면 제거)
        option_codes_str: optionCodesStr,           // ✅ ADDED 
      };

      const res = await fetch(`${API_BASE}/dashboard/equipment/save`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`저장 실패: ${res.status}`);

      // 대시보드 새로고침 신호 (선택)
      try { localStorage.setItem("dashboard_should_refresh", "1"); } catch {}

      alert("저장에 성공했습니다.");
      // ✅ ADDED: 저장 성공 시 대시보드로 복귀
      navigate(-1);
      return;
    } catch (e: any) {
      alert(e?.message ?? "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false); // ✅ ADDED
    }
  };

  /* ── 7) 렌더 */
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 상단 바: 현재 위치/뒤로가기 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          위치: <span className="font-medium">{site}</span> &gt;{" "}
          <span className="font-medium">{line}</span> &gt;{" "}
          <span className="font-medium">{slot}</span>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
        >
          ← 대시보드로
        </button>
      </div>

      {/* 카드 */}
      <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow">
        {/* 카드 헤더: 타이틀 + 옵션 버튼 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{pageTitle}</h2>
          <button
            onClick={() => setOptOpen(true)}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
          >
            장비 옵션 선택
          </button>
        </div>

        {/* 선택된 옵션 칩 */}
        <div className="mb-5">
          <div className="mb-1 text-sm font-medium text-gray-700">선택된 옵션</div>
          {selectedOptions.length === 0 ? (
            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              아직 선택된 옵션이 없습니다.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedOptions.map((opt) => (
                <span
                  key={opt.id}
                  className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs text-indigo-700"
                >
                  {opt.name}
                  <button
                    onClick={() => removeOne(opt.id)}
                    className="rounded-full bg-indigo-100 px-2 text-[10px] text-indigo-700 hover:bg-indigo-200"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 폼 영역 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Machine ID */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Machine ID *
            </label>
            <input
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              placeholder="예) j-07-02"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
            <p className="mt-1 text-xs text-gray-400">
              빈 슬롯이면 비워진 상태로 시작합니다.
            </p>
          </div>

          {/* 출하일 */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              출하일 *
            </label>
            <input
              type="date"
              value={shippingDate}
              onChange={(e) => setShippingDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Customer */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Customer
            </label>
            <input
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="예) ABC Corp"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Manager */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Manager
            </label>
            <input
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="예) 홍길동"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Serial Number */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Serial Number
            </label>
            <input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              placeholder="예) SN-2024-00001"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          {/* Status: 가능 / 불가능 */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </span>
            <div className="inline-flex rounded-xl border bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setStatus("가능")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  status === "가능"
                    ? "bg-emerald-600 text-white"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                출하 가능
              </button>
              <button
                type="button"
                onClick={() => setStatus("불가능")}
                className={`rounded-lg px-4 py-2 text-sm font-medium ${
                  status === "불가능"
                    ? "bg-rose-600 text-white"
                    : "text-gray-700 hover:bg-white"
                }`}
              >
                출하 불가능
              </button>
            </div>
          </div>

          {/* 비고 */}
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              비고
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="특이사항 메모"
              className="h-28 w-full resize-none rounded-lg border px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>

        {/* 액션 버튼 */}
        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={() => navigate(-1)}
            className="rounded-lg bg-gray-200 px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving} // ✅ ADDED
            className={`rounded-lg px-5 py-2 text-sm font-semibold text-white ${
              saving ? "bg-gray-400" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* 옵션 모달 */}
      <OptionSelectModal
        open={optOpen}
        initialSelected={selectedOptions}
        onClose={() => setOptOpen(false)}
        onConfirm={handleOptionConfirm}
      />
    </div>
  );
};

export default EquipmentInfoPage;
