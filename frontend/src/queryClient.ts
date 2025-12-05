// 📁 src/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

// 옵션은 필요에 따라 조절
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5분 동안 캐시, 포커스 전환 시 refetch 방지 등
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});
