/* ----------------------------------------------------------------
   react-query v5 전용 훅 모음
   1) useCreateEquipmentLog : POST  /equipment_log/
   2) useShipEquipment      : PATCH /equipment_log/{machine_no}/ship
---------------------------------------------------------------- */
import { useMutation, useQueryClient } from '@tanstack/react-query';

/* 공통 DTO 타입 (응답) */
export interface EquipmentLogDTO {
  id:           number;
  machine_no:   string;
  manager:      string | null;
  receive_date: string | null;
  ship_date:    string | null;
}


/* ② 출하 처리 -------------------------------------------------- */
export function useShipEquipment() {
  const qc = useQueryClient();
    
  return useMutation({
    
    // ▶ machineNo 하나만 넘기면 됨
    mutationFn: async (machineNo: string) => {
      const res = await fetch(`/api/equipment_log/${machineNo}/ship`, {
        method: 'post',
      });
      if (!res.ok) throw new Error(`Failed (status ${res.status})`);
      return res.json() as Promise<EquipmentLogDTO>;
    },
    onSuccess: () => {
      // 목록·통계 갱신
      qc.invalidateQueries({ queryKey: ['equipmentLogs'] });
      qc.invalidateQueries({ queryKey: ['equipProgress'] });
    },
  });
}
