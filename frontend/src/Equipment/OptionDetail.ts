import { http } from '../lib/http';

/** DTO: 체크리스트 항목 */
export interface ChecklistItemDTO {
  no: number;
  option: string;
  step: number;
  item: string;
  hours: number;
}

/**
 * GET /api/checklist/{optionName}
 */
export function detailoption(
  optionName: string
): Promise<ChecklistItemDTO[]> {
  return http
    .get<ChecklistItemDTO[]>(
      `/api/checklist/${encodeURIComponent(optionName)}`
    )
    .then(r => r.data);
}
