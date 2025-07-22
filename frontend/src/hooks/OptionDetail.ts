// src/features/hooks/useOptionChecklist.ts
// --------------------------------------------------
// ✅ 특정 옵션의 체크리스트 조회 훅 (React Query v5)
// --------------------------------------------------

import { useQuery } from '@tanstack/react-query';
import { ChecklistItemDTO } from '../Equipment/OptionDetail';

/**
 * DB 행 구조와 1:1 매핑되는 타입
 * - done 필드는 DB 테이블에 없으므로 제거했습니다.
 */
export interface ChecklistItem {
  no: number;        // 일련번호(PK)
  option: string;    // 옵션 이름
  step: number;      // 공정 단계
  item: string;      // 작업 항목
  hours: number;     // 소요 시간
}

/**
 * 옵션 이름으로 체크리스트 목록 조회
 */
export function useOptionChecklist(optionName: string) {
  return useQuery<ChecklistItem[], Error>({
    queryKey: ['checklist', optionName],
    queryFn: async (): Promise<ChecklistItem[]> => {
      // 옵션 이름이 없으면 빈 배열 반환
      if (!optionName) return [];

      // GET /api/checklist/{optionName}
      const res = await fetch(
        `/api/checklist/${encodeURIComponent(optionName)}`,
        { cache: 'no-store' },
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch checklist for "${optionName}" (status ${res.status})`,
        );
      }

      // API로부터 ChecklistItemDTO[]를 받아오고, done 필드는 무시합니다.
      const data: ChecklistItemDTO[] = await res.json();
      return data.map(({ no, option, step, item, hours }) => ({
        no,
        option,
        step,
        item,
        hours,
      }));
    },
    // 옵션 이름이 세팅된 후에만 실행
    enabled: !!optionName,
    staleTime: 60_000,   // 1분
    retry: 1,
  });
}
