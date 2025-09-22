// App.tsx
// - 로그인(/) / 메인(/main) / 대시보드(/dashboard) / 옵션(/options, /options/modify/:id)
// - "토큰 기반" 가드(RequireAuth)만 사용 → 토큰 있으면 절대 로그인으로 튕기지 않음
// - 와일드카드는 마지막에만 배치

import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";


// 💡 네가 쓰는 컴포넌트 경로 그대로 맞춰주세요
import LoginForm from "./Login/Login_function";
import MainPage from "./Main/MainPage";
import OptionConfigPage from "./Option/OptionConfigPage";
import ModifyOptionsPage from "./Option/ModifyOptionsPage";
// ✅ 대시보드 페이지 추가
import DashboardMain from "./Dashboard/DashboardMain";
import EquipmentInfoPage from "./Equipment Information/EquipmentInfoPage";
import ProgressChecklistPage from "./Progress Checklist/ProgressChecklistPage";
import MoveEquipmentPage from "./MachineMoving/MoveEquipmentPage";
import TroubleShootPage from "./Troubleshoot/TroubleShootPage";
import SetupDefectEntryPages from "./SetupDefectEntryPage/SetupDefectEntryPage"

// ✅ 토큰만 확인하는 최소 가드 (AuthContext 여부와 무관)
//   - 기존에 다른 가드가 있어도, 이 기준이면 토큰이 있으면 통과
const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token = localStorage.getItem("access_token");
  const location = useLocation();
  if (!token) {
    // 토큰 없으면 로그인으로, 이후 돌아올 수 있게 redirect param 전달
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

      {/* ② 메인 (필요 시 공개 유지) */}
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

      {/* ④ 옵션 목록 — 토큰 필요 */}
      <Route
        path="/options"
        element={
          <RequireAuth>
            <OptionConfigPage />
          </RequireAuth>
        }
      />

      {/* ⑤ 옵션 상세 수정 — 토큰 필요 */}
      <Route
        path="/options/modify/:id"
        element={
          <RequireAuth>
            <ModifyOptionsPage />
          </RequireAuth>
        }
      />

      <Route path="/equipment" element={<EquipmentInfoPage />} />
      <Route path="/progress-checklist" element={<ProgressChecklistPage />} />
      <Route path="/machine-move" element={<MoveEquipmentPage />} />
      <Route path="/troubleshoot" element={<TroubleShootPage />} />
      <Route path="/SetupDefectEntryPage" element={<SetupDefectEntryPages />} />
        

      {/* ⑥ 나머지 경로는 로그인으로 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
