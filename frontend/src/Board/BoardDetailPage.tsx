import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

type Post = {
  no: number;
  title: string;
  content: string;
  author_name: string;
  created_at: string; // ISO
  category: string;
};

const BoardDetailPage: React.FC = () => {
  const { no } = useParams<{ no: string }>();
  const navigate = useNavigate();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        // ✅ 읽기 전용: Authorization 헤더 없이 호출
        const res = await axios.get<Post>(`${API_BASE}/board/${no}`, { timeout: 8000 });
        if (!alive) return;
        setPost(res.data);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setErr('글을 불러오지 못했습니다.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [no]);

  const fmtDate = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 상단바 */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-gray-50/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
            >
              ← 뒤로가기
            </button>
            <h1 className="text-lg font-semibold text-gray-800">게시글</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {loading && <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">불러오는 중…</div>}
        {err && <div className="mb-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

        {post && (
          <article className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{post.category}</span>
                <time className="text-xs text-gray-500">{fmtDate(post.created_at)}</time>
              </div>
              <div className="text-sm text-gray-500">작성자: <span className="font-medium text-gray-700">{post.author_name}</span></div>
            </div>

            <h2 className="text-xl font-semibold text-gray-900">{post.title}</h2>

            {/* 줄바꿈 유지해서 보여주기 */}
            <div className="whitespace-pre-wrap text-sm leading-7 text-gray-800">
              {post.content}
            </div>
          </article>
        )}
      </div>
    </div>
  );
};

export default BoardDetailPage;
