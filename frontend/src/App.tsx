import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import LoginForm from "./Login/Login_function";
import MainPage from "./Main/MainPage";
import OptionConfigPage from "./Option/OptionConfigPage";
import ModifyOptionsPage from "./Option/ModifyOptionsPage";
import DashboardMain from "./Dashboard/DashboardMain";
import EquipmentInfoPage from "./Equipment Information/EquipmentInfoPage";
import EquipmentRemodelPage from "./Equipment Information/EquipmentRemodelPage";
import ProgressChecklistPage from "./Progress Checklist/ProgressChecklistPage";
import MoveEquipmentPage from "./MachineMoving/MoveEquipmentPage";
import TroubleShootPage from "./Troubleshoot/TroubleShootPage";
import SetupDefectEntryPages from "./SetupDefectEntryPage/SetupDefectEntryPage";
import AttendanceHistoryPage from "./Attendance/AttendanceHistoryPage";
import LineAccessCurrentPage from "./LineAccess/LineAccessCurrentPage";
import LineAccessLogsPage from "./LineAccess/LineAccessLogsPage";
import DefectCatalogPage from "./DefectCatalog/DefectCatalogPage";

import BoardPage from "./Board/Boardpage";
import BoardNewPage from "./Board/BoardNewPage";
import BoardEditPage from "./Board/BoardEditPage";
import BoardDetailPage from "./Board/BoardDetailPage";

import LogTableBrowser from "./logtable/LogTableBrowser";
import LogChartPage from "./LogChart/LogChartPage";
import EquipmentRemodelLogPage from "./LogChart/EquipmentRemodelLogPage";
import EquipmentRemodelManagePage from "./LogChart/EquipmentRemodelManagePage";

import EquipmentScheduleDetailPage from "./Calender/EquipmentScheduleDetailPage";
import EquipmentSchedulePage from "./Calender/EquipmentSchedulePage";
import CalendarExcelUploadPage from "./Calender/ScheduleExcelUploadPage";
import ScheduleBatchHistoryPage from "./Calender/ScheduleBatchHistoryPage";

import UserEditPage from "./Login/UserEditPage";

const RequireAuth: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const token =
    localStorage.getItem("access_token") || sessionStorage.getItem("access_token");
  const location = useLocation();

  if (!token) {
    if (location.pathname === "/account/edit") {
      return <Navigate to="/" replace />;
    }

    return (
      <Navigate
        to={`/?redirect=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
};

const getUserName = () => {
  const n =
    localStorage.getItem("user_name") || sessionStorage.getItem("user_name");
  return n && n.trim() ? n : "조성국";
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />

      <Route
        path="/main"
        element={
          <RequireAuth>
            <MainPage userName={getUserName()} />
          </RequireAuth>
        }
      />

      <Route
        path="/account/edit"
        element={
          <RequireAuth>
            <UserEditPage />
          </RequireAuth>
        }
      />

      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardMain />
          </RequireAuth>
        }
      />

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

      <Route
        path="/equipment"
        element={
          <RequireAuth>
            <EquipmentInfoPage />
          </RequireAuth>
        }
      />

      <Route
        path="/equipment-remodel"
        element={
          <RequireAuth>
            <EquipmentRemodelPage />
          </RequireAuth>
        }
      />

      <Route
        path="/progress-checklist"
        element={
          <RequireAuth>
            <ProgressChecklistPage />
          </RequireAuth>
        }
      />

      <Route
        path="/machine-move"
        element={
          <RequireAuth>
            <MoveEquipmentPage />
          </RequireAuth>
        }
      />

      <Route
        path="/troubleshoot"
        element={
          <RequireAuth>
            <TroubleShootPage />
          </RequireAuth>
        }
      />

      <Route
        path="/SetupDefectEntryPage"
        element={
          <RequireAuth>
            <SetupDefectEntryPages />
          </RequireAuth>
        }
      />


      <Route
        path="/board"
        element={
          <RequireAuth>
            <BoardPage />
          </RequireAuth>
        }
      />

      <Route
        path="/board/:no"
        element={
          <RequireAuth>
            <BoardDetailPage />
          </RequireAuth>
        }
      />

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

      <Route
        path="/logs/table"
        element={
          <RequireAuth>
            <LogTableBrowser />
          </RequireAuth>
        }
      />

      <Route
        path="/log/charts"
        element={
          <RequireAuth>
            <LogChartPage />
          </RequireAuth>
        }
      />

      <Route
        path="/log/remodel"
        element={
          <RequireAuth>
            <EquipmentRemodelLogPage />
          </RequireAuth>
        }
      />

      <Route
        path="/log/remodel/manage"
        element={
          <RequireAuth>
            <EquipmentRemodelManagePage />
          </RequireAuth>
        }
      />

      <Route
        path="/line-access/logs"
        element={
          <RequireAuth>
            <LineAccessLogsPage />
          </RequireAuth>
        }
      />

      <Route
        path="/defect-catalog"
        element={
          <RequireAuth>
            <DefectCatalogPage />
          </RequireAuth>
        }
      />

      <Route
        path="/attendance"
        element={
          <RequireAuth>
            <AttendanceHistoryPage />
          </RequireAuth>
        }
      />

      <Route
        path="/line-access"
        element={
          <RequireAuth>
            <LineAccessCurrentPage />
          </RequireAuth>
        }
      />

      {/* 일정 관련 */}
      <Route
        path="/calendar"
        element={<Navigate to="/equipment-schedule" replace />}
      />

      <Route
        path="/calendar/upload"
        element={
          <RequireAuth>
            <CalendarExcelUploadPage />
          </RequireAuth>
        }
      />

      <Route
        path="/equipment-schedule"
        element={
          <RequireAuth>
            <EquipmentSchedulePage />
          </RequireAuth>
        }
      />

      <Route
        path="/equipment-schedule/:equipmentId"
        element={<EquipmentScheduleDetailPage />}
      />

      <Route
        path="/schedule-batch-history"
        element={
          <RequireAuth>
            <ScheduleBatchHistoryPage />
          </RequireAuth>
        }
      />

      <Route
        path="/calendar/batch-history"
        element={<Navigate to="/schedule-batch-history" replace />}
      />

      <Route
        path="/gantt"
        element={<Navigate to="/equipment-schedule" replace />}
      />

      <Route path="/BoardPage" element={<Navigate to="/board" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
