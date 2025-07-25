# ───────────────────────────────────────────────────────────────
#  📦 FRONTEND Dockerfile  (dev server: http://localhost:5173)
# ───────────────────────────────────────────────────────────────
# 1) Node 이미지를 기반으로 한다 ― Alpine이 가장 가벼움
FROM node:20-alpine

# 2) 컨테이너 안 작업 경로
WORKDIR /app

# 3) 의존성 목록 복사  →  캐시 레이어 활용
COPY package.json package-lock.json ./

# 4) (npm 사용) 의존성 설치
RUN npm ci            # pnpm/yarn → npm으로 그대로 두면 OK

# 5) 나머지 소스 코드 복사
COPY . .

# 6) Vite 개발 서버 실행
#    ─ host 0.0.0.0 으로 열어야 컨테이너 외부(호스트)에서 접근 가능
# ❶ 패키지 매니저를 pnpm → npm 으로 변경
# ❷ npm 스크립트 실행 방식에 맞춰 인수 전달("--")  
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# (선택) 가독성을 위해 명시적으로 포트 노출
EXPOSE 5173
