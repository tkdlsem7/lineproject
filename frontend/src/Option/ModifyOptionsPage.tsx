// Modify Options 페이지
// - URL: /options/modify/:id?name=<옵션명>
// - 선택한 옵션명으로 /api/checklist?option=<name> 조회
// - 목록에서 step/item/hours 인라인 편집 후 저장(= PUT)
// - 새 step 추가(= POST), 삭제(= DELETE)
// - 디자인 사이즈(글꼴/패딩) 업

import React, { useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  type NavigateFunction,
} from "react-router-dom";

/** ======================= 환경/유틸 ======================= */
const API_BASE: string = (() => {
  try {
    const env = (import.meta as any)?.env;
    const v = env?.VITE_API_BASE as string | undefined;
    return v && typeof v === "string" && v.trim() ? v : "/api";
  } catch {
    return "/api";
  }
})();
const CHECKLIST_URL = `${API_BASE}/checklist`;

/** JWT 헤더 */
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** 타입 (백엔드 모델에 맞춤) */
type ChecklistRow = {
  no: number;     // PK
  option: string; // 옵션명
  step: number;
  item: string;
  hours: number;
};

const ModifyOptionsPage: React.FC = () => {
  const routerNavigate: NavigateFunction = useNavigate();
  const params = useParams<{ id?: string }>();
  const [searchParams] = useSearchParams();

  /** ----------------------------- state ----------------------------- */
  // 1) 옵션명 결정: 쿼리 > localStorage > 빈 문자열
  const optionFromQS = searchParams.get("name") ?? "";
  const optionFromLS = localStorage.getItem("selected_option_name") ?? "";
  const optionName = (optionFromQS || optionFromLS).trim();

  // 목록/로딩/오류
  const [list, setList] = useState<ChecklistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // 클라 검색
  const [q, setQ] = useState("");

  // 인라인 편집 상태 (특정 행 하나만 편집)
  const [editNo, setEditNo] = useState<number | null>(null);
  const [editStep, setEditStep] = useState<string>("");
  const [editItem, setEditItem] = useState<string>("");
  const [editHours, setEditHours] = useState<string>("");

  // 새 행 추가용 폼
  const [newStep, setNewStep] = useState<string>("");
  const [newItem, setNewItem] = useState<string>("");
  const [newHours, setNewHours] = useState<string>("");

  /** ----------------------------- helpers --------------------------- */
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(
      (r) =>
        r.item.toLowerCase().includes(s) ||
        String(r.step).includes(s) ||
        String(r.hours).includes(s)
    );
  }, [q, list]);

  const parseIntSafe = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
    // step은 정수(자연수)로 사용
  };

  const parseFloatSafe = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  /** ----------------------------- API ------------------------------- */
  const fetchChecklist = async (optName: string) => {
    if (!optName) {
      setErrorMsg("옵션명이 비어 있습니다. 이전 화면에서 다시 선택해주세요.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg("");
      const url = `${CHECKLIST_URL}?option=${encodeURIComponent(optName)}`;
      const res = await fetch(url, {
        headers: { ...authHeaders() },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
      const data: ChecklistRow[] = await res.json();
      setList(data);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  const createRow = async (payload: {
    option: string;
    step: number;
    item: string;
    hours: number;
  }): Promise<ChecklistRow> => {
    const res = await fetch(CHECKLIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`추가 실패: ${res.status}`);
    return (await res.json()) as ChecklistRow;
  };

  const updateRow = async (
    no: number,
    payload: { step: number; item: string; hours: number }
  ): Promise<ChecklistRow> => {
    const res = await fetch(`${CHECKLIST_URL}/${no}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`수정 실패: ${res.status}`);
    return (await res.json()) as ChecklistRow;
  };

  const deleteRow = async (no: number): Promise<void> => {
    const res = await fetch(`${CHECKLIST_URL}/${no}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
  };

  /** --------------------------- lifecycle --------------------------- */
  useEffect(() => {
    void fetchChecklist(optionName);
  }, [optionName]);

  /** ----------------------------- handlers -------------------------- */
  // 편집 시작
  const onEdit = (row: ChecklistRow) => {
    setEditNo(row.no);
    setEditStep(String(row.step));
    setEditItem(row.item);
    setEditHours(String(row.hours));
  };

  // 편집 취소
  const onCancel = () => {
    setEditNo(null);
    setEditStep("");
    setEditItem("");
    setEditHours("");
  };

  // 편집 저장
  const onSave = async () => {
    if (editNo == null) return;

    const stepNum = parseIntSafe(editStep);
    const hoursNum = parseFloatSafe(editHours);

    if (!editItem.trim()) return alert("Item 을 입력해주세요.");
    if (!Number.isFinite(stepNum) || stepNum <= 0) return alert("Step 은 1 이상의 정수로 입력해주세요.");
    if (!Number.isFinite(hoursNum) || hoursNum < 0) return alert("Hours 는 0 이상의 숫자입니다.");

    try {
      setLoading(true);
      const updated = await updateRow(editNo, {
        step: stepNum,
        item: editItem.trim(),
        hours: hoursNum,
      });
      setList((prev) => prev.map((r) => (r.no === editNo ? updated : r)));
      onCancel();
    } catch (e: any) {
      alert(e?.message ?? "수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 삭제
  const onDelete = async (row: ChecklistRow) => {
    if (!window.confirm(`Step ${row.step} - "${row.item}" 을 삭제할까요?`)) return;
    try {
      setLoading(true);
      await deleteRow(row.no);
      setList((prev) => prev.filter((r) => r.no !== row.no));
    } catch (e: any) {
      alert(e?.message ?? "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 새 행 추가
  const onAdd = async () => {
    const stepNum = parseIntSafe(newStep);
    const hoursNum = parseFloatSafe(newHours);

    if (!newItem.trim()) return alert("Item 을 입력해주세요.");
    if (!Number.isFinite(stepNum) || stepNum <= 0) return alert("Step 은 1 이상의 정수로 입력해주세요.");
    if (!Number.isFinite(hoursNum) || hoursNum < 0) return alert("Hours 는 0 이상의 숫자입니다.");

    try {
      setLoading(true);
      const created = await createRow({
        option: optionName, // 선택 옵션명으로 고정
        step: stepNum,
        item: newItem.trim(),
        hours: hoursNum,
      });
      // step 순으로 다시 정렬해서 보여주기
      setList((prev) =>
        [...prev, created].sort((a, b) => a.step - b.step || a.no - b.no)
      );
      setNewStep("");
      setNewItem("");
      setNewHours("");
    } catch (e: any) {
      alert(e?.message ?? "추가 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-8 shadow-xl ring-1 ring-gray-100">
        {/* 헤더 */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-purple-600">Modify Options</h2>
            <p className="mt-1 text-base text-gray-600">
              선택 옵션:{" "}
              <span className="font-semibold text-gray-800">{optionName || "미지정"}</span>
              {params.id ? <span className="ml-2 text-gray-400">(# {params.id})</span> : null}
            </p>
          </div>

          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="항목/단계/시간 검색…"
              className="w-64 rounded-xl border px-4 py-2.5 text-base focus:border-purple-500 focus:ring-2 focus:ring-purple-300"
            />
            <button
              onClick={() => routerNavigate("/options")}
              className="rounded-xl bg-purple-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-purple-700"
            >
              ← 옵션 목록으로
            </button>
          </div>
        </div>

        {/* 오류 메시지 */}
        {errorMsg && (
          <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {/* 새 행 추가 폼 */}
        <div className="mb-6 rounded-xl border bg-gray-50 px-4 py-4">
          <div className="mb-3 text-sm font-semibold text-gray-700">새 Step 추가</div>
          <div className="grid grid-cols-12 gap-3">
            <input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Step"
              className="col-span-2 rounded-lg border px-3 py-2 text-base"
              inputMode="numeric"
            />
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Item"
              className="col-span-7 rounded-lg border px-3 py-2 text-base"
            />
            <input
              value={newHours}
              onChange={(e) => setNewHours(e.target.value)}
              placeholder="Hours"
              className="col-span-2 rounded-lg border px-3 py-2 text-base"
              inputMode="decimal"
            />
            <button
              onClick={onAdd}
              disabled={loading}
              className="col-span-1 rounded-lg bg-green-600 px-3 py-2 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-60"
            >
              추가
            </button>
          </div>
        </div>

        {/* 목록 테이블 (인라인 편집) */}
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-6">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="px-3 py-2">Step</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Hours</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && list.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    불러오는 중…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                    표시할 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered
                  .slice()
                  .sort((a, b) => a.step - b.step || a.no - b.no)
                  .map((r) => {
                    const isEdit = editNo === r.no;
                    return (
                      <tr key={r.no} className="rounded-xl bg-gray-50 text-base text-gray-800">
                        {/* Step */}
                        <td className="px-3 py-2 align-top">
                          {isEdit ? (
                            <input
                              value={editStep}
                              onChange={(e) => setEditStep(e.target.value)}
                              className="w-24 rounded-lg border px-3 py-2"
                              inputMode="numeric"
                            />
                          ) : (
                            r.step
                          )}
                        </td>

                        {/* Item */}
                        <td className="px-3 py-2 align-top">
                          {isEdit ? (
                            <input
                              value={editItem}
                              onChange={(e) => setEditItem(e.target.value)}
                              className="w-full rounded-lg border px-3 py-2"
                            />
                          ) : (
                            r.item
                          )}
                        </td>

                        {/* Hours */}
                        <td className="px-3 py-2 align-top">
                          {isEdit ? (
                            <input
                              value={editHours}
                              onChange={(e) => setEditHours(e.target.value)}
                              className="w-32 rounded-lg border px-3 py-2"
                              inputMode="decimal"
                            />
                          ) : (
                            r.hours
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 align-top">
                          {!isEdit ? (
                            <div className="flex gap-2">
                              <button
                                onClick={() => onEdit(r)}
                                className="rounded-lg bg-purple-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                              >
                                수정
                              </button>
                              <button
                                onClick={() => onDelete(r)}
                                className="rounded-lg bg-red-500 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-600"
                              >
                                삭제
                              </button>
                            </div>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={onSave}
                                disabled={loading}
                                className="rounded-lg bg-green-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                              >
                                저장
                              </button>
                              <button
                                onClick={onCancel}
                                className="rounded-lg bg-gray-200 px-3.5 py-2 text-sm text-gray-800 hover:bg-gray-300"
                              >
                                취소
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ModifyOptionsPage;
