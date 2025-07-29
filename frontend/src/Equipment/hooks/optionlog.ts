import { useMutation, useQueryClient } from "@tanstack/react-query";

export interface OptionLogDTO {
  machine_no: string;
  manager: string;
}

interface Variables {
  machine_no: string;
  manager?: string;
}

export function useOptionLogInput() {
  const qc = useQueryClient();

  return useMutation<OptionLogDTO, Error, Variables>({
    /* 1) 실제 POST 요청 */
    mutationFn: async ({ machine_no, manager }) => {
      const res = await fetch("/api/optionlog/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machine_no, manager }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(`Failed (${res.status}) ${msg}`);
      }
      return res.json() as Promise<OptionLogDTO>;
    },

    /* 2) 성공 시 캐시 처리 */
    onSuccess: (data) => {
      // 장비별 캐시 키 무효화
      qc.invalidateQueries({ queryKey: ["optionlog", data.machine_no] });
      // 혹은 최신 데이터 바로 세팅
      // qc.setQueryData(["optionlog", data.machine_no], data);
    },
  });
}
