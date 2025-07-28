// App.tsx (수정)
import React from 'react';
import { Routes, Route } from 'react-router-dom';  // BrowserRouter 삭제
import './App.css';

import LoginForm     from './features/Auth/LoginForm';
import Dashboard     from './Dashboard/Dashboard';
import ChecklistPage from './Equipment/ChecklistPage';
import InfoPage      from './Equipment/FormFields';
import OptionDetailPage from './Equipment/OptionDetailPage'
import MoveLogForm      from './EquipmentMove/MoveLogForm';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/equipment/:id/checklist" element={<ChecklistPage />} />
      <Route path="/equipment/:id/edit"      element={<InfoPage />} />
      <Route path="/move-log"                        element={<MoveLogForm />} />
      <Route path="/equipment/:id/option/:optionName" element={<OptionDetailPage />} />
          </Routes>
        );
}

export default App;
