import React, { createContext, useContext, useState, ReactNode } from "react";

// 타입 정의
interface AuthContextType {
  userNo: number | null;
  setUserNo: (no: number) => void;
}

// 초기값
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider 컴포넌트
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [userNo, setUserNo] = useState<number | null>(null);

  return (
    <AuthContext.Provider value={{ userNo, setUserNo }}>
      {children}
    </AuthContext.Provider>
  );
};

// 훅으로 사용
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth는 AuthProvider 안에서만 사용해야 합니다.");
  return context;
};
