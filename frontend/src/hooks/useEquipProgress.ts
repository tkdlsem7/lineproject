// 📁 src/features/hooks/useEquipProgress.ts
import { useQuery } from "@tanstack/react-query";

export interface EquipProgress {
  slot_code: string;
  machine_id: string;
  progress: number;
  shipping_date: string;
}

export function useEquipProgress() {
  return useQuery<EquipProgress[]>({
    queryKey: ["equipProgress"],
    queryFn: async () => {
      const res = await fetch("/equip-progress/", {
        cache: "no-store",            // ← 캐시 사용 X
      });
      if (!res.ok) throw new Error("Failed to fetch progress");
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5분
  });
}
