import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const safeGet = (k: string) => {
  try {
    const v = localStorage.getItem(k);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
};

const getAuthHeaders = () => {
  const token = safeGet("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getErrorMessage = (error: unknown) => {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      if (error.code === "ERR_NETWORK") {
        return "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해줘.";
      }
      return `서버 응답이 없습니다. (${error.message})`;
    }

    const detail = error.response.data?.detail;

    if (typeof detail === "string") return detail;

    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item?.msg) return item.msg;
          return JSON.stringify(item);
        })
        .join("\n");
    }

    if (detail && typeof detail === "object") {
      return JSON.stringify(detail, null, 2);
    }

    if (typeof error.response.data === "string") {
      return error.response.data;
    }

    if (error.message) {
      return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "알 수 없는 오류가 발생했습니다.";
};

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const Shell: React.FC<{
  children: React.ReactNode;
  className?: string;
  header?: string;
  right?: React.ReactNode;
}> = ({ children, className, header, right }) => (
  <section
    className={`overflow-hidden rounded-3xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/70 ${
      className ?? ""
    }`}
  >
    <div className="h-2 bg-gradient-to-r from-orange-300 via-amber-200 to-sky-300" />
    {(header || right) && (
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight text-slate-800">
            {header}
          </h3>
          <p className="mt-1 text-xs text-slate-500">장비 개조 입력 및 저장</p>
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-3 text-sm font-bold text-slate-700">{children}</div>
);

const CheckCard: React.FC<{
  checked: boolean;
  onChange: () => void;
  title: string;
  desc?: string;
  tone?: "sky" | "emerald" | "orange" | "rose";
  disabled?: boolean;
}> = ({ checked, onChange, title, desc, tone = "sky", disabled = false }) => {
  const toneClass = checked
    ? tone === "emerald"
      ? "border-emerald-300 bg-emerald-50"
      : tone === "orange"
        ? "border-orange-300 bg-orange-50"
        : tone === "rose"
          ? "border-rose-300 bg-rose-50"
          : "border-sky-300 bg-sky-50"
    : "border-slate-200 bg-white";

  const checkboxAccent =
    tone === "emerald"
      ? "accent-emerald-600"
      : tone === "orange"
        ? "accent-orange-600"
        : tone === "rose"
          ? "accent-rose-600"
          : "accent-sky-600";

  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 shadow-sm transition ${toneClass} ${
        disabled ? "cursor-not-allowed bg-slate-100" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className={`mt-0.5 h-4 w-4 ${checkboxAccent}`}
      />
      <div className="min-w-0">
        <div className="text-sm font-bold text-slate-800">{title}</div>
        {desc && <div className="mt-0.5 text-xs text-slate-500">{desc}</div>}
      </div>
    </label>
  );
};

type OptionItem = {
  id: number;
  option_name: string;
};

type AddedChecklistItem = {
  id: number;
  optionId: number;
  optionName: string;
  startDate: string;
  endDate: string;
  remodelTimeText: string;
  checked: boolean;
  completedAt?: string | null;
  delayReason: string;
  isExpanded: boolean;
};

type RemodelChecklistDetail = {
  id: number;
  option_id: number;
  option_name: string;
  start_date?: string | null;
  end_date?: string | null;
  remodel_time_text?: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  delay_reason?: string | null;
  sort_order: number;
};

type RemodelDetailResponse = {
  id: number;
  machine_id: string;
  remodel_manager?: string;
  remodel_time_text?: string;
  model?: string;
  manager_feedback?: string | null;
  delay_reason?: string | null;
  result_status?: "" | "정상" | "부적합";
  improvement_status?: "" | "need" | "done" | null;
  remodel_progress_status?: "" | "planned" | "completed" | "io_done" | null;
  checklist_count: number;
  checklist: RemodelChecklistDetail[];
};

type SaveResponse = {
  mode: "insert" | "update";
  remodel_id: number;
  checklist_count: number;
  message: string;
};

const LABEL_CLASS = "mb-1.5 block text-sm font-semibold text-slate-700";
const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const TEXTAREA_CLASS =
  "min-h-[120px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const SELECT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

const MODEL_ITEMS = [
  "선택",
  "FD",
  "SA",
  "SC",
  "SD",
  "SD(e)",
  "SD-C",
  "SE",
  "SE(e)",
  "SH",
  "SH(e)",
  "SL",
  "SLT",
  "SLT(e)",
  "OPUS5",
  "SP",
  "ST(e)",
  "STP(e)",
];

const FALLBACK_OPTIONS: OptionItem[] = [
  { id: 1, option_name: "Heater" },
  { id: 2, option_name: "Sensor" },
  { id: 3, option_name: "Valve" },
  { id: 4, option_name: "Cable" },
  { id: 5, option_name: "Stage" },
  { id: 6, option_name: "Chiller" },
  { id: 7, option_name: "Camera" },
  { id: 8, option_name: "기타" },
];

const formatDateText = (date: string) => {
  if (!date) return "-";
  return date;
};

const hasChecklistDetail = (item: AddedChecklistItem) => {
  return Boolean(
    item.startDate ||
      item.endDate ||
      item.remodelTimeText.trim() ||
      item.delayReason.trim()
  );
};

const EquipmentRemodelPage: React.FC = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const { auth } = useAuth();

  const canEdit = (auth ?? 0) >= 1;

  const site = query.get("site") ?? safeGet("selected_site") ?? "본사";
  const line = query.get("line") ?? safeGet("selected_line") ?? "A동";
  const slot = query.get("slot") ?? safeGet("selected_slot") ?? "-";

  const emptyFlag = safeGet("selected_machine_is_empty");
  const machineFromQuery = query.get("machine");
  const machineFromStorage =
    emptyFlag === "1" ? "" : safeGet("selected_machine_id") ?? "";
  const machineInit =
    emptyFlag === "1" ? "" : ((machineFromQuery ?? machineFromStorage) || "").trim();

  const [remodelId, setRemodelId] = useState<number | null>(null);

  const [machineId, setMachineId] = useState(machineInit);
  const [remodelManager, setRemodelManager] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [optionSearch, setOptionSearch] = useState("");
  const [model, setModel] = useState("선택");
  const [managerFeedback, setManagerFeedback] = useState("");
  const [resultStatus, setResultStatus] = useState<"" | "정상" | "부적합">("");

  const [improvementStatus, setImprovementStatus] = useState<"" | "need" | "done">("");
  const [remodelProgressStatus, setRemodelProgressStatus] = useState<
    "" | "planned" | "completed" | "io_done"
  >("");

  const [optionList, setOptionList] = useState<OptionItem[]>([]);
  const [addedChecklist, setAddedChecklist] = useState<AddedChecklistItem[]>([]);

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [isOptionModalOpen, setIsOptionModalOpen] = useState(false);
  const [newOptionName, setNewOptionName] = useState("");
  const [optionSaving, setOptionSaving] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingOptionName, setEditingOptionName] = useState("");

  const pageTitle = machineId ? `${machineId} 장비 개조 입력` : "장비 개조 입력";

  const optionNameMap = useMemo(() => {
    const map = new Map<number, string>();
    optionList.forEach((item) => {
      map.set(item.id, item.option_name);
    });
    return map;
  }, [optionList]);

  const filteredOptionList = useMemo(() => {
    const keyword = optionSearch.trim().toLowerCase();
    if (!keyword) return optionList;
    return optionList.filter((item) =>
      item.option_name.toLowerCase().includes(keyword)
    );
  }, [optionList, optionSearch]);

  const fetchOptions = async () => {
    try {
      setLoadingOptions(true);
      const res = await axios.get<OptionItem[]>(`${API_BASE}/equipment-remodel/options`, {
        headers: getAuthHeaders(),
      });

      if (Array.isArray(res.data) && res.data.length > 0) {
        setOptionList(res.data);
      } else {
        setOptionList(FALLBACK_OPTIONS);
      }
    } catch (error) {
      console.error("옵션 목록 조회 실패:", error);
      console.error("옵션 목록 조회 실패 메시지:", getErrorMessage(error));
      setOptionList(FALLBACK_OPTIONS);
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  useEffect(() => {
    if (!machineInit) return;

    const fetchExisting = async () => {
      try {
        setLoadingExisting(true);
        const res = await axios.get<RemodelDetailResponse>(
          `${API_BASE}/equipment-remodel/by-machine/${encodeURIComponent(machineInit)}`,
          {
            headers: getAuthHeaders(),
          }
        );

        const data = res.data;

        setRemodelId(data.id);
        setMachineId(data.machine_id ?? machineInit);
        setRemodelManager(data.remodel_manager ?? "");
        setModel(data.model && data.model.trim() ? data.model : "선택");
        setManagerFeedback(data.manager_feedback ?? "");
        setResultStatus((data.result_status as "" | "정상" | "부적합" | null) ?? "");
        setImprovementStatus((data.improvement_status as "" | "need" | "done" | null) ?? "");
        setRemodelProgressStatus(
          (data.remodel_progress_status as "" | "planned" | "completed" | "io_done" | null) ?? ""
        );

        const checklistItems: AddedChecklistItem[] = (data.checklist ?? []).map((item) => ({
          id: item.id,
          optionId: item.option_id,
          optionName: item.option_name,
          startDate: item.start_date ?? "",
          endDate: item.end_date ?? "",
          remodelTimeText: item.remodel_time_text ?? "",
          checked: item.is_completed,
          completedAt: item.completed_at ?? null,
          delayReason: item.delay_reason ?? "",
          isExpanded: false,
        }));

        setAddedChecklist(checklistItems);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return;
        }
        console.error("기존 개조 데이터 조회 실패:", error);
        console.error("기존 개조 데이터 조회 실패 메시지:", getErrorMessage(error));
      } finally {
        setLoadingExisting(false);
      }
    };

    fetchExisting();
  }, [machineInit]);

  const handleAddChecklist = () => {
    if (!canEdit) return;

    const optionIdNum = Number(selectedOptionId);
    if (!optionIdNum) {
      alert("옵션 항목을 먼저 선택해줘.");
      return;
    }

    const optionName = optionNameMap.get(optionIdNum) ?? "";
    if (!optionName) {
      alert("선택한 옵션 정보를 찾을 수 없어.");
      return;
    }

    const newItem: AddedChecklistItem = {
      id: Date.now(),
      optionId: optionIdNum,
      optionName,
      startDate: "",
      endDate: "",
      remodelTimeText: "",
      checked: false,
      completedAt: null,
      delayReason: "",
      isExpanded: false,
    };

    setAddedChecklist((prev) => [...prev, newItem]);
    setSelectedOptionId("");
    setOptionSearch("");
  };

  const toggleAddedChecklist = (id: number) => {
    setAddedChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              checked: !item.checked,
              completedAt: !item.checked ? new Date().toISOString() : null,
            }
          : item
      )
    );
  };

  const toggleChecklistExpanded = (id: number) => {
    setAddedChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              isExpanded: !item.isExpanded,
            }
          : item
      )
    );
  };

  const updateChecklistItem = (
    id: number,
    patch: Partial<Pick<AddedChecklistItem, "startDate" | "endDate" | "remodelTimeText" | "delayReason">>
  ) => {
    setAddedChecklist((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
            }
          : item
      )
    );
  };

  const removeAddedChecklist = (id: number) => {
    setAddedChecklist((prev) => prev.filter((item) => item.id !== id));
  };

  const openEditOption = (item: OptionItem) => {
    setEditingOptionId(item.id);
    setEditingOptionName(item.option_name);
  };

  const resetOptionEdit = () => {
    setEditingOptionId(null);
    setEditingOptionName("");
  };

  const handleCreateOption = async () => {
    if (!canEdit) return;

    const optionName = newOptionName.trim();
    if (!optionName) {
      alert("추가할 옵션명을 입력해줘.");
      return;
    }

    try {
      setOptionSaving(true);
      await axios.post(
        `${API_BASE}/equipment-remodel/options`,
        { option_name: optionName },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      setNewOptionName("");
      await fetchOptions();
      alert("옵션이 추가되었습니다.");
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setOptionSaving(false);
    }
  };

  const handleUpdateOption = async () => {
    if (!canEdit || editingOptionId == null) return;

    const optionName = editingOptionName.trim();
    if (!optionName) {
      alert("옵션명을 입력해줘.");
      return;
    }

    try {
      setOptionSaving(true);
      await axios.put(
        `${API_BASE}/equipment-remodel/options/${editingOptionId}`,
        { option_name: optionName },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      resetOptionEdit();
      await fetchOptions();
      alert("옵션이 수정되었습니다.");
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setOptionSaving(false);
    }
  };

  const handleDeleteOption = async (optionId: number, optionName: string) => {
    if (!canEdit) return;

    const confirmed = window.confirm(`"${optionName}" 옵션을 삭제할까?`);
    if (!confirmed) return;

    try {
      setOptionSaving(true);
      await axios.delete(`${API_BASE}/equipment-remodel/options/${optionId}`, {
        headers: getAuthHeaders(),
      });
      if (selectedOptionId === String(optionId)) {
        setSelectedOptionId("");
      }
      await fetchOptions();
      alert("옵션이 삭제되었습니다.");
    } catch (error) {
      alert(getErrorMessage(error));
    } finally {
      setOptionSaving(false);
    }
  };

  const handleSave = async () => {
    if (!canEdit) {
      alert("권한이 부족하여 입력할 수 없습니다.");
      return;
    }

    if (!machineId.trim()) {
      alert("machine_id를 입력해줘.");
      return;
    }

    for (const item of addedChecklist) {
      if (
        item.startDate &&
        item.endDate &&
        new Date(item.endDate).getTime() < new Date(item.startDate).getTime()
      ) {
        alert(`${item.optionName} 항목의 종료 일정은 시작 일정보다 빠를 수 없어.`);
        return;
      }
    }

    try {
      setSaving(true);

      const payload = {
        remodel_id: remodelId ?? undefined,
        machine_id: machineId.trim(),
        remodel_manager: remodelManager.trim(),
        remodel_time_text: "",
        model: model === "선택" ? "" : model,
        manager_feedback: managerFeedback.trim() || null,
        delay_reason: null,
        result_status: resultStatus || null,
        improvement_status: improvementStatus || null,
        remodel_progress_status: remodelProgressStatus || null,
        checklist: addedChecklist.map((item, index) => ({
          option_id: item.optionId,
          start_date: item.startDate || null,
          end_date: item.endDate || null,
          remodel_time_text: item.remodelTimeText.trim() || null,
          is_completed: item.checked,
          completed_at: item.checked ? item.completedAt ?? null : null,
          delay_reason: item.delayReason.trim() || null,
          sort_order: index,
        })),
      };

      const res = await axios.post<SaveResponse>(
        `${API_BASE}/equipment-remodel/save`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      setRemodelId(res.data.remodel_id);
      alert("저장되었습니다.");
    } catch (error) {
      console.error("개조 저장 실패:", error);
      alert(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 px-4 py-6">
      <div className="mx-auto w-full max-w-6xl">
        {!canEdit && (
          <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-100">
            현재 계정은 <b>조회만 가능</b>합니다. 입력/저장은 제한됩니다.
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">
              {site}
            </span>
            <span>›</span>
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">
              {line}
            </span>
            <span>›</span>
            <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 ring-1 ring-slate-200">
              {slot}
            </span>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
          >
            ← 뒤로가기
          </button>
        </div>

        <Shell
          header={pageTitle}
          right={
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
              {saving ? "저장 중" : loadingExisting ? "불러오는 중" : "API 연결"}
            </span>
          }
        >
          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-6">
                <div className="rounded-3xl bg-slate-50/80 p-5 ring-1 ring-slate-200">
                  <SectionTitle>기본 정보</SectionTitle>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={LABEL_CLASS}>machine_id</label>
                      <input
                        value={machineId}
                        onChange={(e) => setMachineId(e.target.value)}
                        placeholder="예) H(e)-10-05"
                        disabled={!canEdit}
                        className={`${INPUT_CLASS} ${
                          !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                        }`}
                      />
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>개조 담당자</label>
                      <input
                        value={remodelManager}
                        onChange={(e) => setRemodelManager(e.target.value)}
                        placeholder="담당자명"
                        disabled={!canEdit}
                        className={`${INPUT_CLASS} ${
                          !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                        }`}
                      />
                    </div>

                    <div>
                      <label className={LABEL_CLASS}>모델</label>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={!canEdit}
                        className={`${SELECT_CLASS} ${
                          !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                        }`}
                      >
                        {MODEL_ITEMS.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50/80 p-5 ring-1 ring-slate-200">
                  <SectionTitle>선택 항목</SectionTitle>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <label className={LABEL_CLASS}>옵션 항목</label>

                      <div className="mb-3">
                        <input
                          value={optionSearch}
                          onChange={(e) => setOptionSearch(e.target.value)}
                          placeholder="옵션명 검색"
                          disabled={!canEdit || loadingOptions}
                          className={`${INPUT_CLASS} ${
                            !canEdit || loadingOptions
                              ? "cursor-not-allowed bg-slate-100"
                              : ""
                          }`}
                        />
                      </div>

                      <div className="flex flex-col gap-3 md:flex-row">
                        <select
                          value={selectedOptionId}
                          onChange={(e) => setSelectedOptionId(e.target.value)}
                          disabled={!canEdit || loadingOptions}
                          className={`${SELECT_CLASS} flex-1 ${
                            !canEdit || loadingOptions
                              ? "cursor-not-allowed bg-slate-100"
                              : ""
                          }`}
                        >
                          <option value="">
                            {loadingOptions ? "옵션 불러오는 중..." : "선택"}
                          </option>
                          {filteredOptionList.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.option_name}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={() => setIsOptionModalOpen(true)}
                          disabled={!canEdit}
                          className={`shrink-0 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition ${
                            !canEdit
                              ? "cursor-not-allowed bg-slate-300 text-white"
                              : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          옵션 관리
                        </button>

                        <button
                          type="button"
                          onClick={handleAddChecklist}
                          disabled={!canEdit}
                          className={`shrink-0 rounded-2xl px-5 py-3 text-sm font-bold shadow-sm transition ${
                            !canEdit
                              ? "cursor-not-allowed bg-slate-300 text-white"
                              : "bg-sky-500 text-white hover:bg-sky-600"
                          }`}
                        >
                          + 추가
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50/80 p-5 ring-1 ring-slate-200">
                  <SectionTitle>진행 체크</SectionTitle>

                  <div className="space-y-5">
                    <div>
                      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        개선품 적용
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <CheckCard
                          checked={improvementStatus === "need"}
                          onChange={() => canEdit && setImprovementStatus("need")}
                          title="개선품 적용 필요"
                          desc="개선품 적용이 필요한 상태"
                          tone="orange"
                          disabled={!canEdit}
                        />

                        <CheckCard
                          checked={improvementStatus === "done"}
                          onChange={() => canEdit && setImprovementStatus("done")}
                          title="개선품 적용 완료"
                          desc="개선품 적용 작업이 완료된 상태"
                          tone="emerald"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                        개조 진행
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <CheckCard
                          checked={remodelProgressStatus === "planned"}
                          onChange={() => canEdit && setRemodelProgressStatus("planned")}
                          title="개조 예정"
                          desc="개조 작업 예정 등록"
                          tone="sky"
                          disabled={!canEdit}
                        />

                        <CheckCard
                          checked={remodelProgressStatus === "completed"}
                          onChange={() => canEdit && setRemodelProgressStatus("completed")}
                          title="개조 완료"
                          desc="개조 작업 완료 상태"
                          tone="emerald"
                          disabled={!canEdit}
                        />

                        <CheckCard
                          checked={remodelProgressStatus === "io_done"}
                          onChange={() => canEdit && setRemodelProgressStatus("io_done")}
                          title="Io 구동 체크 완료"
                          desc="Io 동작 확인 완료"
                          tone="sky"
                          disabled={!canEdit}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-3xl bg-white p-5 ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle>개조 체크리스트</SectionTitle>
                    <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
                      {addedChecklist.length}건
                    </span>
                  </div>

                  {addedChecklist.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      아직 추가된 항목이 없어.
                      <br />
                      왼쪽에서 옵션을 선택하고 <b>추가</b> 버튼을 눌러줘.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {addedChecklist.map((item, index) => (
                        <div
                          key={item.id}
                          className={`rounded-2xl border px-4 py-3 shadow-sm transition ${
                            item.checked
                              ? "border-emerald-300 bg-emerald-50"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.checked}
                              onChange={() => toggleAddedChecklist(item.id)}
                              className="mt-1 h-4 w-4 accent-emerald-600"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">
                                  #{index + 1}
                                </span>
                                <span className="text-sm font-bold text-slate-800">
                                  {item.optionName}
                                </span>
                                {item.checked && (
                                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                    완료
                                  </span>
                                )}
                              </div>

                              {hasChecklistDetail(item) ? (
                                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                  {item.startDate && (
                                    <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                                      시작 {formatDateText(item.startDate)}
                                    </span>
                                  )}
                                  {item.endDate && (
                                    <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                                      종료 {formatDateText(item.endDate)}
                                    </span>
                                  )}
                                  {item.remodelTimeText.trim() && (
                                    <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                                      소요시간 {item.remodelTimeText}
                                    </span>
                                  )}
                                  {item.delayReason.trim() && (
                                    <span className="rounded-full bg-white px-3 py-1 text-slate-700 ring-1 ring-slate-200">
                                      지연 사유 입력됨
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-slate-500">
                                  아직 세부 입력 없음
                                </div>
                              )}

                              {item.isExpanded && (
                                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                                  <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                      변경 시작 일정
                                    </label>
                                    <input
                                      type="date"
                                      value={item.startDate}
                                      onChange={(e) =>
                                        updateChecklistItem(item.id, {
                                          startDate: e.target.value,
                                        })
                                      }
                                      disabled={!canEdit}
                                      className={`${INPUT_CLASS} ${
                                        !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                                      }`}
                                    />
                                  </div>

                                  <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                      변경 종료 일정
                                    </label>
                                    <input
                                      type="date"
                                      value={item.endDate}
                                      onChange={(e) =>
                                        updateChecklistItem(item.id, {
                                          endDate: e.target.value,
                                        })
                                      }
                                      disabled={!canEdit}
                                      className={`${INPUT_CLASS} ${
                                        !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                                      }`}
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                      개조 소요시간
                                    </label>
                                    <input
                                      value={item.remodelTimeText}
                                      onChange={(e) =>
                                        updateChecklistItem(item.id, {
                                          remodelTimeText: e.target.value,
                                        })
                                      }
                                      placeholder="예) 2시간 30분 / 5h"
                                      disabled={!canEdit}
                                      className={`${INPUT_CLASS} ${
                                        !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                                      }`}
                                    />
                                  </div>

                                  <div className="md:col-span-2">
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                      지연 사유
                                    </label>
                                    <textarea
                                      value={item.delayReason}
                                      onChange={(e) =>
                                        updateChecklistItem(item.id, {
                                          delayReason: e.target.value,
                                        })
                                      }
                                      placeholder="이 항목만의 지연 사유 입력"
                                      disabled={!canEdit}
                                      className={`min-h-[84px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100 ${
                                        !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                                      }`}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex shrink-0 flex-col gap-2">
                              <button
                                type="button"
                                onClick={() => toggleChecklistExpanded(item.id)}
                                className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                              >
                                {item.isExpanded ? "접기" : "상세 입력"}
                              </button>

                              <button
                                type="button"
                                onClick={() => removeAddedChecklist(item.id)}
                                className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl bg-slate-50/80 p-5 ring-1 ring-slate-200">
                  <SectionTitle>담당자 메모</SectionTitle>

                  <div className="space-y-4">
                    <div>
                      <label className={LABEL_CLASS}>담당자 피드백</label>
                      <textarea
                        value={managerFeedback}
                        onChange={(e) => setManagerFeedback(e.target.value)}
                        placeholder="개조 작업 내용, 특이사항, 확인 사항 등을 입력"
                        disabled={!canEdit}
                        className={`${TEXTAREA_CLASS} ${
                          !canEdit ? "cursor-not-allowed bg-slate-100" : ""
                        }`}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-50/80 p-5 ring-1 ring-slate-200">
                  <div className="mb-3 flex items-center justify-between">
                    <SectionTitle>판정</SectionTitle>
                    {!resultStatus && (
                      <span className="text-xs font-medium text-amber-600">
                        아직 선택 안 됨
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <CheckCard
                      checked={resultStatus === "정상"}
                      onChange={() => canEdit && setResultStatus("정상")}
                      title="정상"
                      desc="개조 완료 후 정상 판정"
                      tone="emerald"
                      disabled={!canEdit}
                    />

                    <CheckCard
                      checked={resultStatus === "부적합"}
                      onChange={() => canEdit && setResultStatus("부적합")}
                      title="부적합"
                      desc="추가 조치가 필요한 상태"
                      tone="rose"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => navigate(-1)}
                className="rounded-full bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                취소
              </button>

              <button
                onClick={handleSave}
                disabled={saving || !canEdit}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white ${
                  saving || !canEdit
                    ? "cursor-not-allowed bg-slate-400"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </Shell>
      </div>

      {isOptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-extrabold text-slate-800">옵션 관리</h3>
                <p className="mt-1 text-xs text-slate-500">
                  remodel_option_master 테이블 데이터 관리
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsOptionModalOpen(false);
                  resetOptionEdit();
                }}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                닫기
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="mb-2 text-sm font-bold text-slate-700">옵션 추가</div>
                <div className="flex flex-col gap-3 md:flex-row">
                  <input
                    value={newOptionName}
                    onChange={(e) => setNewOptionName(e.target.value)}
                    placeholder="새 옵션명 입력"
                    disabled={!canEdit || optionSaving}
                    className={`${INPUT_CLASS} ${
                      !canEdit || optionSaving ? "cursor-not-allowed bg-slate-100" : ""
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleCreateOption}
                    disabled={!canEdit || optionSaving}
                    className={`rounded-2xl px-5 py-3 text-sm font-bold text-white ${
                      !canEdit || optionSaving
                        ? "cursor-not-allowed bg-slate-400"
                        : "bg-sky-500 hover:bg-sky-600"
                    }`}
                  >
                    추가
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white ring-1 ring-slate-200">
                <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">
                  옵션 목록
                </div>

                <div className="max-h-[420px] overflow-y-auto p-4">
                  {optionList.length === 0 ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      등록된 옵션이 없어.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {optionList.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"
                        >
                          {editingOptionId === item.id ? (
                            <div className="space-y-3">
                              <input
                                value={editingOptionName}
                                onChange={(e) => setEditingOptionName(e.target.value)}
                                disabled={!canEdit || optionSaving}
                                className={`${INPUT_CLASS} ${
                                  !canEdit || optionSaving
                                    ? "cursor-not-allowed bg-slate-100"
                                    : ""
                                }`}
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={handleUpdateOption}
                                  disabled={!canEdit || optionSaving}
                                  className={`rounded-xl px-4 py-2 text-sm font-bold text-white ${
                                    !canEdit || optionSaving
                                      ? "cursor-not-allowed bg-slate-400"
                                      : "bg-emerald-500 hover:bg-emerald-600"
                                  }`}
                                >
                                  저장
                                </button>
                                <button
                                  type="button"
                                  onClick={resetOptionEdit}
                                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="text-sm font-bold text-slate-800">
                                  {item.option_name}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  option_id: {item.id}
                                </div>
                              </div>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditOption(item)}
                                  disabled={!canEdit || optionSaving}
                                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                                    !canEdit || optionSaving
                                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                                      : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                  }`}
                                >
                                  수정
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteOption(item.id, item.option_name)
                                  }
                                  disabled={!canEdit || optionSaving}
                                  className={`rounded-xl px-4 py-2 text-sm font-bold ${
                                    !canEdit || optionSaving
                                      ? "cursor-not-allowed bg-rose-100 text-rose-400"
                                      : "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                                  }`}
                                >
                                  삭제
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentRemodelPage;
