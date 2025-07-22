// ChecklistPage.tsx
// --------------------------------------------------------
// ✅ 장비별 체크리스트 화면
// 요청 사항
//   1) URL 파라미터(id)를 제목으로 표시
//   2) task_option 테이블(API)에서 옵션 데이터를 가져와
//      리스트 형태로 보여주기
//   3) 뒤로가기 버튼 유지
//   4) TailwindCSS 로 심플한 카드 / 버튼 UI 적용
// --------------------------------------------------------

// React router 훅
import { useNavigate, useParams } from 'react-router-dom';
// React core hooks
import { useEffect, useState } from 'react';

// -------------------------------------------------------------------
// 🔖 (1) 테이블 스키마에 맞춘 타입 정의
// -------------------------------------------------------------------
//  - 백엔드(FastAPI)에서 `/api/task-options` 같은 엔드포인트로
//    전달받을 JSON 구조를 추정하여 타입 선언.
//  - 필드가 추가되면 확장하세요.
interface TaskOption {
  name: string;        // 옵션 이름 (PK)
  // description?: string; // 예: 옵션 설명 (선택, 주석 처리)
}

// -------------------------------------------------------------------
// 🔖 (2) 메인 컴포넌트
// -------------------------------------------------------------------
export default function ChecklistPage() {
  /* --------------------------------------------------------------
   *  URL 파라미터 : /equipment/:id/checklist 형태로 가정
   * --------------------------------------------------------------*/
  const { id = '' } = useParams<{ id: string }>();

  /* --------------------------------------------------------------
   *  SPA 내 네비게이션 함수
   * --------------------------------------------------------------*/
  const nav = useNavigate();

  /* --------------------------------------------------------------
   *  상태 정의
   *    - options : API에서 받아올 TaskOption 배열
   *    - loading : 로딩 스피너 표시 여부
   *    - error   : 오류 메시지 저장용
   * --------------------------------------------------------------*/
  const [options, setOptions] = useState<TaskOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /* --------------------------------------------------------------
   *  컴포넌트 마운트 시 1회 데이터 fetch
   * --------------------------------------------------------------*/
  useEffect(() => {
    // 즉시 실행 함수 패턴으로 async/await 사용
    (async () => {
      try {
        // ─────────────────────────────────────────────
        //  엔드포인트 예시: /api/task-options (변경 가능)
        //  반환 예: [{ "name": "hot" }, { "name": "cold" }, ...]
        // ─────────────────────────────────────────────
        const res = await fetch('/api/task-options');

        // 네트워크 OK 여부 검사 (4xx, 5xx 예외 처리)
        if (!res.ok) throw new Error(`(${res.status}) 옵션 데이터를 불러올 수 없습니다.`);

        // JSON 파싱 → 타입 단언
        const data: TaskOption[] = await res.json();

        // 상태 반영
        setOptions(data);
      } catch (err) {
        // 타입 가드로 Error 타입 단언
        const msg = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(msg);
      } finally {
        // 로딩 종료
        setLoading(false);
      }
    })();
  }, []); // 빈 의존성 배열: 최초 1회만 실행

  // -----------------------------------------------------------------
  // 🔖 (3) 렌더링
  // -----------------------------------------------------------------
  return (
    // (3-1) 전체 영역: 세로 정렬 + 패딩 + 연한 회색 배경
    <section className="min-h-screen flex flex-col items-center px-4 py-8 gap-8 bg-gray-50">
      {/* (3-2) 페이지 제목 */}
      <h1 className="text-3xl font-bold">✔️ Option 선택</h1>

      {/* (3-3) 로딩 상태 */}
      {loading && (
        <p className="animate-pulse text-gray-600">데이터 불러오는 중...</p>
      )}

      {/* (3-4) 오류 상태 */}
      {error && (
        <p className="text-red-500 font-semibold">{error}</p>
      )}

      {/* (3-5) 정상 데이터 렌더링 */}
      {!loading && !error && (
        <ul className="w-full max-w-xl space-y-4">
          {options.map((opt) => (
            <li
              key={opt.name}
              className="flex items-center justify-between p-4 bg-white rounded-lg shadow"
            >
              {/* 옵션 이름 */}
              <span className="font-medium text-gray-800">{opt.name}</span>

              {/* 예시 버튼(추후 상세 페이지로 이동 or 체크박스 등) */}
              <button
                type="button"
                className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700"
                onClick={() => {
                  /* TODO: 필요한 로직으로 대체 (예: 상세 화면 이동) */
                  nav(`/equipment/${id}/option/${opt.name}`);
                  console.log(`선택된 옵션: ${opt.name}`);
                }}
              >
                선택
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* (3-6) 뒤로가기 버튼 */}
      <button
        onClick={() => nav(-1)}
        className="mt-10 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold"
      >
        ← 뒤로가기
      </button>
    </section>
  );
}
