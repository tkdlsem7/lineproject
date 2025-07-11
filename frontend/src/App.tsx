// 📁 App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import LoginForm from './features/Auth/LoginForm';
import Dashboard from './Dashboard/Dashboard';   // 폴더에 맞춰 경로 수정
import ChecklistPage from './Equipment/ChecklistPage';
import InfoPage from './Equipment/FormFields';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/equipment/:id/checklist" element={<ChecklistPage />} />
        <Route path="/equipment/:id/edit"      element={<InfoPage />} />
      </Routes>
    </Router>
  );
}

export default App;
