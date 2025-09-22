// 📁 src/index.tsx
// ─────────────────────────────────────────────────────────────
// 앱 엔트리: 전역 스타일 → React Query → 인증 컨텍스트 → 라우터 → App
//  - App 안에서 BrowserRouter를 또 감싸지 않았다면 여기서 감싸는 구조가 일반적
//  - App 내부에도 BrowserRouter가 있다면 <BrowserRouter> 블록을 제거하세요.
// ─────────────────────────────────────────────────────────────

import "./index.css"; // ✅ 전역 스타일은 항상 최상단

import React from "react";
import ReactDOM from "react-dom/client";

// 라우팅
import { BrowserRouter } from "react-router-dom";

// React Query
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient"; // 싱글턴 클라이언트

// 전역 인증 컨텍스트(네가 만든 AuthProvider 사용)
import { AuthProvider } from "./lib/AuthContext"; // ← 경로: src/lib/AuthContext.tsx 기준

// 실제 앱S
import App from "./App";

// (선택) React Query Devtools를 쓰고 싶다면 주석 해제
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* ① 전역 데이터 캐시/동기화 (React Query) */}
    <QueryClientProvider client={queryClient}>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}

      {/* ② 전역 인증 상태 (이 내부 어디서든 useAuth 사용 가능) */}
      <AuthProvider>
        {/* ③ 라우터: App 내부에 BrowserRouter가 이미 있으면 이 블록을 제거하세요 */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
