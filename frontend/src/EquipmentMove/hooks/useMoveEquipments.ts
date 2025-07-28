// 📁 frontend/src/features/EquipmentMove/hooks/useMoveEquipments.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom'; // ✅ NEW

interface MovePayload {
  machine_id: string;
  site: string;
  slot_code: string;
}

export function useMoveEquipments() {
  const qc = useQueryClient();
   const nav = useNavigate(); // ✅ React Router 내장 훅 (커스텀 훅 안에서 사용 OK)


  
  return useMutation({
    mutationFn: async (body: MovePayload[]) => {
      const res = await fetch('/api/equipment/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        // 백엔드가 충돌(중복) 시 409로 내려줌
        throw new Error(await res.text());
      }
      if (!res.ok) throw new Error('장비 이동 실패');
      return res.json();
    },
    onSuccess: () => {
      // 이동 성공 → 장비 목록 / 진척도 캐시 무효화
      qc.invalidateQueries({ queryKey: ['machineinfor'] });
      alert('이동이 완료되었습니다.');
      nav(-1); // ✅ 이전 페이지로 돌아가기
    },
    onError: err => alert(err instanceof Error ? err.message : '오류 발생'),
  });
}
