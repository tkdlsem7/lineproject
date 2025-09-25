import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

type Category = '공지사항' | '변경점';

type BoardPost = {
  no: number;
  title: string;
  content: string;
  category: string;
};

const BoardEditPage: React.FC = () => {
  const { no } = useParams<{ no: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('공지사항');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // 초기 데이터 로드
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get<BoardPost>(`${API_BASE}/board/${no}`);
        setTitle(res.data.title);
        setContent(res.data.content);
        // 안전하게 매핑
        const cat = (res.data.category as Category);
        setCategory(cat === '변경점' ? '변경점' : '공지사항');
      } catch (e: any) {
        console.error(e);
        setErr('글을 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [no]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!title.trim()) return setErr('제목을 입력해 주세요.');
    if (!content.trim()) return setErr('내용을 입력해 주세요.');

    try {
      const token = localStorage.getItem('access_token');
      await axios.put(
        `${API_BASE}/board/${no}`,
        { title: title.trim(), content: content.trim(), category },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      navigate('/board', { replace: true });
    } catch (e: any) {
      console.error(e);
      setErr('수정에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
            <h1 className="text-lg font-semibold text-gray-800">글 수정</h1>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-6">
        {loading ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">불러오는 중…</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">분류</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-48 rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              >
                <option value="공지사항">공지사항</option>
                <option value="변경점">변경점</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">내용</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="h-64 w-full resize-y rounded-xl border border-gray-300 p-4 text-sm outline-none focus:border-blue-500"
              />
            </div>

            {err && <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{err}</div>}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => navigate('/board')}
                className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
              >
                취소
              </button>
              <button
                type="submit"
                className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
              >
                저장
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default BoardEditPage;
