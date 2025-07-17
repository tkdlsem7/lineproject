// 📁 src/features/hooks/useEquipProgress.ts
import { useQuery } from "@tanstack/react-query";

export interface fieldinput {
  machine_id: string;
  shipping_date: string;
  manager: number;
  note : string;
  progress : number;
  customer: string;
}

export function useEquipProgress() {
  return useQuery<fieldinput[]>({
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
