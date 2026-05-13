import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchUploadHistory,
  uploadScheduleExcel,
  type UploadHistoryItem,
} from "../lib/scheduleHubApi";

const teamOptions = [
  "생산일정",
  "출하일정",
  "개조",
  "인터페이스",
  "MANI",
  "OPUS",
  "칠러",
  "제조일정",
];

const statusClass = (status?: string) => {
  const s = (status || "").toLowerCase();

  if (s.includes("success") || s.includes("done") || s.includes("complete")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (s.includes("fail") || s.includes("error")) {
    return "bg-red-100 text-red-700";
  }
  if (s.includes("pending") || s.includes("uploaded")) {
    return "bg-amber-100 text-amber-700";
  }
  return "bg-slate-100 text-slate-700";
};

const ScheduleExcelUploadPage: React.FC = () => {
  const navigate = useNavigate();

  const [teamName, setTeamName] = useState(teamOptions[0]);
  const [file, setFile] = useState<File | null>(null);
  const [uploadedBy, setUploadedBy] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<UploadHistoryItem[]>([]);
  const [error, setError] = useState("");

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      setError("");
      const res = await fetchUploadHistory();
      setHistory(res);
    } catch (e: any) {
      setError(e?.message ?? "업로드 이력 조회 중 오류가 발생했습니다.");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleUpload = async () => {
    if (!file) {
      alert("업로드할 엑셀 파일을 선택해주세요.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res: any = await uploadScheduleExcel({
        team_name: teamName,
        uploaded_by: uploadedBy,
        file,
      });

      const historyCount = Number(res?.history_count ?? 0);
      const updatedCount = Number(res?.history_updated_count ?? 0);
      const insertedCount = Number(res?.history_inserted_count ?? 0);
      const deletedCount = Number(res?.history_deleted_count ?? 0);

      alert(
        historyCount > 0
          ? `업로드가 완료되었습니다.\n이벤트 ${res?.event_count ?? 0}건 반영\nhistory ${historyCount}건 저장 (신규 ${insertedCount}, 변경 ${updatedCount}, 삭제 ${deletedCount})`
          : `업로드가 완료되었습니다.\n이벤트 ${res?.event_count ?? 0}건 반영\n변경 이력 없음`
      );
      setFile(null);

      const input = document.getElementById("schedule-upload-input") as HTMLInputElement | null;
      if (input) input.value = "";

      await loadHistory();
    } catch (e: any) {
      alert(e?.message ?? "업로드 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-slate-50 to-sky-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="h-1.5 rounded-t-3xl bg-gradient-to-r from-sky-300 via-cyan-300 to-indigo-300" />

          <div className="border-b border-slate-200 px-8 py-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">일정 엑셀 업로드</h1>
                <p className="mt-2 text-sm text-slate-500">
                  팀별 일정 엑셀 파일을 업로드하고 이력을 확인합니다.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => navigate("/main")}
                  className="rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  🏠 메인으로
                </button>

                <button
                  onClick={() => navigate("/equipment-schedule")}
                  className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-600"
                >
                  일정 확인 페이지로
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-8 md:grid-cols-2">
            <div className="space-y-4 rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">팀 선택</label>
                <select
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                >
                  {teamOptions.map((team) => (
                    <option key={team} value={team}>
                      {team}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">업로드 사용자</label>
                <input
                  value={uploadedBy}
                  onChange={(e) => setUploadedBy(e.target.value)}
                  placeholder="예: 조성국"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">엑셀 파일</label>
                <input
                  id="schedule-upload-input"
                  type="file"
                  accept=".xlsx,.xlsm"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                />
                {file && (
                  <div className="mt-2 text-sm text-slate-500">
                    선택 파일: <span className="font-semibold">{file.name}</span>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  onClick={handleUpload}
                  disabled={loading}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold text-white ${
                    loading ? "bg-slate-400" : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {loading ? "업로드 중..." : "엑셀 업로드"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl bg-slate-50 p-6 ring-1 ring-slate-200">
              <h2 className="text-lg font-bold text-slate-900">안내</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                <li>• 현재 업로드 허용 확장자는 xlsx, xlsm 입니다.</li>
                <li>• 팀별 엑셀 구조가 달라도 업로드 후 파싱 단계에서 처리합니다.</li>
                <li>• 업로드 원본은 별도로 보관하고, 최신 일정은 schedule_events에 유지합니다.</li>
                <li>• 기존 최신 일정과 비교해서 변경된 건만 schedule_event_history에 자동 저장합니다.</li>
                <li>• 제조일정 파일은 모델 + 차분 + 발주수량을 기준으로 자동으로 호기를 생성합니다.</li>
                <li>• 같은 모델/차분이 여러 행으로 나뉘면 앞 행부터 순서대로 호기 번호를 이어서 배정합니다.</li>
                <li>• 파일명과 업로드 일시는 이력에서 바로 확인할 수 있습니다.</li>
                <li>• 업로드 후 우측 상단의 일정 확인 페이지로 버튼으로 이동할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-200 px-8 py-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">업로드 이력</h2>
              <button
                onClick={loadHistory}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                새로고침
              </button>
            </div>
          </div>

          <div className="p-8">
            {historyLoading ? (
              <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                이력 불러오는 중...
              </div>
            ) : error ? (
              <div className="rounded-2xl bg-red-50 px-6 py-10 text-center text-red-600">
                {error}
              </div>
            ) : history.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-6 py-10 text-center text-slate-500">
                업로드 이력이 없습니다.
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="px-4 py-4 text-left font-semibold">팀</th>
                        <th className="px-4 py-4 text-left font-semibold">파일명</th>
                        <th className="px-4 py-4 text-left font-semibold">업로드자</th>
                        <th className="px-4 py-4 text-left font-semibold">상태</th>
                        <th className="px-4 py-4 text-left font-semibold">메시지</th>
                        <th className="px-4 py-4 text-left font-semibold">업로드 시각</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {history.map((row) => (
                        <tr key={row.id} className="hover:bg-sky-50/60">
                          <td className="px-4 py-4 text-slate-700">{row.team_name}</td>
                          <td className="px-4 py-4 font-medium text-slate-900">{row.file_name}</td>
                          <td className="px-4 py-4 text-slate-700">{row.uploaded_by || "-"}</td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass(
                                row.upload_status
                              )}`}
                            >
                              {row.upload_status}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-slate-600">{row.message || "-"}</td>
                          <td className="px-4 py-4 text-slate-500">
                            {row.created_at?.slice(0, 19).replace("T", " ") || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ScheduleExcelUploadPage;