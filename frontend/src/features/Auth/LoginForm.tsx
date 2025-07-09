// 📁 frontend/src/features/Auth/LoginForm.tsx
import React, { useState } from 'react';
import { handleLoginSubmit } from './loginHandler'; // 같은 폴더니까 ./ 경로
import { useAuth } from '../../context/AuthContext'; // 🔁 context에서 가져오기

function LoginForm() {
  // 사용자 입력 상태
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // 전역 상태 관리 훅 (userNo 저장용)
  const { setUserNo } = useAuth();

  // 로그인 폼 제출 핸들러
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await handleLoginSubmit(username, password, setUserNo); // 서버 요청 및 전역 저장
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="bg-white p-8 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>

        <input
          type="text"
          placeholder="아이디"
          className="w-full mb-4 px-4 py-2 border border-gray-300 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="비밀번호"
          className="w-full mb-6 px-4 py-2 border border-gray-300 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 rounded"
        >
          로그인
        </button>
      </form>
    </div>
  );
}

export default LoginForm;
