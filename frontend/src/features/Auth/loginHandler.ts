// 📁 frontend/src/features/Auth/loginHandler.ts

import axios from 'axios';

// ✅ setUserNo까지 인자로 받도록 정의
export const handleLoginSubmit = async (
  username: string,
  password: string,
  setmanager : (name : string) => void,
  setUserNo: (no: number) => void
  // 사용자 번호를 전역 상태로 저장하기 위한 setter 함수 (context api 기반)
) => {
  try {
    const response = await axios.post("http://localhost:8000/login", { //fastapi 서버의 로그인 엔드 포인트로 post 요청
      id: username,
      pw: password,
    });

    const { token, user_no,manager } = response.data;

    //성공적으로 로그인하면 token user_no 반환 값

    localStorage.setItem('token', token);
    // 브라우저에 jwt 토근을 저장 -> 이후 요청 시 인증 헤더에 사용 됨
    setUserNo(user_no);
    setmanager(manager)
    
    // 로그인 상태를 context에 반영해서 다른 컴포넌트에서도 사용 가능
    alert(`로그인에 성공했습니다!\n사용자 번호: ${manager}`);
    return true;
  } catch (error) {
    console.error('로그인 실패:', error);
    alert('로그인에 실패했습니다.');
    return false;
  }
};

