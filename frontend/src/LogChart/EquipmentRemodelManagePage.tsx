import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type OptionItem = {
  id: number;
  option_name: string;
};

type ManageListItem = {
  id: number;
  machine_id: string;
  remodel_manager?: string | null;
  model?: string | null;
  manager_feedback?: string | null;
  delay_reason?: string | null;
  option_names: string[];
  option_summary: string;
  created_at?: string | null;
  updated_at?: string | null;
};

type ManageListResponse = {
  total_count: number;
  items: ManageListItem[];
};

type ManageChecklistItem = {
  id: number;
  option_id: number;
  option_name: string;
  remodel_time_text?: string | null;
  delay_reason?: string | null;
  sort_order: number;
};

type ManageDetail = {
  id: number;
  machine_id: string;
  remodel_manager?: string | null;
  model?: string | null;
  manager_feedback?: string | null;
  delay_reason?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  checklist: ManageChecklistItem[];
};

type FiltersResponse = {
  options: OptionItem[];
  min_date?: string | null;
  max_date?: string | null;
};

const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const safeGet = (k: string) => {
  try {
    const v = localStorage.getItem(k) || sessionStorage.getItem(k);
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
    const detail = error.response?.data?.detail;
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
    if (error.code === "ERR_NETWORK") {
      return "서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해줘.";
    }
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return "작업 중 오류가 발생했습니다.";
};

const LABEL_CLASS = "mb-1.5 block text-sm font-semibold text-slate-700";
const INPUT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const TEXTAREA_CLASS =
  "min-h-[96px] w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";
const SELECT_CLASS =
  "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100";

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const Shell: React.FC<{
  children: React.ReactNode;
  header?: string;
  subText?: string;
  badge?: string;
  right?: React.ReactNode;
}> = ({ children, header, subText, badge, right }) => (
  <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200/70">
    <div className="h-2 bg-gradient-to-r from-orange-300 via-amber-200 to-sky-300" />
    {(header || right) && (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5">
        <div>
          <div className="flex items-center gap-2">
            {header && <h2 className="text-xl font-extrabold tracking-tight text-slate-900">{header}</h2>}
            {badge && (
              <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
                {badge}
              </span>
            )}
          </div>
          {subText && <p className="mt-1 text-sm text-slate-500">{subText}</p>}
        </div>
        {right}
      </div>
    )}
    {children}
  </section>
);

const EquipmentRemodelManagePage: React.FC = () => {
  const navigate = useNavigate();

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchText, setSearchText] = useState("");

  const [optionList, setOptionList] = useState<OptionItem[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [items, setItems] = useState<ManageListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ManageDetail | null>(null);

  useEffect(() => {
    const loadFilters = async () => {
      try {
        const res = await axios.get<FiltersResponse>(`${API_BASE}/equipment-remodel-logs/filters`, {
          headers: getAuthHeaders(),
        });
        setOptionList(res.data.options ?? []);
      } catch (error) {
        setError(getErrorMessage(error));
      }
    };
    loadFilters();
  }, []);

  const loadList = async (keepSelection = true) => {
    try {
      setListLoading(true);
      setError(null);

      const res = await axios.get<ManageListResponse>(
        `${API_BASE}/equipment-remodel-logs/manage/list`,
        {
          headers: getAuthHeaders(),
          params: {
            start_date: startDate || undefined,
            end_date: endDate || undefined,
            q: searchText.trim() || undefined,
          },
        }
      );

      const nextItems = res.data.items ?? [];
      setItems(nextItems);

      if (!keepSelection) {
        setSelectedId(nextItems[0]?.id ?? null);
        return;
      }

      if (selectedId && !nextItems.some((item) => item.id === selectedId)) {
        setSelectedId(nextItems[0]?.id ?? null);
      } else if (!selectedId && nextItems.length > 0) {
        setSelectedId(nextItems[0].id);
      }
    } catch (error) {
      setError(getErrorMessage(error));
      setItems([]);
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    loadList(false);
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    const loadDetail = async () => {
      try {
        setDetailLoading(true);
        setError(null);

        const res = await axios.get<ManageDetail>(
          `${API_BASE}/equipment-remodel-logs/manage/${selectedId}`,
          { headers: getAuthHeaders() }
        );

        setDetail(res.data);
      } catch (error) {
        setError(getErrorMessage(error));
        setDetail(null);
      } finally {
        setDetailLoading(false);
      }
    };

    loadDetail();
  }, [selectedId]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const selectedOptionIds = useMemo(
    () => new Set((detail?.checklist ?? []).map((item) => item.option_id)),
    [detail]
  );

  const updateDetailField = (field: keyof ManageDetail, value: string) => {
    setDetail((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateChecklistItem = (
    index: number,
    field: keyof ManageChecklistItem,
    value: string | number
  ) => {
    setDetail((prev) => {
      if (!prev) return prev;
      const next = [...prev.checklist];
      next[index] = { ...next[index], [field]: value } as ManageChecklistItem;
      return { ...prev, checklist: next };
    });
  };

  const addChecklistItem = () => {
    setDetail((prev) => {
      if (!prev) return prev;
      const candidate = optionList.find((item) => !selectedOptionIds.has(item.id));
      if (!candidate) {
        alert("추가할 수 있는 옵션이 없어.");
        return prev;
      }
      return {
        ...prev,
        checklist: [
          ...prev.checklist,
          {
            id: 0,
            option_id: candidate.id,
            option_name: candidate.option_name,
            remodel_time_text: "",
            delay_reason: "",
            sort_order: prev.checklist.length,
          },
        ],
      };
    });
  };

  const removeChecklistItem = (index: number) => {
    setDetail((prev) => {
      if (!prev) return prev;
      const next = prev.checklist.filter((_, idx) => idx !== index).map((item, idx) => ({
        ...item,
        sort_order: idx,
      }));
      return { ...prev, checklist: next };
    });
  };

  const handleSearch = async () => {
    await loadList(false);
  };

  const handleReset = async () => {
    setStartDate("");
    setEndDate("");
    setSearchText("");
    setTimeout(() => {
      loadList(false);
    }, 0);
  };

  const handleSave = async () => {
    if (!detail) return;

    try {
      setSaving(true);
      setError(null);

      await axios.put(
        `${API_BASE}/equipment-remodel-logs/manage/${detail.id}`,
        {
          machine_id: detail.machine_id,
          remodel_manager: detail.remodel_manager ?? "",
          manager_feedback: detail.manager_feedback ?? null,
          delay_reason: detail.delay_reason ?? null,
          checklist: detail.checklist.map((item, idx) => ({
            id: item.id > 0 ? item.id : undefined,
            option_id: Number(item.option_id),
            remodel_time_text: item.remodel_time_text ?? null,
            delay_reason: item.delay_reason ?? null,
            sort_order: idx,
          })),
        },
        { headers: getAuthHeaders() }
      );

      setSuccess("수정되었습니다.");
      await loadList(true);
      const res = await axios.get<ManageDetail>(
        `${API_BASE}/equipment-remodel-logs/manage/${detail.id}`,
        { headers: getAuthHeaders() }
      );
      setDetail(res.data);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    if (!window.confirm(`${detail.machine_id} 데이터를 삭제할까?`)) return;

    try {
      setDeleting(true);
      setError(null);

      await axios.delete(`${API_BASE}/equipment-remodel-logs/manage/${detail.id}`, {
        headers: getAuthHeaders(),
      });

      setSuccess("삭제되었습니다.");
      setDetail(null);
      setSelectedId(null);
      await loadList(false);
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 px-4 py-6">
      <div className="mx-auto w-full max-w-[1580px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-500">MES · Remodel Manage</div>
            <div className="text-2xl font-extrabold tracking-tight text-slate-900">
              장비 개조 로그 관리
            </div>
            <div className="mt-1 text-sm text-slate-500">
              machine_id, 담당자, 옵션 항목, 개조시간, 피드백, 지연 사유를 확인하고 수정/삭제하는 페이지야.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/log/remodel")}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              로그 페이지로
            </button>
            <button
              type="button"
              onClick={() => navigate("/main")}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              메인으로
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 ring-1 ring-emerald-100">
            {success}
          </div>
        )}

        <Shell
          header="조회 조건"
          subText="기간과 검색어로 목록을 좁힌 다음, 오른쪽에서 상세 수정하면 돼."
          badge="Manage"
        >
          <div className="grid grid-cols-1 gap-4 px-6 py-6 md:grid-cols-4">
            <div>
              <label className={LABEL_CLASS}>시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>검색어</label>
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="machine_id / 담당자"
                className={INPUT_CLASS}
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="flex-1 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700"
              >
                조회
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              >
                초기화
              </button>
            </div>
          </div>
        </Shell>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Shell
            header="개조 로그 목록"
            subText="수정할 장비를 선택해줘."
            badge={listLoading ? "불러오는 중" : `${items.length}건`}
          >
            <div className="max-h-[780px] space-y-3 overflow-y-auto px-6 py-6">
              {listLoading ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                  목록 불러오는 중…
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                  조회된 데이터가 없어.
                </div>
              ) : (
                items.map((item) => {
                  const active = selectedId === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
                        active
                          ? "border-sky-300 bg-sky-50"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-base font-extrabold text-slate-900">{item.machine_id}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            담당자 {item.remodel_manager || "-"} · 모델 {item.model || "-"}
                          </div>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                          #{item.id}
                        </span>
                      </div>

                      <div className="mt-3 rounded-2xl bg-white/80 px-3 py-3 text-sm text-slate-700 ring-1 ring-slate-200/70">
                        <div className="font-semibold text-slate-800">옵션 항목</div>
                        <div className="mt-1 text-slate-600">
                        {item.option_summary ||
                            (item.option_names && item.option_names.length > 0
                            ? item.option_names.join(", ")
                            : "-")}
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div>생성: {formatDateTime(item.created_at)}</div>
                        <div>수정: {formatDateTime(item.updated_at)}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Shell>

          <Shell
            header="상세 수정"
            subText="선택한 장비의 기본 정보와 옵션별 시간/지연 사유를 수정할 수 있어."
            badge={detail ? detail.machine_id : "선택 필요"}
            right={
              detail ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting || saving}
                    className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? "삭제 중..." : "삭제"}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || deleting}
                    className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              ) : null
            }
          >
            <div className="max-h-[780px] overflow-y-auto px-6 py-6">
              {!detail ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-16 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                  왼쪽 목록에서 장비를 선택해줘.
                </div>
              ) : detailLoading ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-16 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                  상세 불러오는 중…
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>machine_id</label>
                      <input
                        value={detail.machine_id}
                        onChange={(e) => updateDetailField("machine_id", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>개조 담당자</label>
                      <input
                        value={detail.remodel_manager ?? ""}
                        onChange={(e) => updateDetailField("remodel_manager", e.target.value)}
                        className={INPUT_CLASS}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className={LABEL_CLASS}>모델</label>
                      <input value={detail.model ?? "-"} disabled className={`${INPUT_CLASS} bg-slate-100`} />
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>담당자 피드백</label>
                    <textarea
                      value={detail.manager_feedback ?? ""}
                      onChange={(e) => updateDetailField("manager_feedback", e.target.value)}
                      className={TEXTAREA_CLASS}
                    />
                  </div>

                  <div className="rounded-3xl bg-slate-50 p-5 ring-1 ring-slate-200/70">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-extrabold text-slate-900">옵션 항목 관리</div>
                        <div className="mt-1 text-xs text-slate-500">
                          옵션별 개조시간과 지연 사유를 같이 수정할 수 있어.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={addChecklistItem}
                        className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700"
                      >
                        + 옵션 추가
                      </button>
                    </div>

                    <div className="space-y-4">
                      {detail.checklist.length === 0 ? (
                        <div className="rounded-2xl bg-white px-4 py-10 text-center text-sm text-slate-500 ring-1 ring-slate-200/70">
                          등록된 옵션이 없어.
                        </div>
                      ) : (
                        detail.checklist.map((item, index) => {
                          const availableOptions = optionList.filter(
                            (option) =>
                              option.id === item.option_id ||
                              !detail.checklist.some((row, rowIdx) => rowIdx !== index && row.option_id === option.id)
                          );

                          return (
                            <div key={`${item.id || "new"}-${index}`} className="rounded-3xl bg-white p-4 ring-1 ring-slate-200/70">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-extrabold text-slate-900">옵션 #{index + 1}</div>
                                    <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700 ring-1 ring-sky-200">
                                        {item.option_name ||
                                        optionList.find((row) => row.id === item.option_id)?.option_name ||
                                        "-"}
                                    </span>
                                    </div>
                                <button
                                  type="button"
                                  onClick={() => removeChecklistItem(index)}
                                  className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100"
                                >
                                  삭제
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                <div>
                                  <label className={LABEL_CLASS}>옵션 항목</label>
                                  <select
                                    value={item.option_id}
                                    onChange={(e) => {
                                      const optionId = Number(e.target.value);
                                      const optionName = optionList.find((row) => row.id === optionId)?.option_name ?? "";
                                      setDetail((prev) => {
                                        if (!prev) return prev;
                                        const next = [...prev.checklist];
                                        next[index] = {
                                          ...next[index],
                                          option_id: optionId,
                                          option_name: optionName,
                                        };
                                        return { ...prev, checklist: next };
                                      });
                                    }}
                                    className={SELECT_CLASS}
                                  >
                                    {availableOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.option_name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className={LABEL_CLASS}>개조 소요시간</label>
                                  <input
                                    value={item.remodel_time_text ?? ""}
                                    onChange={(e) => updateChecklistItem(index, "remodel_time_text", e.target.value)}
                                    placeholder="예) 2시간 30분 / 90분 / 2h"
                                    className={INPUT_CLASS}
                                  />
                                </div>
                                <div>
                                  <label className={LABEL_CLASS}>옵션 지연 사유</label>
                                  <input
                                    value={item.delay_reason ?? ""}
                                    onChange={(e) => updateChecklistItem(index, "delay_reason", e.target.value)}
                                    className={INPUT_CLASS}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 text-xs text-slate-500 md:grid-cols-2">
                    <div>생성일: {formatDateTime(detail.created_at)}</div>
                    <div>수정일: {formatDateTime(detail.updated_at)}</div>
                  </div>
                </div>
              )}
            </div>
          </Shell>
        </div>
      </div>
    </div>
  );
};

export default EquipmentRemodelManagePage;
