// 📁 src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import {
  fetchEquipment,   // GET  /api/equipment/:machineId
  saveEquipment,    // POST /api/equipment   (UPSERT)
} from '../Equipment/equipment';
import type { EquipmentDTO } from '../Equipment/equipment';

export const useEquipment = (machineId?: string) => {
  const qc = useQueryClient();
  const queryKey = ['equipment', machineId]; // 캐시 키

  const query = useQuery<EquipmentDTO | null>({
    queryKey,
    enabled: !!machineId, // machineId 없으면 호출하지 않음 (/new 경로)
    queryFn: async () => {
      if (!machineId) return null; // 안전장치

      try {
        // 200 OK → EquipmentDTO 리턴
        return await fetchEquipment(machineId);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });

  const mutation = useMutation({
    /* saveEquipment(payload) 는 POST /api/equipment
       → 백엔드에서 존재하면 UPDATE, 없으면 INSERT                  */
    mutationFn: (payload: EquipmentDTO) => saveEquipment(payload),

    /* 저장 성공 시: 서버가 돌려준 최신 데이터를 캐시에 즉시 반영
       → 화면이 자동으로 갱신되고, 뒤로가기로 돌아가도 방금 수정
         내용이 그대로 보이는 UX 보장                               */
    onSuccess: (saved: EquipmentDTO) => {
      qc.setQueryData(queryKey, saved);
    },

    /* 필요하다면 onError(재시도)·onSettled 등도 추가 가능            */
  });

  /* -------------------------------------------------------------- */
  /* 3) 훅이 반환하는 값들                                            */
  /* -------------------------------------------------------------- */
  return {
    /* ─ GET 상태 ─ */
    data:        query.data,          // EquipmentDTO | null
    isPending:   query.isLoading,     // 로딩 플래그 (이전 명칭 유지)
    error:       query.error,         // 404 는 걸리지 않음

    /* ─ POST 상태 ─ */
    save:   mutation.mutateAsync,     // async (payload) => void
    saving: mutation.isPending,       // POST in-flight 여부
  };
};
