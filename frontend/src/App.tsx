// App.tsx (수정)
import React from 'react';
import { Routes, Route } from 'react-router-dom';  // BrowserRouter 삭제
import './App.css';

import LoginForm     from './features/Auth/LoginForm';
import Dashboard     from './Dashboard/Dashboard';
import ChecklistPage from './Equipment/ChecklistPage';
import InfoPage      from './Equipment/FormFields';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/equipment/:id/checklist" element={<ChecklistPage />} />
      <Route path="/equipment/:id/edit"      element={<InfoPage />} />
    </Routes>
  );
}

export default App;
