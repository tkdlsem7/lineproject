// 📁 frontend/src/features/Auth/LoginForm.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { handleLoginSubmit } from './loginHandler';
import { useAuth } from '../../context/AuthContext';

function LoginForm() {
  /** ----------------------------- state ----------------------------- */
  const [id, setId] = useState<string>('');           // ← id(=username)
  const [pw, setPw] = useState<string>('');           // ← pw(=password)

  /** ----------------------------- hooks ----------------------------- */
  const { setUserNo, setManager  } = useAuth();      
  // context에서 제공하는 사용자 상태 hook
  // setUserNo = 로그인 성공 시 사용자 식별번호를 저장
  const navigate = useNavigate();
  // 페이지 이동 React Router 기능

  /** --------------------------- handlers ---------------------------- */
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); // 폼의 기본 submit 동작 막기

    const ok = await handleLoginSubmit(id, pw,setManager,setUserNo); // 로그인 요청
    if (ok) navigate('/dashboard'); // 성공 -> dashboard로 이동
    else     alert('아이디 또는 비밀번호가 올바르지 않습니다.'); // 실패
  };

  /** --------------------------- render ------------------------------ */
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={onSubmit} className="bg-white p-8 rounded shadow-md w-80">
        <h2 className="text-2xl font-bold mb-6 text-center">로그인</h2>

        <input
          type="text"
          placeholder="아이디"
          className="w-full mb-4 px-4 py-2 border border-gray-300 rounded"
          value={id}
          onChange={(e) => setId(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="비밀번호"
          className="w-full mb-6 px-4 py-2 border border-gray-300 rounded"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
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
