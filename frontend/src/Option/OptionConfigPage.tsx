// Option Configuration (DB 연동 + 타입 안정화 + 안전한 네비게이션)
// - 최초 진입 시 DB 목록 조회(기존 데이터 표시)
// - 추가(중복 제어) / 인라인 수정 저장 / 삭제(확인창)
// - 상세 수정 페이지로 이동(/options/modify/:id)
// - 검색(q 파라미터 서버 검색 + 클라 필터)
// - navigate 충돌 방지: routerNavigate(NavigateFunction) 사용

import React, { useEffect, useMemo, useState } from "react";
// ✅ navigate 이름 충돌 방지 + 타입 명시
import { useNavigate, type NavigateFunction } from "react-router-dom";

/** ======================= 환경/유틸 ======================= */
/** API 베이스: Vite .env(VITE_API_BASE) > 기본 '/api' */
const API_BASE: string = (() => {
  try {
    const env = (import.meta as any)?.env;
    const v = env?.VITE_API_BASE as string | undefined;
    return v && typeof v === "string" && v.trim() ? v : "/api";
  } catch {
    return "/api";
  }
})();
const OPTIONS_URL = `${API_BASE}/task-options`;

/** Authorization 헤더 유틸 (반환 타입 고정해서 headers 경고 제거) */
const authHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** window.confirm 안전 래퍼(SSR/테스트 환경 대비) */
const askConfirm = (message: string): boolean => {
  if (typeof window !== "undefined" && typeof window.confirm === "function") {
    return window.confirm(message);
  }
  return false;
};

/** ======================= 타입 ======================= */
type OptionRow = { id: number; name: string };

