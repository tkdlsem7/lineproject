/* ------------------------------------------------------------
 * Equipment API (/api/equipment) – FastAPI 백엔드와 통신
 * ---------------------------------------------------------- */
import { http } from '../lib/http';

/* ---------- 공용 DTO 타입 ---------- */
export interface EquipmentDTO {
  machineId:    string;
  progress:     number;
  shippingDate: string;  // YYYY-MM-DD
  customer:     string;
  manager:      string;
  note:         string;
  slotCode:     string;
  site:         string;  // '본사' | '부항리' | '진우리'
}

/* ----------------------------- GET -----------------------------
 * • machineId 로 단일 장비 조회
 * • site 쿼리스트링을 함께 보내 필터링 (예: /equipment/J-01-03?site=본사)
 * -------------------------------------------------------------- */
export const fetchEquipment = (machineId: string, site: string) =>
  http
    .get<EquipmentDTO>(`/equipment/${machineId}`, { params: { site } })
    .then(res => res.data);

/* ---------------------------- POST -----------------------------
 * • UPSERT: 존재하면 UPDATE, 없으면 INSERT
 * • payload 안에 site 필드가 포함돼 있으므로 경로 수정 불필요
 * -------------------------------------------------------------- */
export const saveEquipment = (data: EquipmentDTO) =>
  http.post<EquipmentDTO>('/equipment/', data).then(res => res.data);
