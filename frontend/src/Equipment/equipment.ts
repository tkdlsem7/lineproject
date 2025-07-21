/* ------------------------------------------------------------
 * Equipment API (FastAPI /api/equipment)
 * ---------------------------------------------------------- */
import { http } from '../lib/http';

/** 👉 ChecklistPage · 폼 컴포넌트에서 재사용할 타입 */
export interface EquipmentDTO {
  machineId: string;
  progress: number;
  shippingDate: string; // YYYY-MM-DD
  customer: string;
  manager: string;
  note: string;
  slotCode: string; 
}

/* ----------------------------- GET ----------------------------- */
export const fetchEquipment = (machineId: string) =>
  http.get<EquipmentDTO>(`/equipment/${machineId}`).then(r => r.data);

/* ---------------------------- POST ----------------------------- */
export const saveEquipment = (data: EquipmentDTO) =>
  http.post<EquipmentDTO>('/equipment/', data).then(r => r.data);
