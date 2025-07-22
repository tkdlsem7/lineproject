import { http } from '../lib/http';



export interface checklistDTO{
    name : string

}

export const fetchchecklist = (TaskOption : string)=>
    http.get<checklistDTO> ('/api/task-options').then(r=> r.data);

export const fetchChecklistByName = (optionName: string) =>
  http.get<checklistDTO>(`/api/task-options/${optionName}`).then(r => r.data);