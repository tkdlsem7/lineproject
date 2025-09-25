// src/Board/Boardpage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// CRA/Vite 공용: 환경변수 → 없으면 '/api'
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

type BoardPost = {
  no: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string; // ISO
  category: string;
};

const Boardpage: React.FC = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 목록 불러오기 (타임아웃/에러표시 보강)
  useEffect(() => {
    let alive = true;                      // ← 언마운트 후 setState 방지용
    const controller = new AbortController();

    async function fetchList() {
      try {
        if (!alive) return;
        setLoading(true);
        setErr(null);

        const res = await axios.get<BoardPost[]>(
          `${API_BASE}/board`,
          { signal: controller.signal, timeout: 8000, headers: { Accept: 'application/json' } }
        );

        if (!alive) return;
        setPosts(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        // ✅ Abort(취소)면 무시
        const isCanceled =
          e?.code === 'ERR_CANCELED' ||
          e?.name === 'CanceledError' ||
          e?.message === 'canceled' ||
          (axios.isCancel ? axios.isCancel(e) : false);

        if (!isCanceled) {
          console.error('GET /board failed:', e?.message || e);
          if (alive) {
            setErr('목록을 불러오지 못했습니다.');
          }
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchList();
    return () => {
      alive = false;
      controller.abort();                  // 첫 번째 요청을 정리 → canceled 발생(위에서 무시)
    };
  }, []);

  // 검색
  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(k) ||
        p.content.toLowerCase().includes(k) ||
        p.author_name.toLowerCase().includes(k) ||
        (p.category || '').toLowerCase().includes(k)
    );
  }, [q, posts]);

  // 최신순 정렬
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => b.no - a.no);
    return arr;
  }, [filtered]);

  // 표시용 No (테이블 첫 컬럼)
  const rows = useMemo(() => {
    let no = sorted.length;
    return sorted.map((p) => ({
      ...p,
      displayNo: String(no--),
    }));
  }, [sorted]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단바: 검색 + 새 글쓰기 */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="제목/내용/작성자/분류 검색..."
            className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
          />
          <button
            onClick={() => navigate('/board/new')}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            새 글쓰기
          </button>
        </div>
      </div>

      {/* 본문: 중앙 테이블 */}
      <div className="mx-auto max-w-6xl px-6 py-6">
        {err && (
          <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>
        )}

        <div className="mb-2 text-sm text-gray-500">
          {loading ? '불러오는 중…' : `총 ${rows.length}건`}
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full table-fixed">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="w-20 px-4 py-3">No</th>
                <th className="w-32 px-4 py-3">분류</th>
                <th className="px-4 py-3">제목</th>
                <th className="w-40 px-4 py-3">글쓴이</th>
                <th className="w-40 px-4 py-3">작성시간</th>
                <th className="w-36 px-4 py-3">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr
                  key={p.no}
                  onClick={() => navigate(`/board/${p.no}`)} // 상세 페이지가 준비되면 사용
                  className="cursor-pointer border-t hover:bg-gray-50"
                >
                  <td className="px-4 py-3 text-sm text-gray-700">{p.displayNo}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{p.category || '일반'}</td>
                  <td className="px-4 py-3">
                    <div className="truncate font-medium text-gray-900">{p.title}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{p.author_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{fmtDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/board/${p.no}/edit`);
                        }}
                        className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        수정
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          const ok = window.confirm('삭제하시겠습니까?'); // ← 여기만 변경
                          if (!ok) return;

                          try {
                            await axios.delete(`${API_BASE}/board/${p.no}`);
                            setPosts((prev) => prev.filter((x) => x.no !== p.no));
                          } catch (err) {
                            console.error(err);
                            alert('삭제에 실패했습니다.');
                          }
                        }}
                        className="rounded-md bg-red-50 px-3 py-1 text-sm text-red-700 hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                    검색 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Boardpage;
