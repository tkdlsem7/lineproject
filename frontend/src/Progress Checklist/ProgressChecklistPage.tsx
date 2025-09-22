// src/Progress Checklist/ProgressChecklistPage.tsx
import React from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

type ChecklistItem = {
  no: number;
  step: number;
  item: string;
  hours: number;
  percent: number;
};
type ChecklistPage = {
  option: string;
  total_hours: number;
  item_count: number;
  items: ChecklistItem[];
  checked_steps?: number[];
};
type ChecklistResponse = {
  machine_id: string;
  options: string[];
  pages: ChecklistPage[];
};

const ProgressChecklistPage: React.FC = () => {
  const navigate = useNavigate();
  const search = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const qpId = search.get("machine_id") ?? "";
  const lsId = typeof window !== "undefined" ? localStorage.getItem("selected_machine_id") ?? "" : "";
  const machineId = qpId || lsId;

  const [data, setData] = React.useState<ChecklistResponse | null>(null);

  // ✅ 옵션별 체크 상태: { hot: { 1:true, 3:true }, "5825": { ... } }
  const [checkedByOption, setCheckedByOption] = React.useState<Record<string, Record<number, boolean>>>({});

    React.useEffect(() => {
    if (!machineId) return;
    (async () => {
        try {
        const res = await axios.get<ChecklistResponse>(
            `/progress/checklist/${encodeURIComponent(machineId)}`
        );
        setData(res.data);

        // ✅ 옵션별 초기 체크 맵 구성
        const init: Record<string, Record<number, boolean>> = {};
        for (const p of res.data.pages) {
            const set = new Set(p.checked_steps ?? []);
            const map: Record<number, boolean> = {};
            for (const it of p.items) {
            if (set.has(it.no)) map[it.no] = true;  // 저장된 항목은 체크
            }
            init[p.option] = map;
        }
        setCheckedByOption(init);
        } catch (e) {
        console.error(e);
        alert("체크리스트를 불러오지 못했습니다.");
        }
    })();
    }, [machineId]);

  // ===== 진척도 계산 (전체) =====
  const grandTotalHours = React.useMemo(() => {
    return (data?.pages ?? []).reduce((sum, p) => sum + (p.total_hours || 0), 0);
  }, [data]);

  const doneHours = React.useMemo(() => {
    if (!data) return 0;
    let acc = 0;
    for (const p of data.pages) {
      const map = checkedByOption[p.option] || {};
      for (const it of p.items) {
        if (map[it.no]) acc += it.hours;
      }
    }
    return acc;
  }, [data, checkedByOption]);

  const percent = grandTotalHours > 0 ? Math.round((doneHours / grandTotalHours) * 100) : 0;

  // ===== 체크 토글 =====
  const toggleOne = (opt: string, no: number) =>
    setCheckedByOption(prev => ({ ...prev, [opt]: { ...prev[opt], [no]: !prev[opt]?.[no] } }));

  const toggleAllInOption = (opt: string, on: boolean, nos: number[]) =>
    setCheckedByOption(prev => ({
      ...prev,
      [opt]: nos.reduce<Record<number, boolean>>((m, n) => ((m[n] = on), m), {}),
    }));

  // ===== 저장 (옵션별 upsert 루프) =====
    const handleSave = async () => {
    if (!data) return;

    // payload 구성: 옵션별 체크된 no만 모으기
    const items = data.pages.map((p) => {
        const validNos = new Set(p.items.map((it) => it.no));
        const checkedNos = Object.entries(checkedByOption[p.option] || {})
        .filter(([, v]) => v)
        .map(([k]) => Number(k))
        .filter((no) => validNos.has(no));   // ✅ 안전 가드

        return { option: p.option, checked_steps: checkedNos };
    });

    try {
        await axios.post(
        "/progress/checklist/result/batch", // /api 안 쓰면 "/progress/checklist/result/batch"
        { machine_id: machineId, items },
        { headers: { "Content-Type": "application/json" } }
        );
        alert("진척도 저장 완료.");
        navigate(-1);
    } catch (e) {
        console.error(e);
        alert("저장 중 오류가 발생했습니다.");
    }
    };

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">진척도 체크리스트</h1>
        <div className="text-sm text-slate-600 mt-1">
          Machine: <span className="font-semibold">{machineId || "미지정"}</span>
        </div>

        {/* ✅ 전체 진척도 바 */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-slate-600">전체 진척도</span>
            <span className="font-semibold">{percent}% ({doneHours.toFixed(1)}h / {grandTotalHours.toFixed(1)}h)</span>
          </div>
          <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-3 bg-indigo-600" style={{ width: `${percent}%` }} />
          </div>
        </div>
      </div>

      {/* ✅ 한 페이지에 옵션별 섹션으로 렌더 */}
      <div className="overflow-x-auto rounded-xl border">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left text-slate-700">
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">Step</th>
              <th className="px-3 py-2">항목</th>
              <th className="px-3 py-2 text-right">표준작업공수시간</th>
              <th className="px-3 py-2 text-right">퍼센트</th>
            </tr>
          </thead>

          {/* 옵션별 그룹 */}
          {(data?.pages ?? []).map((p) => {
            const map = checkedByOption[p.option] || {};
            const nos = p.items.map(it => it.no);
            const allOn = nos.length > 0 && nos.every(n => !!map[n]);

            return (
              <tbody key={p.option} className="divide-y">
                {/* 그룹 헤더: 옵션 라벨 + 그룹 전체선택 */}
                <tr className="bg-white">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={allOn}
                      onChange={(e) => toggleAllInOption(p.option, e.currentTarget.checked, nos)}
                      aria-label={`${p.option}-all`}
                    />
                  </td>
                  <td colSpan={4} className="px-3 py-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-full bg-slate-800 text-white text-xs px-2 py-[2px]">{p.option}</span>
                      <span className="text-slate-500 text-xs">Step ({p.item_count}개)</span>
                      <span className="text-slate-400 text-xs ml-2">
                        합계 {p.total_hours}h
                      </span>
                    </span>
                  </td>
                </tr>

                {/* 항목들 */}
                {p.items.map((it) => (
                  <tr key={it.no} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!map[it.no]}
                        onChange={() => toggleOne(p.option, it.no)}
                        aria-label={`${p.option}-${it.no}`}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">Step {it.step}</td>
                    <td className="px-3 py-2">{it.item}</td>
                    <td className="px-3 py-2 text-right">{it.hours}h</td>
                    <td className="px-3 py-2 text-right">{it.percent}%</td>
                  </tr>
                ))}
              </tbody>
            );
          })}

          {/* 전체 합계 */}
          <tbody>
            <tr className="bg-slate-50 font-semibold">
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2">합계</td>
              <td className="px-3 py-2"></td>
              <td className="px-3 py-2 text-right">{grandTotalHours.toFixed(1)}h</td>
              <td className="px-3 py-2 text-right">100%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 하단 버튼 */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          className="rounded-xl border px-4 py-2 text-slate-700 hover:bg-slate-50"
          onClick={() => navigate(-1)}
        >
          ← 뒤로가기
        </button>
        <button
          className="rounded-xl bg-indigo-600 px-5 py-2 text-white hover:bg-indigo-700"
          onClick={handleSave}
        >
          저장
        </button>
      </div>
    </div>
  );
};

export default ProgressChecklistPage;
