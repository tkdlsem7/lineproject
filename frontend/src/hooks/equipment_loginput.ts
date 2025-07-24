// 📁 src/features/equipmentLog/useEquipmentLog.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface EquipmentLogDTO {
  id:           number;
  machine_no:   string;
  manager:      string | null;
  receive_date: string | null;
  ship_date:    string | null;
}

/** 입고 처리: machineNo + manager(선택) 전송 */
export function useInputEquipment() {
  const qc = useQueryClient();

  return useMutation({
    // payload 형태 { machineNo, manager? }
    mutationFn: async (payload: { machineNo: string; manager?: string }) => {
      const res = await fetch('/api/equipment_log/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_no: payload.machineNo,
          manager:    payload.manager ?? null,
        }),
      });
      if (!res.ok) throw new Error(`Failed (status ${res.status})`);
      return res.json() as Promise<EquipmentLogDTO>;
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipmentLogs'] });
      qc.invalidateQueries({ queryKey: ['equipProgress'] });
    },
  });
}
