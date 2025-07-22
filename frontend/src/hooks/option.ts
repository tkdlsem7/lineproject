// 📁 src/features/hooks/useOptions.ts
// --------------------------------------------------
// ✅ 옵션(option) 목록을 가져오는 커스텀 훅
//   - React Query v5 사용
//   - Suspense 미사용 버전
// --------------------------------------------------

import { useQuery } from '@tanstack/react-query';

/** TASK_OPTION 테이블 구조와 매핑되는 타입 */
export interface Option {
  id: number;   // PK
  name: string; // 옵션명
}

/**
 * 옵션 목록 조회
 * @returns React Query 결과 객체 (data, isLoading, error …)
 */
export function useOptions() {
  return useQuery<Option[], Error>({
    // ▶ 캐시 키: “option” 기준으로 통일
    queryKey: ['options'],

    // ▶ API 호출 함수
    queryFn: async (): Promise<Option[]> => {
      // ⭐ 엔드포인트도 '/options' 로 변경
      const res = await fetch('/options', {
        cache: 'no-store',          // 브라우저 캐시 무효화(선택 사항)
      });

      // 1) 네트워크·서버 오류 처리
      if (!res.ok) {
        throw new Error(`Failed to fetch options (status ${res.status})`);
      }

      // 2) 204 No Content → 빈 배열 반환
      if (res.status === 204) return [];

      // 3) 정상 JSON 파싱(타입 단언)
      return res.json() as Promise<Option[]>;
    },

    // ▶ React Query 설정
    staleTime: 5 * 60 * 1000,   // 5 분 동안 fresh
    retry: 1,                   // 실패 시 한 번만 재시도
  });
}
