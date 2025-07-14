// 📁 src/index.tsx
import './index.css';                   // ✅ 항상 최상단

import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import { AuthProvider } from './context/AuthContext';

/* ─── React Query ─── */
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './queryClient';      // 앞서 만든 singleton

/* (선택) 라우터를 index에서 감싸고 싶다면 추가 */
import { BrowserRouter } from 'react-router-dom';
/* (선택) devtools가 필요하면
   import { ReactQueryDevtools } from '@tanstack/react-query-devtools'; */

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* ① 전역 Query Provider */}
    <QueryClientProvider client={queryClient}>
      {/* <ReactQueryDevtools initialIsOpen={false} /> */}

      {/* ② 인증 컨텍스트 (이 안에서도 useQuery 사용 가능) */}
      <AuthProvider>
        {/* ③ 라우터: App 내부에 이미 BrowserRouter가 있다면 이 줄은 삭제 */}
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
