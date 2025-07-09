// 📁 frontend/src/features/Auth/loginHandler.ts

import axios from 'axios';

// ✅ setUserNo까지 인자로 받도록 정의
export const handleLoginSubmit = async (
  username: string,
  password: string,
  setUserNo: (no: number) => void
) => {
  try {
    const response = await axios.post("http://localhost:8000/login", {
      id: username,
      pw: password,
    });

    const { token, user_no } = response.data;

    localStorage.setItem('token', token);
    setUserNo(user_no);
    alert(`로그인에 성공했습니다!\n사용자 번호: ${user_no}`);
    return true;
  } catch (error) {
    console.error('로그인 실패:', error);
    alert('로그인에 실패했습니다.');
    return false;
  }
};

