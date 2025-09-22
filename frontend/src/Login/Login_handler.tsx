// 📁 frontend/src/features/Auth/loginHandler.ts
// ─────────────────────────────────────────────────────────────
// 로그인 API 호출 유틸 (기존 코드 최대한 보존, 주석 보강)
//  - API_BASE: CRA(VITE) 환경변수 또는 기본 '/api'
//  - 성공 시: localStorage에 access_token / user_name 저장
//  - 이 모듈은 "네비게이션"을 하지 않고, 호출자가 navigate 처리(= LoginForm)
// ─────────────────────────────────────────────────────────────

import axios from 'axios';

/**
 * [레거시 참고용] 과거 고정 IP. 사용 금지지만 삭제하지 않음(요구사항).
 */
const API_HOST = 'http://10.10.1.48:8000';

/** CRA(VITE) 모두 대응: 환경변수 → 없으면 '/api' */
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

/** 서버 응답 타입(백엔드 스펙에 맞춤) */
type LoginResponse = {
  access_token: string;     // JWT
  token_type?: string;      // "bearer"
  name: string;             // 사용자 표시명(다른 폼에서 사용)
  user_no?: number;         // (선택) 서버가 주면 사용
};

/**
 * 로그인 제출 핸들러
 * - username/pw: 입력값
 * - setmanager, setUserNo: 컨텍스트 갱신 콜백(네 기존 시그니처 유지)
 * - 반환: 성공 true / 실패 false
 */
export const handleLoginSubmit = async (
  username: string,
  password: string,
  setmanager: (name: string) => void,
  setUserNo: (no: number) => void
) => {
  try {
    // ✅ 절대경로 대신 API_BASE 사용 (/api 프록시 또는 .env 고정 주소)
    const { data } = await axios.post<LoginResponse>(
      `${API_BASE}/auth/login`,
      { id: username, pw: password }, // 서버가 기대하는 필드명
      { timeout: 10000 }              // 네트워크 지연 대비 타임아웃
    );

    // 응답 필드 구조 분해
    const { access_token, name, user_no } = data;

    // ✅ 브라우저 저장: 토큰/이름(다른 폼에서 쓰기 위함)
    localStorage.setItem('access_token', access_token);
    localStorage.setItem('user_name', name);

    // (레거시 호환) 기존 코드가 token 키를 볼 수도 있어 함께 저장
    localStorage.setItem('token', access_token);

    // ✅ 전역 컨텍스트 갱신
    setUserNo(user_no ?? 0);
    setmanager(name);

    // UX: 알림은 네 흐름 유지
    alert(`로그인에 성공했습니다!\n담당자: ${name}\n사용자 번호: ${user_no ?? 0}`);
    return true;
  } catch (error) {
    console.error('로그인 실패:', error);
    alert('로그인에 실패했습니다. 아이디/비밀번호 또는 서버 상태를 확인해주세요.');
    return false;
  }
};
