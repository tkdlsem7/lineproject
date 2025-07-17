// 📁 src/hooks/useEquipment.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import {
  fetchEquipment,   // GET  /api/equipment/:machineId
  saveEquipment,    // POST /api/equipment   (UPSERT)
} from '../Equipment/equipment';
import type { EquipmentDTO } from '../Equipment/equipment';

/* ------------------------------------------------------------------ */
/* 🪝 useEquipment                                                     */
/*   ① machineId 가 있으면: GET 요청 → 장비 정보 가져옴                */
/*      ─ 200: data = EquipmentDTO                                    */
/*      ─ 404: data = null   (※ 신규 입력 폼)                           */
/*   ② save() 호출: POST 요청 → INSERT or UPDATE                      */
/*      성공 시 React-Query 캐시를 최신 데이터로 갱신                  */
/* ------------------------------------------------------------------ */
export const useEquipment = (machineId?: string) => {
  const qc = useQueryClient();
  const queryKey = ['equipment', machineId]; // 캐시 키

  /* -------------------------------------------------------------- */
  /* 1) 단건 조회 (GET)                                              */
  /* -------------------------------------------------------------- */
  const query = useQuery<EquipmentDTO | null>({
    queryKey,
    enabled: !!machineId, // machineId 없으면 호출하지 않음 (/new 경로)
    /* ---------------- queryFn ---------------- */
    queryFn: async () => {
      if (!machineId) return null; // 안전장치

      try {
        // 200 OK → EquipmentDTO 리턴
        return await fetchEquipment(machineId);
      } catch (err) {
        /* 404 Not Found → 기존 레코드가 없다는 의미이므로
           오류로 처리하지 않고 null 반환하여 '빈 폼' 으로 전환     */
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        // 그 외(500 등)는 진짜 오류 → 상위 컴포넌트에서 error 처리
        throw err;
      }
    },
  });

  /* -------------------------------------------------------------- */
  /* 2) 저장 (UPSERT)                                                */
  /* -------------------------------------------------------------- */
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
