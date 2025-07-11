import { useNavigate, useParams } from 'react-router-dom';

/**
 * ✔️ 장비 체크리스트 페이지 (뒤로가기만)
 */
export default function ChecklistPage() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();

  return (
    <section className="h-screen flex flex-col justify-center items-center gap-8">
      {/* 간단한 제목 */}
      <h1 className="text-3xl font-bold">✔️ {id} 체크리스트</h1>

      {/* 뒤로가기 버튼 */}
      <button
        onClick={() => nav(-1)}
        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700
                   text-white rounded-md font-semibold"
      >
        ← 뒤로가기
      </button>
    </section>
  );
}
