// 📁 src/features/equipmentLog/useEquipmentLog.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';

/** 장비 로그 삭제(단일) */
export function useDeleteEquipmentLog() {
  const qc = useQueryClient();

  /*               ↓↓↓ 제네릭 4가지 (TData, TError, TVariables, TContext) */
  return useMutation<void, Error, { machineNo: string }>({
    /* ─────────────────────────── mutationFn ─────────────────────────── */
    mutationFn: async ({ machineNo }: { machineNo: string }) => {
      /* ① 템플릿 문자열 사용! (` `) */
      const res = await fetch(`/api/equipment_log/${machineNo}/delete`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error(`Failed to delete (status ${res.status})`);
      }
      /* ② 204 No Content 예상 → 본문 없음 */
      return;
    },

    /* ─────────────────────────── onSuccess ──────────────────────────── */
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipmentLogs'] });
    },
  });
}
