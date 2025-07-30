// ─────────────────────────────────────────────────────────────
// 📁 frontend/src/features/EquipmentMove/hooks/useInsertMoveLogs.ts
//
//  🧩 “장비 이동 로그” 전용 POST 훅 (React Query)
//     • 배열(이동 LOG DTO[])을 받아 /api/equipment_move_log/bulk 로 전송
//     • 성공 시 원하는 캐시 키 무효화
// ─────────────────────────────────────────────────────────────

import { useMutation, useQueryClient } from '@tanstack/react-query';

/* -----------------------------------------------------------
   ① 이동 로그 DTO (frontend → FastAPI)
      - SQL 테이블 컬럼과 1:1 대응
----------------------------------------------------------- */
export interface MoveLogDTO {
  machine_id: string;
  manager: string;
  from_site: string;
  from_slot: string;
  to_site: string;
  to_slot: string;
}

/* -----------------------------------------------------------
   ② 훅 본체
----------------------------------------------------------- */
export function useInsertMoveLogs() {
  const qc = useQueryClient();

  return useMutation<void, Error, MoveLogDTO[]>({
    // ▶ 실제 POST 요청
    mutationFn: async (payload) => {
      const res = await fetch('/api/equipment_move_log/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`Failed (${res.status}) ${msg}`);
      }
    },

    // ▶ 성공 시 캐시 무효화 (필요한 키만!)
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['machines'] });   // 예시: 장비 목록 다시 불러오기
      qc.invalidateQueries({ queryKey: ['moveLogs'] });   // 예시: 이동 로그 리스트
    },
  });
}