/** ======================= 컴포넌트 ======================= */
const OptionConfigPage: React.FC = () => {
  // ✅ navigate 충돌 방지: 명시적 타입 + 다른 변수명 사용
  const routerNavigate: NavigateFunction = useNavigate();

  /** ----------------------------- state ----------------------------- */
  const [list, setList] = useState<OptionRow[]>([]);     // 화면 목록
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // 추가 입력
  const [newName, setNewName] = useState<string>("");

  // 검색어
  const [q, setQ] = useState<string>("");

  // 인라인 편집 상태
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState<string>("");

  /** --------------------------- utilities --------------------------- */
  // 대소문자/공백 무시 중복 체크 (프론트 선제 제어)
  const hasDup = (name: string, exceptId?: number): boolean => {
    const norm = name.trim().toLowerCase();
    return list.some(
      (o) => o.id !== exceptId && o.name.trim().toLowerCase() === norm
    );
  };

  // 클라 필터(서버 검색과 병행)
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((o) => o.name.toLowerCase().includes(s));
  }, [q, list]);

  /** ----------------------------- API ------------------------------- */
  // 목록 조회 (서버 검색 q 적용)
  const fetchList = async (keyword = ""): Promise<void> => {
    try {
      setLoading(true);
      setErrorMsg("");
      const res = await fetch(`${OPTIONS_URL}?q=${encodeURIComponent(keyword)}`, {
        credentials: "include",
        headers: { ...authHeaders() }, // GET은 Content-Type 불필요
      });
      if (!res.ok) throw new Error(`목록 조회 실패: ${res.status}`);
      const data: OptionRow[] = await res.json();
      setList(data);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  // 추가
  const createOption = async (name: string): Promise<OptionRow> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeaders(),
    };
    const res = await fetch(OPTIONS_URL, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      throw new Error(
        res.status === 409 ? "이미 존재하는 옵션명입니다." : `추가 실패: ${res.status}`
      );
    }
    return (await res.json()) as OptionRow;
  };

  // 수정
  const updateOption = async (id: number, name: string): Promise<OptionRow> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...authHeaders(),
    };
    const res = await fetch(`${OPTIONS_URL}/${id}`, {
      method: "PUT", // 서버가 PATCH면 교체
      headers,
      credentials: "include",
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      throw new Error(
        res.status === 409 ? "이미 존재하는 옵션명입니다." : `수정 실패: ${res.status}`
      );
    }
    return (await res.json()) as OptionRow;
  };

  // 삭제
  const deleteOption = async (id: number): Promise<void> => {
    const res = await fetch(`${OPTIONS_URL}/${id}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
      credentials: "include",
    });
    if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
  };

  /** --------------------------- lifecycle --------------------------- */
  // ⭐ 최초 진입 시 DB 목록 즉시 로드 → 기존 데이터가 바로 보임
  useEffect(() => {
    void fetchList("");
  }, []);

  /** --------------------------- handlers ---------------------------- */
  // 추가
  const onAdd = async (): Promise<void> => {
    const name = newName.trim();
    if (!name) return;
    if (hasDup(name)) return void alert("이미 존재하는 옵션명입니다.");

    try {
      setLoading(true);
      const created = await createOption(name);
      setList((prev) => [created, ...prev]); // 최신을 위로
      setNewName("");
    } catch (e: any) {
      alert(e?.message ?? "추가 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 상세 수정 페이지 이동 (id + name 쿼리 전달)
  const goModifyPage = (row: OptionRow): void => {
    localStorage.setItem("selected_option_id", String(row.id));
    localStorage.setItem("selected_option_name", row.name);
    localStorage.setItem("selected_option_saved_at", new Date().toISOString());
    setTimeout(() => {
      routerNavigate(`/options/modify/${row.id}?name=${encodeURIComponent(row.name)}`);
    }, 300);
  };

  // 삭제
  const onDelete = async (row: OptionRow): Promise<void> => {
    if (!askConfirm(`"${row.name}" 옵션을 삭제하시겠습니까?`)) return;
    try {
      setLoading(true);
      await deleteOption(row.id);
      setList((prev) => prev.filter((x) => x.id !== row.id));
    } catch (e: any) {
      alert(e?.message ?? "삭제 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 인라인 편집 시작
  const onSelect = (row: OptionRow): void => {
    setEditingId(row.id);
    setEditingName(row.name);
  };

  // 인라인 저장
  const onSave = async (): Promise<void> => {
    if (editingId == null) return;
    const name = editingName.trim();
    if (!name) return void alert("옵션명을 입력해주세요.");
    if (hasDup(name, editingId)) return void alert("이미 존재하는 옵션명입니다.");

    try {
      setLoading(true);
      const updated = await updateOption(editingId, name);
      setList((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
      setEditingId(null);
      setEditingName("");
    } catch (e: any) {
      alert(e?.message ?? "수정 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 인라인 취소
  const onCancel = (): void => {
    setEditingId(null);
    setEditingName("");
  };

  // 검색 실행(엔터/버튼 공통)
  const onSearch = (): void => {
    void fetchList(q);
  };

  // 뒤로가기 → 메인
  const onBack = (): void => {
    routerNavigate("/main");
  };

  /** ----------------------------- render ----------------------------- */
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 md:p-10">
      {/* ⬆️ 크기 업: 카드 너비/패딩 확대, 둥근모서리/그림자 강화 */}
      <div className="w-full max-w-2xl md:max-w-3xl rounded-2xl bg-white p-8 md:p-10 shadow-xl">
        {/* 제목 */}
        {/* ⬆️ 크기 업: 제목 폰트 사이즈 업, 여백 확대 */}
        <h2 className="mb-3 text-center text-2xl md:text-3xl font-semibold text-purple-600">
          ✓ Option 선택
        </h2>
        <p className="mb-7 text-center text-base md:text-lg text-gray-500">
          옵션을 선택하거나 새로 추가하고, 필요 시 이름을 수정/삭제할 수 있습니다.
        </p>

        {/* 검색 */}
        <div className="mb-4 flex gap-3">
          {/* ⬆️ 크기 업: 입력 높이/폰트/포커스 링 강화 */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            placeholder="옵션 검색..."
            className="w-full rounded-xl border px-4 py-3 text-base md:text-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-200"
          />
          {/* ⬆️ 크기 업: 버튼 사이즈/폰트 확대 */}
          <button
            onClick={onSearch}
            className="rounded-xl bg-gray-200 px-5 py-3 text-base md:text-lg text-gray-800 hover:bg-gray-300"
          >
            검색
          </button>
        </div>

        {/* 새 옵션 입력 + 추가 */}
        <div className="mb-6 flex gap-3">
          {/* ⬆️ 크기 업: 입력 필드 확대 */}
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="예: hot, cold, ramp, ..."
            className="flex-1 rounded-xl border px-4 py-3 text-base md:text-lg focus:border-purple-500 focus:ring-4 focus:ring-purple-200"
          />
          {/* ⬆️ 크기 업: 강조 버튼 확대 */}
          <button
            onClick={onAdd}
            disabled={loading}
            className="rounded-xl bg-purple-500 px-6 py-3 text-base md:text-lg font-semibold text-white hover:bg-purple-600 disabled:opacity-60"
          >
            + 추가
          </button>
        </div>

        {/* 오류 메시지 */}
        {errorMsg && (
          <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm md:text-base text-red-600">
            {errorMsg}
          </div>
        )}

        {/* 옵션 목록 */}
        {/* ⬆️ 크기 업: 행 간격/최대 높이 확대 */}
        <div className="max-h-[560px] space-y-3.5 overflow-y-auto pr-1">
          {loading && list.length === 0 ? (
            <div className="rounded-md bg-gray-50 py-10 text-center text-base text-gray-500">
              불러오는 중…
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-md bg-gray-50 py-10 text-center text-base text-gray-500">
              표시할 옵션이 없습니다.
            </div>
          ) : (
            filtered.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <div key={row.id} className="flex items-center gap-3">
                  {/* 이름 표시 or 인라인 입력 */}
                  {isEditing ? (
                    // ⬆️ 크기 업: 인라인 입력 확대
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded-xl border px-4 py-2.5 text-base md:text-lg"
                    />
                  ) : (
                    // ⬆️ 크기 업: 보기용 필드 높이/폰트 확대
                    <span className="flex-1 rounded-xl border bg-gray-50 px-4 py-2.5 text-base md:text-lg">
                      {row.name}
                    </span>
                  )}

                  {/* 버튼 그룹 */}
                  {!isEditing ? (
                    <>
                      {/* ⬆️ 크기 업: 버튼 크기/폰트 확대 + 클릭영역 확보 */}
                      <button
                        onClick={() => onSelect(row)}
                        className="rounded-lg bg-purple-500 px-3.5 md:px-4 py-2 md:py-2.5 text-sm md:text-base font-semibold text-white"
                      >
                        선택
                      </button>
                      <button
                        onClick={() => goModifyPage(row)}
                        className="rounded-lg bg-gray-200 px-3.5 md:px-4 py-2 md:py-2.5 text-sm md:text-base text-gray-800"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onDelete(row)}
                        className="rounded-lg bg-red-500 px-3.5 md:px-4 py-2 md:py-2.5 text-sm md:text-base font-semibold text-white"
                      >
                        삭제
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={onSave}
                        disabled={loading}
                        className="rounded-lg bg-green-500 px-3.5 md:px-4 py-2 md:py-2.5 text-sm md:text-base font-semibold text-white disabled:opacity-60"
                      >
                        저장
                      </button>
                      <button
                        onClick={onCancel}
                        className="rounded-lg bg-gray-200 px-3.5 md:px-4 py-2 md:py-2.5 text-sm md:text-base text-gray-800"
                      >
                        취소
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 뒤로가기 → 메인 */}
        {/* ⬆️ 크기 업: 하단 버튼 확대 */}
        <div className="mt-8 text-center">
          <button
            onClick={onBack}
            className="rounded-xl bg-purple-500 px-6 py-3 text-base md:text-lg font-semibold text-white hover:bg-purple-600"
          >
            ← 뒤로가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default OptionConfigPage;
