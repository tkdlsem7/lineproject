// 📁 src/User/UserEditPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

// ✅ MainPage랑 동일한 방식 (운영: /api, 로컬: http://localhost:8000/api)
const API_BASE = 'http://192.168.101.1:8000/api';

type UserMe = {
  id: string;
  name: string;
  dept: string | null;
  auth: number;
};

type FormState = {
  id: string;
  name: string;
  dept: string;

  currentPw: string; // 아이디/비번 바꿀 때 필요
  newPw: string;
  newPwConfirm: string;
};

function normalizeToken(raw: string) {
  let t = raw.trim();

  // "...." 형태면 따옴표 제거
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1);
  }

  // 혹시 JSON.stringify({access_token:"..."}) 형태면 파싱 시도
  try {
    const obj = JSON.parse(raw);
    if (obj?.access_token) t = String(obj.access_token);
  } catch {}

  if (t.startsWith("Bearer ")) t = t.slice(7);
  return t.trim();
}

function getAuthHeader(): Record<string, string> {
  const raw =
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");
  if (!raw) return {};

  const token = normalizeToken(raw);
  if (!token) return {};

  return { Authorization: `Bearer ${token}` };
}

/* ---------------- UI helpers (MainPage 톤) ---------------- */
const CARD =
  "rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden";
const BAR =
  "h-[3px] w-full bg-gradient-to-r from-sky-300 via-teal-300 to-orange-300";
const HEADER =
  "flex items-start justify-between gap-3 border-b border-slate-100 bg-sky-50/60 px-6 py-4";
const BODY = "p-6 md:p-7";

const LABEL = "mb-2 block text-sm font-extrabold text-slate-700";
const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:bg-slate-50";

function PillButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: "primary" | "blue" | "ghost";
  }
) {
  const { tone = "ghost", className = "", ...rest } = props;

  const base =
    "rounded-full px-4 py-2 text-sm font-extrabold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60";
  const styles =
    tone === "primary"
      ? "text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 ring-1 ring-black/5"
      : tone === "blue"
      ? "text-white bg-sky-600 hover:bg-sky-700 ring-1 ring-black/5"
      : "text-slate-700 bg-white border border-slate-200 hover:bg-slate-50";

  return <button className={`${base} ${styles} ${className}`} {...rest} />;
}

function SectionCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={CARD}>
      <div className={BAR} />
      <div className={HEADER}>
        <div className="min-w-0">
          <div className="text-lg font-extrabold text-slate-900">{title}</div>
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </div>
      <div className={BODY}>{children}</div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function UserEditPage() {
  const nav = useNavigate();

  // (표시용) 로그인 시 저장한 user_name
  const currentUserName = useMemo(() => {
    const n = localStorage.getItem("user_name");
    return n && n.trim() ? n : "사용자";
  }, []);

  const [me, setMe] = useState<UserMe | null>(null);

  const [form, setForm] = useState<FormState>({
    id: "",
    name: currentUserName,
    dept: "",
    currentPw: "",
    newPw: "",
    newPwConfirm: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const onChange =
    (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((prev) => ({ ...prev, [key]: e.target.value }));
    };

  const idChanged = !!me && form.id.trim() && form.id.trim() !== me.id;
  const wantsPwChange = form.newPw.trim().length > 0;
  const needsCurrentPw = idChanged || wantsPwChange;

  const pwMismatch =
    wantsPwChange &&
    form.newPwConfirm.trim().length > 0 &&
    form.newPw !== form.newPwConfirm;

  // ✅ 최초 진입 시 내 정보 로드
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setErrMsg(null);

      const headers = getAuthHeader();
      if (!headers.Authorization) {
        nav("/", { replace: true });
        return;
      }

      try {
        const { data } = await axios.get<UserMe>(`${API_BASE}/account/me`, {
          headers,
          timeout: 8000,
          signal: controller.signal,
        });

        if (!alive) return;

        setMe(data);
        setForm((prev) => ({
          ...prev,
          id: data.id,
          name: data.name ?? prev.name,
          dept: data.dept ?? "",
          currentPw: "",
          newPw: "",
          newPwConfirm: "",
        }));
      } catch (e) {
        console.error(e);
        if (!alive) return;
        setErrMsg("회원 정보를 불러오지 못했습니다. (토큰/서버 상태 확인)");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [nav]);

  // 메시지 자동 제거(성공)
  useEffect(() => {
    if (!okMsg) return;
    const t = window.setTimeout(() => setOkMsg(null), 2500);
    return () => window.clearTimeout(t);
  }, [okMsg]);

  const onReset = () => {
    if (!me) return;
    setErrMsg(null);
    setOkMsg(null);
    setForm({
      id: me.id,
      name: me.name ?? currentUserName,
      dept: me.dept ?? "",
      currentPw: "",
      newPw: "",
      newPwConfirm: "",
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!me || saving) return;

    setErrMsg(null);
    setOkMsg(null);

    if (!form.id.trim()) return setErrMsg("아이디를 입력해 주세요.");
    if (!form.name.trim()) return setErrMsg("이름을 입력해 주세요.");
    if (pwMismatch) return setErrMsg("비밀번호 확인이 일치하지 않습니다.");

    if (needsCurrentPw && !form.currentPw.trim()) {
      return setErrMsg("아이디/비밀번호 변경 시 현재 비밀번호가 필요합니다.");
    }

    const headers = getAuthHeader();
    if (!headers.Authorization) {
      nav("/", { replace: true });
      return;
    }

    // ✅ 필요한 것만 전송
    const body: any = {
      name: form.name.trim(),
      dept: form.dept.trim() ? form.dept.trim() : null,
    };
    if (idChanged) body.new_id = form.id.trim();
    if (wantsPwChange) body.new_pw = form.newPw;
    if (needsCurrentPw) body.current_pw = form.currentPw;

    try {
      setSaving(true);

      const { data } = await axios.put<{
        user: UserMe;
        access_token?: string | null;
      }>(`${API_BASE}/account/me`, body, { headers, timeout: 8000 });

      // ✅ 토큰 갱신(아이디 변경 시 새 토큰 내려줌)
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        try {
          axios.defaults.headers.common["Authorization"] = `Bearer ${data.access_token}`;
        } catch {}
      }

      // ✅ 화면/로컬 상태 갱신
      setMe(data.user);
      localStorage.setItem("user_name", data.user.name || data.user.id);

      setForm((prev) => ({
        ...prev,
        id: data.user.id,
        name: data.user.name ?? prev.name,
        dept: data.user.dept ?? "",
        currentPw: "",
        newPw: "",
        newPwConfirm: "",
      }));

      setOkMsg("저장되었습니다.");
    } catch (e: any) {
      console.error(e);
      const status = e?.response?.status;

      if (status === 401) setErrMsg("로그인이 만료되었습니다. 다시 로그인해 주세요.");
      else if (status === 409) setErrMsg("이미 사용 중인 아이디입니다.");
      else setErrMsg(e?.response?.data?.detail ?? "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full">
      {/* 상단 타이틀 영역 (메인 페이지 결) */}
      <div className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-extrabold text-slate-400">MES / 설정</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">
              회원정보 수정
            </div>
            <div className="mt-1 text-sm text-slate-500">
              아이디 / 이름 / 부서 / 비밀번호를 수정할 수 있습니다.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PillButton tone="blue" type="button" onClick={() => nav("/main")}>
              메인으로
            </PillButton>
            <PillButton tone="ghost" type="button" onClick={() => nav(-1)}>
              뒤로가기
            </PillButton>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 px-6 pb-10 lg:grid-cols-12">
        {/* 좌측: 요약 */}
        <div className="lg:col-span-4">
          <SectionCard
            title="내 정보 요약"
            right={
              loading ? (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600">
                  Loading
                </span>
              ) : me ? (
                <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-extrabold text-teal-700 ring-1 ring-teal-200/60">
                  auth {me.auth}
                </span>
              ) : null
            }
          >
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-orange-200 to-amber-200 text-xl font-black text-slate-800 ring-1 ring-black/5">
                {(me?.name || currentUserName).slice(0, 1)}
              </div>

              <div className="min-w-0">
                <div className="text-sm text-slate-500">현재 로그인</div>
                <div className="truncate text-base font-extrabold text-slate-900">
                  {me?.name ?? currentUserName}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  ID:{" "}
                  <span className="font-bold text-slate-700">{me?.id ?? "-"}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-700">
              <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200/60">
                <div className="font-extrabold text-slate-800">수정 가능</div>
                <div className="mt-1">아이디 / 비밀번호 / 이름 / 부서</div>
              </div>

              <div className="rounded-xl bg-orange-50 px-4 py-3 ring-1 ring-orange-200/60">
                <div className="font-extrabold text-slate-800">보안 규칙</div>
                <div className="mt-1 leading-relaxed">
                  <span className="font-bold">아이디 또는 비밀번호 변경</span> 시{" "}
                  <span className="font-bold">현재 비밀번호</span>가 필요합니다.
                </div>
              </div>

              <div className="rounded-xl bg-sky-50 px-4 py-3 ring-1 ring-sky-200/60">
                <div className="font-extrabold text-slate-800">부서</div>
                <div className="mt-1">
                  {loading ? "불러오는 중…" : me?.dept ?? "-"}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 우측: 폼 */}
        <div className="lg:col-span-8">
          <form onSubmit={onSubmit}>
            <SectionCard title="회원 정보 수정">
              {/* 상태 메시지 */}
              <div className="space-y-2">
                {errMsg && (
                  <div className="rounded-xl border border-red-200/70 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-700">
                    {errMsg}
                  </div>
                )}
                {okMsg && (
                  <div className="rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-700">
                    {okMsg}
                  </div>
                )}
              </div>

              {/* 입력 */}
              <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label className={LABEL}>아이디</label>
                  <input
                    value={form.id}
                    onChange={onChange("id")}
                    placeholder="예) moon"
                    disabled={loading || !me}
                    className={INPUT}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    아이디 변경 시 다른 테이블(user_id 참조)에 영향이 있을 수 있습니다.
                  </p>
                </div>

                <div>
                  <label className={LABEL}>이름</label>
                  <input
                    value={form.name}
                    onChange={onChange("name")}
                    placeholder="예) 박종문"
                    disabled={loading || !me}
                    className={INPUT}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={LABEL}>부서</label>
                  <input
                    value={form.dept}
                    onChange={onChange("dept")}
                    placeholder="예) 통합생산실"
                    disabled={loading || !me}
                    className={INPUT}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={LABEL}>
                    현재 비밀번호{" "}
                    {needsCurrentPw && (
                      <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-black text-orange-700 ring-1 ring-orange-200/60">
                        필수
                      </span>
                    )}
                  </label>
                  <input
                    value={form.currentPw}
                    onChange={onChange("currentPw")}
                    type="password"
                    placeholder="아이디/비밀번호 변경 시 필요"
                    disabled={loading || !me}
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className={LABEL}>새 비밀번호</label>
                  <input
                    value={form.newPw}
                    onChange={onChange("newPw")}
                    type="password"
                    placeholder="변경하지 않으면 비워두세요"
                    disabled={loading || !me}
                    className={INPUT}
                  />
                </div>

                <div>
                  <label className={LABEL}>비밀번호 확인</label>
                  <input
                    value={form.newPwConfirm}
                    onChange={onChange("newPwConfirm")}
                    type="password"
                    placeholder="새 비밀번호 다시 입력"
                    disabled={loading || !me}
                    className={`${INPUT} ${
                      pwMismatch
                        ? "border-red-300 focus:border-red-300 focus:ring-red-100"
                        : ""
                    }`}
                  />
                  {pwMismatch && (
                    <p className="mt-2 text-xs font-extrabold text-red-600">
                      비밀번호가 서로 다릅니다.
                    </p>
                  )}
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <PillButton tone="ghost" type="button" onClick={() => nav("/main")}>
                  취소
                </PillButton>

                <div className="flex gap-2">
                  <PillButton
                    tone="ghost"
                    type="button"
                    onClick={onReset}
                    disabled={loading || !me || saving}
                  >
                    초기화
                  </PillButton>
                  <PillButton
                    tone="primary"
                    type="submit"
                    disabled={loading || !me || saving}
                  >
                    {saving ? "저장 중..." : "저장"}
                  </PillButton>
                </div>
              </div>
            </SectionCard>
          </form>
        </div>
      </div>
    </div>
  );
}
