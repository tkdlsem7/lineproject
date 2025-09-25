// src/Board/BoardNewPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// CRA/Vite 공용: 환경변수 → 없으면 '/api'
const API_BASE: string =
  ((import.meta as any)?.env?.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ||
  (typeof process !== 'undefined' && (process as any)?.env?.REACT_APP_API_BASE?.replace(/\/$/, '')) ||
  '/api';

type Category = '공지사항' | '변경점';

const BoardNewPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<Category>('공지사항');
  const [error, setError] = useState<string | null>(null);
  const authorName = localStorage.getItem('user_name') || '미등록';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) return setError('제목을 입력해 주세요.');
    if (!content.trim()) return setError('내용을 입력해 주세요.');

    try {
      const token = localStorage.getItem('access_token');

      await axios.post(
        `${API_BASE}/board`,
        {
          title: title.trim(),
          content: content.trim(),
          category,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );

      navigate('/board', { replace: true });
    } catch (err: any) {
      console.error(err);
      if (err?.response?.status === 401) {
        setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      } else if (err?.response?.data?.detail) {
        setError(String(err.response.data.detail));
      } else {
        setError('등록 중 오류가 발생했습니다.');
      }
    }
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
              title="뒤로가기"
            >
              ← 뒤로가기
            </button>
            <h1 className="text-lg font-semibold text-gray-800">글 쓰기</h1>
          </div>
          <div className="text-sm text-gray-500">
            작성자: <span className="font-medium text-gray-700">{authorName}</span>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="mx-auto max-w-4xl px-6 py-6">
        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          {/* 카테고리 */}
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

          {/* 제목 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">제목</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-4 py-2 text-sm outline-none focus:border-blue-500"
              placeholder="제목을 입력하세요"
            />
          </div>

          {/* 내용 */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-64 w-full resize-y rounded-xl border border-gray-300 p-4 text-sm outline-none focus:border-blue-500"
              placeholder="내용을 입력하세요"
            />
          </div>

          {/* 에러 */}
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          )}

          {/* 버튼 */}
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
              등록
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BoardNewPage;
