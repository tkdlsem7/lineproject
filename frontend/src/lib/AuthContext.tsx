import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

/** ─────────────────────────────────────────────────────────────
 *  전역 인증 컨텍스트
 *   - userNo: 백엔드에서 부여되는 유저 번호(있으면 사용)
 *   - manager: 화면에 표시할 이름(= 로그인 응답의 name)
 *   - login(name, userNo?): 로그인 처리(컨텍스트/로컬스토리지 동기화)
 *   - logout(): 로그아웃 처리(컨텍스트/로컬스토리지 초기화)
 *  ※ localStorage 키는 기존 핸들러와 동일: access_token, user_name
 *  ───────────────────────────────────────────────────────────── */

type AuthContextType = {
  userNo: number | null;
  manager: string | null;

  setUserNo: (no: number | null) => void;
  setManager: (name: string | null) => void;

  isAuthed: boolean;
  login: (name: string, userNo?: number | null) => void;
  logout: () => void;
};

// 기본값(undefined로 두고 훅에서 가드)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 로컬스토리지 키 상수(핸들러와 동일해야 함)
const LS_TOKEN = "access_token";
const LS_NAME = "user_name";
const LS_USERNO = "user_no"; // 선택사항: 필요 시 저장

export const AuthProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  // 전역 상태
  const [userNo, setUserNo] = useState<number | null>(null);
  const [manager, setManager] = useState<string | null>(null);

  // 앱 시작 시 localStorage 값을 읽어와 상태 복구
  useEffect(() => {
    try {
      const name = localStorage.getItem(LS_NAME);
      const noStr = localStorage.getItem(LS_USERNO);
      if (name) setManager(name);
      if (noStr) {
        const n = Number(noStr);
        if (!Number.isNaN(n)) setUserNo(n);
      }
    } catch {
      // 스토리지 접근 실패 시 무시
    }
  }, []);

  // 파생 상태: 토큰이 있으면 로그인된 것으로 간주(간단 판정)
  const isAuthed = useMemo(() => {
    try {
      const token = localStorage.getItem(LS_TOKEN);
      return Boolean(token);
    } catch {
      return false;
    }
  }, [manager, userNo]); // 이름/번호가 바뀌면 재계산

  // 로그인 성공 시 호출(예: 로그인 폼에서 API 성공 후)
  const login = (name: string, no: number | null = null) => {
    setManager(name);
    setUserNo(no);

    try {
      localStorage.setItem(LS_NAME, name);
      if (no !== null) localStorage.setItem(LS_USERNO, String(no));
    } catch {
      /* noop */
    }
  };

  // 로그아웃 처리
  const logout = () => {
    setManager(null);
    setUserNo(null);
    try {
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_NAME);
      localStorage.removeItem(LS_USERNO);
    } catch {
      /* noop */
    }
  };

  const value = useMemo<AuthContextType>(
    () => ({ userNo, manager, setUserNo, setManager, isAuthed, login, logout }),
    [userNo, manager, isAuthed]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 훅으로 사용(컨텍스트 누락 방지 가드 포함)
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 <AuthProvider> 내부에서만 사용할 수 있습니다.");
  return ctx;
};
