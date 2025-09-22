// MainPage.tsx
// - 상단 '시스템 생산실' 클릭 시 하위 탭 노출
// - 하위 탭에서 "Option Configuration" 클릭 → /options 로 이동
// - 하위 탭에서 "Dashboard" 클릭 → /dashboard 로 이동  ✅ 추가
// - 오른쪽에 로그인 이름 표시 + 로그아웃 버튼 추가
// - 요청사항: 상단 문구/버튼 사이즈 키움

import { table } from 'console';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const MainPage: React.FC<{ userName?: string }> = ({ userName = '조성국' }) => {
  const navigate = useNavigate();

  // ✅ 라우팅 상수: 실제 프로젝트 라우트에 맞게 필요 시 수정
  const ROUTE_DASHBOARD = '/dashboard'; // 대시보드 페이지 경로
  const ROUTE_OPTIONS   = '/options';   // 옵션 설정 페이지 경로
  const ROUTE_TROUBLESHOOT = '/troubleshoot'
  const SetupDefectEntryPage = '/SetupDefectEntryPage'


  // 하위 탭 노출 제어: 시스템 생산실일 때만 보이도록 기본값 true
  const [activeSection, setActiveSection] = useState<
    '시스템 생산실' | '통합 생산실' | '생산 물류팀' | '파트 생산팀'
  >('시스템 생산실');
  const [showSubTabs, setShowSubTabs] = useState(true);

  // 표시 이름: prop > localStorage > 기본값 순서
  const nameToShow =
    userName || localStorage.getItem('user_name') || '조성국';

  /** 섹션 버튼 클릭 핸들러 */
  const handleSectionClick = (label: typeof activeSection) => {
    setActiveSection(label);
    setShowSubTabs(label === '시스템 생산실'); // 시스템 생산실일 때만 하위 탭 표시
  };

  /** 로그아웃: 토큰/이름 정리 후 로그인 페이지로 이동 */
  const handleLogout = () => {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_name');
      // 필요 시 다른 키도 함께 정리: refresh_token / sessionStorage / cookie 등
    } finally {
      navigate('/', { replace: true }); // 로그인 페이지로 이동
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* 상단 바 */}
      <div className="mb-5 flex items-center justify-between">
        {/* 좌측 섹션 버튼들(사이즈 업: text-base, padding 확대) */}
        <div className="flex flex-wrap gap-3">
          {(['시스템 생산실', '통합 생산실', '생산 물류팀', '파트 생산팀'] as const).map(
            (label) => (
              <button
                key={label}
                onClick={() => handleSectionClick(label)}
                className={`rounded-full px-4 py-2 text-base font-medium transition ${
                  activeSection === label
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>

        {/* 우측: 로그인 사용자 이름 + 새로고침 + 로그아웃 + 동기화 시각 (사이즈 업) */}
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-gray-800">
            {nameToShow}님
          </span>

          {/* 새로고침(디자인 유지, 사이즈 업) */}
          <button
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            onClick={() => window.location.reload()}
          >
            새로고침
          </button>

          {/* ✅ 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className="rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300"
            title="로그아웃하고 로그인 화면으로 이동"
          >
            로그아웃
          </button>

          <span className="ml-1 text-sm text-gray-500">
            마지막 동기화: 2025. 9. 10. 오후 3:28:21
          </span>
        </div>
      </div>

      {/* 하위 탭: 시스템 생산실일 때만 보임 (사이즈 업: text-base, padding 확대) */}
      {showSubTabs && (
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 p-1.5">
            {['Dashboard', 'Option Configuration', 'Log Charts', 'Trouble Shoot', 'Row data'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'Dashboard') {
                    navigate(ROUTE_DASHBOARD);
                  } else if (tab === 'Option Configuration') {
                    navigate(ROUTE_OPTIONS);
                  } else if (tab === 'Trouble Shoot') {
                    navigate(ROUTE_TROUBLESHOOT); // ← 추가
                  } else if (tab === "Row data") {
                    navigate(SetupDefectEntryPage);
                  }
                }}
                className={`rounded-full px-4 py-2 text-base ${
                  tab === 'Dashboard'
                    ? 'bg-white text-blue-600 shadow'
                    : 'text-gray-700 hover:bg-white hover:shadow'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MainPage;
