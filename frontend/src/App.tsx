// App.tsx
// - 로그인(/) / 메인(/main) / 대시보드(/dashboard) / 옵션(/options, /options/modify/:id)
// - "토큰 기반" 가드(RequireAuth)만 사용 → 토큰 있으면 절대 로그인으로 튕기지 않음
// - 와일드카드는 마지막에만 배치

import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginForm from "./Login/Login_function";
import MainPage from "./Main/MainPage";
import OptionConfigPage from "./Option/OptionConfigPage";
import ModifyOptionsPage from "./Option/ModifyOptionsPage";
import DashboardMain from "./Dashboard/DashboardMain";
import EquipmentInfoPage from "./Equipment Information/EquipmentInfoPage";
import ProgressChecklistPage from "./Progress Checklist/ProgressChecklistPage";
import MoveEquipmentPage from "./MachineMoving/MoveEquipmentPage";
import TroubleShootPage from "./Troubleshoot/TroubleShootPage";
import SetupDefectEntryPages from "./SetupDefectEntryPage/SetupDefectEntryPage";

import BoardPage from "./Board/Boardpage";
import BoardNewPage from "./Board/BoardNewPage";
import BoardEditPage from "./Board/BoardEditPage";
import BoardDetailPage from "./Board/BoardDetailPage";

import LogTableBrowser from "./logtable/LogTableBrowser";
import LogChartPage from  "./LogChart/LogChartPage"


// ✅ 토큰만 확인하는 최소 가드
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = localStorage.getItem("access_token");
  const location = useLocation();
  if (!token) {
    return <Navigate to={`/?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
};

// 메인에 표시할 이름 헬퍼
const getUserName = () => {
  const n = localStorage.getItem("user_name");
  return n && n.trim() ? n : "조성국";
};

export default function App() {
  return (
    <Routes>
      {/* ① 로그인 (공개) */}
      <Route path="/" element={<LoginForm />} />

      {/* ② 메인 (공개) */}
      <Route path="/main" element={<MainPage userName={getUserName()} />} />

      {/* ③ 대시보드 — 토큰 필요 */}
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardMain />
          </RequireAuth>
        }
      />

      {/* ④ 옵션 — 토큰 필요 */}
      <Route
        path="/options"
        element={
          <RequireAuth>
            <OptionConfigPage />
          </RequireAuth>
        }
      />
      <Route
        path="/options/modify/:id"
        element={
          <RequireAuth>
            <ModifyOptionsPage />
          </RequireAuth>
        }
      />

      {/* 기타 페이지(필요시 공개 유지) */}
      <Route path="/equipment" element={<EquipmentInfoPage />} />
      <Route path="/progress-checklist" element={<ProgressChecklistPage />} />
      <Route path="/machine-move" element={<MoveEquipmentPage />} />
      <Route path="/troubleshoot" element={<TroubleShootPage />} />
      <Route path="/SetupDefectEntryPage" element={<SetupDefectEntryPages />} />

      {/* ✅ 게시판 라우트 정리 */}
      {/* 목록/상세: 공개 (읽기 전용) */}
      <Route path="/board" element={<BoardPage />} />
      <Route path="/board/:no" element={<BoardDetailPage />} />
      <Route path="/logs/table" element={<LogTableBrowser />} />
      <Route path="/log/charts" element={<LogChartPage />} />

      {/* 글쓰기/수정: 토큰 필요 */}
      <Route
        path="/board/new"
        element={
          <RequireAuth>
            <BoardNewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/board/:no/edit"
        element={
          <RequireAuth>
            <BoardEditPage />
          </RequireAuth>
        }
      />

      {/* 과거 경로 호환: /BoardPage → /board */}
      <Route path="/BoardPage" element={<Navigate to="/board" replace />} />

      {/* ⑥ 나머지 경로는 로그인으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
