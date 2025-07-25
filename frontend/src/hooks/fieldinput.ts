// -----------------------------------------------------------------------------
// 🔧 useEquipment 훅
//   • machineId (장비 ID)    + site (본사/부항리/진우리) 2가지 파라미터를 받습니다.
//   • GET   : /api/equipment/:machineId?site=본사
//   • UPSERT: POST /api/equipment   (payload 내부에 site 포함)
// -----------------------------------------------------------------------------

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import {
  fetchEquipment,   // 반드시 (machineId, site) 시그니처로 수정돼 있어야 함
  saveEquipment,    // payload.site 를 이용해 UPSERT
} from '../Equipment/equipment';
import type { EquipmentDTO } from '../Equipment/equipment';

/**
 * @param machineId  장비 ID (신규 등록 시 undefined)
 * @param site       상위 섹션: '본사' | '부항리' | '진우리'
 *
 *  - machineId 가 없으면 GET 요청은 실행되지 않으므로
 *    `/equipment/new` 같은 신규 등록 화면에서도 재사용할 수 있습니다.
 */
export const useEquipment = (machineId?: string, site: string = '본사') => {
  const qc = useQueryClient();

  /* ──────────────────────────────────────────────────────── */
  /* 1) GET: 장비 정보 조회                                   */
  /* ──────────────────────────────────────────────────────── */
  const query = useQuery<EquipmentDTO | null>({
    /* 사이트별로 캐시 분리 */
    queryKey: ['equipment', machineId ?? 'new', site],

    /* machineId 가 없으면 GET 호출 자체를 건너뜀 */
    enabled: !!machineId,

    /* API 호출 */
    queryFn: async () => {
      if (!machineId) return null;

      try {
        // fetchEquipment 는 (machineId, site) 형태로 구현해 두었다고 가정
        return await fetchEquipment(machineId, site);
      } catch (err) {
        // 404 → null (신규 장비로 간주), 그 외는 에러 throw
        if (axios.isAxiosError(err) && err.response?.status === 404) {
          return null;
        }
        throw err;
      }
    },
    staleTime: 5 * 60 * 1000,       // 5분 캐시
  });

  /* ──────────────────────────────────────────────────────── */
  /* 2) POST/PUT(UPSERT): 저장                                */
  /* ──────────────────────────────────────────────────────── */
  const mutation = useMutation({
    /* 백엔드에서 machineId 존재 → UPDATE, 없으면 INSERT */
    mutationFn: (payload: EquipmentDTO) =>
      // site 필드를 보강해 보내기 (혹은 payload 안에 이미 포함돼 있다면 생략)
      saveEquipment({ ...payload, site }),

    /* 성공 시 캐시 즉시 갱신 → UI 반응성 향상 */
    onSuccess: (saved: EquipmentDTO) => {
      qc.setQueryData(
        ['equipment', saved.machineId, saved.site ?? site],
        saved
      );
    },
  });

  /* ──────────────────────────────────────────────────────── */
  /* 3) 훅이 반환하는 값                                      */
  /* ──────────────────────────────────────────────────────── */
  return {
    /* GET 상태 */
    data:      query.data,        // EquipmentDTO | null
    isPending: query.isLoading,   // 로딩 플래그
    error:     query.error,

    /* POST 상태 */
    save:   mutation.mutateAsync, // async (payload) => void
    saving: mutation.isPending,   // 저장 중 플래그
  };
};
