// src/SetupDefectEntryPage/DefectCatalogModal.tsx
// ──────────────────────────────────────────────────────────────
// 불량 항목 관리(추가/수정/삭제)를 같은 페이지 위에서 모달로 띄우는 컴포넌트.
// - 페이지 이동을 하지 않으므로 기존에 입력 중이던 row data 가 그대로 유지된다.
// - 모달 안의 "저장" 버튼을 누르면 즉시 DB 에 반영된다.
// - onClose 가 호출되는 시점에 부모(SetupDefectEntryPage)가 카탈로그를
//   다시 불러오게 되어 있어, 모달을 닫는 것만으로 row data 폼의
//   불량 셀렉트 옵션이 자동으로 갱신된다.
// ──────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE =
  process.env.NODE_ENV === "production" ? "/api" : "http://192.168.101.1:8000/api";

const authHeaders = (): Record<string, string> => {
  const t = localStorage.getItem("access_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ─── 타입 ─────────────────────────────────────────────────────
type DefectCatalogItem = {
  id: number;
  defect: string;
  defect_types: string[];
};

type UiItem = DefectCatalogItem & {
  typesText: string; // textarea 편집용 (csv)
  saving?: boolean;
  deleting?: boolean;
};

const parseTypes = (csv: string) =>
  csv.split(",").map((t) => t.trim()).filter(Boolean);

const toCsv = (arr: string[]) => (arr ?? []).join(", ");

// ─── 스타일 토큰 ──────────────────────────────────────────────
const inputBase =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200";

const textareaBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-800 shadow-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 resize-y min-h-[42px]";

const softPanel = "rounded-xl bg-slate-50/80 ring-1 ring-slate-200/60";

// ─── Props ───────────────────────────────────────────────────
type Props = {
  open: boolean;
  onClose: () => void;
};

const DefectCatalogModal: React.FC<Props> = ({ open, onClose }) => {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [items, setItems] = useState<UiItem[]>([]);

  // 신규 추가 폼
  const [newDefect, setNewDefect] = useState("");
  const [newTypes, setNewTypes] = useState("");

  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await axios.get(`${API_BASE}/defect-catalog`, {
        headers: { ...authHeaders() },
      });
      const list: DefectCatalogItem[] = Array.isArray(res.data) ? res.data : [];
      setItems(
        list.map((x) => ({
          ...x,
          typesText: toCsv(x.defect_types),
        }))
      );
    } catch (e: any) {
      setErr(e?.response?.data?.detail ?? "목록 조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 모달이 열릴 때마다 최신 목록을 로드
  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ESC 로 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return items;
    return items.filter((x) => {
      const a = x.defect.toLowerCase().includes(kw);
      const b = x.typesText.toLowerCase().includes(kw);
      return a || b;
    });
  }, [items, q]);

  const createOne = async () => {
    const d = newDefect.trim();
    const types = parseTypes(newTypes);
    if (!d) return alert("불량명을 입력해주세요.");
    if (types.length === 0) return alert("불량유형을 1개 이상 입력해주세요.");

    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE}/defect-catalog`,
        { defect: d, defect_types: types },
        { headers: { ...authHeaders() } }
      );
      const created: DefectCatalogItem = res.data;
      setItems((p) => [
        {
          ...created,
          typesText: toCsv(created.defect_types),
        },
        ...p,
      ]);
      setNewDefect("");
      setNewTypes("");
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "추가 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const saveOne = async (id: number) => {
    const target = items.find((x) => x.id === id);
    if (!target) return;

    const d = target.defect.trim();
    const types = parseTypes(target.typesText);

    if (!d) return alert("불량명은 비울 수 없습니다.");
    if (types.length === 0) return alert("불량유형을 1개 이상 입력해주세요.");

    setItems((p) => p.map((x) => (x.id === id ? { ...x, saving: true } : x)));

    try {
      const res = await axios.put(
        `${API_BASE}/defect-catalog/${id}`,
        { defect: d, defect_types: types },
        { headers: { ...authHeaders() } }
      );
      const saved: DefectCatalogItem = res.data;
      setItems((p) =>
        p.map((x) =>
          x.id === id
            ? {
                ...saved,
                typesText: toCsv(saved.defect_types),
                saving: false,
              }
            : x
        )
      );
    } catch (e: any) {
      setItems((p) =>
        p.map((x) => (x.id === id ? { ...x, saving: false } : x))
      );
      alert(e?.response?.data?.detail ?? "저장 중 오류가 발생했습니다.");
    }
  };

  const deleteOne = async (id: number) => {
    const ok = window.confirm("정말 삭제할까요?");
    if (!ok) return;

    setItems((p) => p.map((x) => (x.id === id ? { ...x, deleting: true } : x)));

    try {
      await axios.delete(`${API_BASE}/defect-catalog/${id}`, {
        headers: { ...authHeaders() },
      });
      setItems((p) => p.filter((x) => x.id !== id));
    } catch (e: any) {
      setItems((p) =>
        p.map((x) => (x.id === id ? { ...x, deleting: false } : x))
      );
      alert(e?.response?.data?.detail ?? "삭제 중 오류가 발생했습니다.");
    }
  };

  const updateItem = (id: number, patch: Partial<UiItem>) => {
    setItems((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-stretch justify-center bg-black/50 backdrop-blur-sm">
      {/* 배경 클릭으로 닫기 */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
      />

      {/* 다이얼로그 본체 */}
      <div className="relative m-4 flex w-full max-w-[1280px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-sky-50 via-white to-amber-50 px-6 py-4">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-slate-500">MES</div>
            <div className="text-lg font-extrabold tracking-tight text-slate-900">
              불량 항목 관리
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              여기서 추가/수정/삭제하면 row data 폼이 자동으로 갱신됩니다.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              disabled={loading}
              className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "불러오는 중..." : "새로고침"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700"
              aria-label="닫기"
            >
              ✕ 닫기
            </button>
          </div>
        </div>

        {/* 본문 (스크롤 가능 영역) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-5">
          {/* 검색 */}
          <section className="rounded-2xl bg-slate-50/70 p-4 ring-1 ring-slate-200/60">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-bold tracking-wide text-slate-600">검색</div>
              <div className="text-xs text-slate-500">
                {loading ? "불러오는 중..." : `총 ${items.length}개`}
              </div>
            </div>
            <input
              className={inputBase}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="불량명 / 불량유형 검색"
            />
            {err && (
              <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                {err}
              </div>
            )}
          </section>

          {/* 신규 추가 */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/60 shadow-sm">
            <div className="mb-3 text-xs font-bold tracking-wide text-slate-600">
              신규 추가
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">
                  불량 <span className="font-normal text-slate-400">(예: Cover)</span>
                </div>
                <input
                  className={inputBase}
                  value={newDefect}
                  onChange={(e) => setNewDefect(e.target.value)}
                  placeholder="불량명"
                />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-500">
                  불량유형{" "}
                  <span className="font-normal text-slate-400">
                    (쉼표로 구분 / 예: 도장불량, 스크래치)
                  </span>
                </div>
                <textarea
                  className={textareaBase}
                  value={newTypes}
                  onChange={(e) => setNewTypes(e.target.value)}
                  placeholder="예: 도장불량, 스크래치, 파손"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={createOne}
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-sky-600 to-teal-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:from-sky-700 hover:to-teal-700 disabled:opacity-60"
              >
                추가
              </button>
              <div className={`px-3 py-2 text-xs text-slate-600 ${softPanel}`}>
                불량유형은 <b>쉼표(,)</b>로 나눠서 입력하면 됩니다.
              </div>
            </div>
          </section>

          {/* 목록 */}
          <section className="rounded-2xl bg-white p-4 ring-1 ring-slate-200/60 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-bold tracking-wide text-slate-600">목록</div>
            </div>

            <div className="space-y-3">
              {filtered.map((x) => {
                const chips = parseTypes(x.typesText);
                return (
                  <div
                    key={x.id}
                    className="rounded-2xl bg-white/90 p-3 ring-1 ring-slate-200/70 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-700 ring-1 ring-slate-200">
                          #{x.id}
                        </span>
                        <div className="text-xs font-semibold text-slate-500">
                          수정 후 저장을 눌러 적용
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => saveOne(x.id)}
                          disabled={x.saving || x.deleting}
                          className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:from-orange-600 hover:to-amber-600 disabled:opacity-60"
                        >
                          {x.saving ? "저장중..." : "저장"}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteOne(x.id)}
                          disabled={x.saving || x.deleting}
                          className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm hover:bg-red-600 disabled:opacity-60"
                        >
                          {x.deleting ? "삭제중..." : "삭제"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-500">불량</div>
                        <input
                          className={inputBase}
                          value={x.defect}
                          onChange={(e) => updateItem(x.id, { defect: e.target.value })}
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] font-semibold text-slate-500">
                          불량유형{" "}
                          <span className="font-normal text-slate-400">(쉼표 구분)</span>
                        </div>
                        <textarea
                          className={textareaBase}
                          value={x.typesText}
                          onChange={(e) =>
                            updateItem(x.id, { typesText: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {chips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {chips.map((c, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className={`p-3 text-xs text-slate-600 ${softPanel}`}>
                  검색 결과가 없습니다.
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-900 px-4 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-slate-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefectCatalogModal;
