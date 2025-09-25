// src/MachineMoving/MoveEquipmentPage.tsx
import React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type EquipmentRow = {
  machine_id: string;
  site: string;
  slot: string;
  manager?: string | null;
  progress?: number | null;
};

// 프로젝트 설정에 따라 /api 프리픽스를 사용하지 않으면 "" 로 변경
const API_BASE = "/api";

// 요구: 사이트는 3개 고정
const SITES = ["본사", "진우리", "부항리"] as const;

const MoveEquipmentPage: React.FC = () => {
  const nav = useNavigate();
  const url = new URLSearchParams(window.location.search);
  const initialSelected = url.get("machine_id") ?? "";

  // 선택된 사이트
  const [site, setSite] = React.useState<string>("본사");

  // 좌측 리스트 데이터/상태
  const [rows, setRows] = React.useState<EquipmentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // 검색어
  const [q, setQ] = React.useState("");

  // 선택된 장비 & 이동 계획
  const [checked, setChecked] = React.useState<Record<string, boolean>>(
    initialSelected ? { [initialSelected]: true } : {}
  );
  const [movePlan, setMovePlan] = React.useState<
    Record<string, { site?: string; slot?: string }>
  >({});

  // 사이트 변경 시 목록 로드
  React.useEffect(() => {
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const { data } = await axios.get<{ site: string; items: EquipmentRow[] }>(
          `${API_BASE}/move/equipments`,
          { params: { site } }
        );
        setRows(data.items ?? []);

        // url로 온 machine_id가 있으면 기본 체크/계획 세팅
        if (initialSelected && (data.items ?? []).some(r => r.machine_id === initialSelected)) {
          setChecked((m) => ({ ...m, [initialSelected]: true }));
          setMovePlan((p) => ({ ...p, [initialSelected]: { site, slot: "" } }));
        }
      } catch {
        setErr("장비 목록을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [site, initialSelected]);

  // 좌측 검색 필터
  const filteredRows = React.useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return rows;
    return rows.filter(r =>
      (r.machine_id || "").toLowerCase().includes(kw) ||
      (r.slot || "").toLowerCase().includes(kw) ||
      (r.manager || "").toLowerCase().includes(kw)
    );
  }, [q, rows]);

  const toggleCheck = (mid: string) => {
    setChecked((m) => {
      const next = !m[mid];
      const out = { ...m, [mid]: next };
      if (next) {
        setMovePlan((p) => ({ ...p, [mid]: p[mid] || { site, slot: "" } }));
      }
      return out;
    });
  };

  const setPlanSite = (mid: string, v: string) =>
    setMovePlan((p) => ({ ...p, [mid]: { ...p[mid], site: v } }));

  const setPlanSlot = (mid: string, v: string) =>
    setMovePlan((p) => ({ ...p, [mid]: { ...p[mid], slot: v.toUpperCase() } }));

  const applyMove = async () => {
    const targets = rows
      .filter((r) => checked[r.machine_id])
      .map((r) => ({ id: r.machine_id, plan: movePlan[r.machine_id] || {} }));

    if (targets.length === 0) {
      alert("이동할 장비를 선택하세요.");
      return;
    }
    for (const t of targets) {
      if (!t.plan.site || !t.plan.slot) {
        alert(`장비 ${t.id}: 이동 Site/Slot을 선택하세요.`);
        return;
      }
    }

    const payload = {
      items: targets.map((t) => ({
        machine_id: t.id,
        to_site: t.plan.site!,
        to_slot: t.plan.slot!,
      })),
    };

    try {
      await axios.post(`${API_BASE}/move/apply`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      alert("장비 이동이 적용되었습니다.");

      // 재조회
      const { data } = await axios.get<{ site: string; items: EquipmentRow[] }>(
        `${API_BASE}/move/equipments`,
        { params: { site } }
      );
      setRows(data.items ?? []);
      setChecked({});
      setMovePlan({});
    } catch (e: any) {
      const resp = e?.response;
      // ✅ 백엔드 409(conflict) 응답 처리
      if (resp?.status === 409 && resp?.data?.conflicts?.length) {
        const lines = resp.data.conflicts.map(
          (c: any) => `- ${c.site} / ${c.slot} 슬롯은 이미 ${c.current_machine_id} 점유 중`
        );
        alert(`이동 불가 슬롯이 있습니다:\n${lines.join("\n")}`);
        return;
      }
      console.error(e);
      alert("이동 적용 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* 헤더 */}
      <div className="rounded-3xl bg-gradient-to-r from-sky-500 to-indigo-600 p-6 text-white shadow-lg mb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => nav(-1)}
            className="rounded-lg bg-white/20 px-3 py-1.5 text-sm hover:bg-white/30"
          >
            ← 뒤로가기
          </button>
          <h1 className="text-3xl font-extrabold">장비 이동 관리</h1>
          <div />
        </div>
        <div className="mt-5 w-72">
          <label className="block text-sm text-white/80 mb-1">Site</label>
          <select
            className="w-full rounded-lg bg-white/90 px-3 py-2 text-slate-800"
            value={site}
            onChange={(e) => setSite(e.target.value)}
          >
            {SITES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 본문 */}
      <div className="grid grid-cols-2 gap-8">
        {/* 좌측: 장비 목록 */}
        <div className="rounded-2xl bg-white p-4 shadow">
          <div className="flex items-center justify-between px-2">
            <h2 className="pb-3 text-xl font-semibold">장비 목록</h2>
          </div>

          {/* 검색창 */}
          <div className="mb-3 flex items-center gap-2 px-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색: 호기 / 슬롯 / 담당자"
              className="w-full rounded-md border px-3 py-1.5 text-sm"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="rounded-md border px-2 py-1 text-xs"
              >
                초기화
              </button>
            )}
          </div>

          {loading && <div className="p-3 text-sm text-slate-500">로딩 중…</div>}
          {err && <div className="p-3 text-sm text-red-500">{err}</div>}
          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left">호기</th>
                  <th className="px-3 py-2 text-left">Site</th>
                  <th className="px-3 py-2 text-left">Slot</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredRows.map((r) => (
                  <tr key={r.machine_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!checked[r.machine_id]}
                        onChange={() => toggleCheck(r.machine_id)}
                      />
                    </td>
                    <td className="px-3 py-2">{r.machine_id}</td>
                    <td className="px-3 py-2">{r.site}</td>
                    <td className="px-3 py-2">{r.slot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: 이동 설정 */}
        <div className="rounded-2xl bg-white p-4 shadow">
          <h2 className="px-2 pb-3 text-xl font-semibold">이동 설정</h2>
          <div className="overflow-hidden rounded-xl border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">장비 ID</th>
                  <th className="px-3 py-2 text-left">현재 Site</th>
                  <th className="px-3 py-2 text-left">현재 Slot</th>
                  <th className="px-3 py-2 text-left">이동 Site</th>
                  <th className="px-3 py-2 text-left">이동 Slot</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows
                  .filter((r) => checked[r.machine_id])
                  .map((r) => {
                    const plan = movePlan[r.machine_id] || {};
                    return (
                      <tr key={r.machine_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2">{r.machine_id}</td>
                        <td className="px-3 py-2">{r.site}</td>
                        <td className="px-3 py-2">{r.slot}</td>
                        <td className="px-3 py-2">
                          <select
                            className="rounded-md border px-2 py-1"
                            value={plan.site ?? ""}
                            onChange={(e) => setPlanSite(r.machine_id, e.target.value)}
                          >
                            <option value="">선택</option>
                            {SITES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="w-28 rounded-md border px-2 py-1"
                            placeholder="새 Slot"
                            value={plan.slot ?? ""}
                            onChange={(e) => setPlanSlot(r.machine_id, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <button
              onClick={applyMove}
              className="rounded-xl bg-slate-600 px-6 py-2 text-white hover:bg-slate-700 disabled:opacity-50"
              disabled={rows.filter((r) => checked[r.machine_id]).length === 0}
            >
              장비 이동 적용
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoveEquipmentPage;
