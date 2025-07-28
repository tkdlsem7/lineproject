// 📁 frontend/src/features/EquipmentMove/hooks/useMachineInfo.ts
import { useQuery } from '@tanstack/react-query';

export interface MachineInfo {
  machine_id: string;
  site: string;
  slot_code: string;
}

/**
 * 선택한 site 기준으로 장비 목록 반환
 * @param site  '' | '본사' | '부항리' | '진우리'
 */
export function useMachineInfo(site: string) {
  return useQuery<MachineInfo[], Error>({
    queryKey: ['machineinfor', site],
    enabled: !!site,                 // site가 선택됐을 때만 요청
    staleTime: 5 * 60 * 1000,

    queryFn: async () => {
      const res = await fetch(`api/machineinfor?site=${encodeURIComponent(site)}`, {
        cache: 'no-store',
      });

      if (!res.ok) throw new Error(`Failed to fetch machine info (status ${res.status})`);
      if (res.status === 204) return [];

      return res.json() as Promise<MachineInfo[]>;
    },
    retry: 1,
  });
}
