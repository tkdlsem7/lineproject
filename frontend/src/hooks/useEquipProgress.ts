// 📁 src/features/hooks/useEquipProgress.ts
import { useQuery } from "@tanstack/react-query";


export interface EquipProgress {
  slot_code: string;
  machine_id: string;
  manager : string,
  progress: number;
  shipping_date: string;
  site: string;
}


export function useEquipProgress(site: string) {
  return useQuery<EquipProgress[]>({
    /* site를 queryKey에 포함시켜야  섹션이 바뀔 때 자동으로 새 요청 발생 */
    queryKey: ["equipProgress", site],

    /* ----------------------------------------------------------------------------
     * @return EquipProgressDTO[]
     *    GET /equip-progress/?site=본사
     *    ※ 백엔드에서 ?site= 파라미터를 받아 필터링하도록 구현되어 있어야 함
     * --------------------------------------------------------------------------- */
    queryFn: async () => {
      const params = new URLSearchParams({ site });
      const res = await fetch(`/equip-progress/?${params.toString()}`, {
        cache: "no-store",          // 캐싱 무효화(항상 최신)
      });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },

    /* 5분 동안은 동일 key 재조회 시 캐시 사용(우리 코드에선 5분 주기로 refetch) */
    staleTime: 5 * 60 * 1000,
  });
}

