# 📁 backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ───────────────────────────────────────────────
# 1) 패키지 내부(relative) import 권장  ──
#    main.py 는 backend 패키지 안에 있으므로 .routers 로 시작
# ───────────────────────────────────────────────
from .routers.auth           import router as auth_router
from .routers.equip_progress import router as equip_progress_router
from .routers.equipment import router as equipment
from .routers.option import router as option_router
from .routers.OptionDetail import router as detail_router
from .routers.optionupdate import router as updateoption

# (추가 라우터가 있으면 아래처럼 계속 import)
# from .routers.user import router as user_router

app = FastAPI(
    title="Equipment Progress API",
    version="0.1.0",
)

# ───────────────────────────────────────────────
# 2) CORS 설정
# ───────────────────────────────────────────────
origins = [
    "http://localhost:3000",  # CRA
    "http://localhost:5173",  # Vite
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # 개발 중엔 ["*"] 로 열어도 OK
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ───────────────────────────────────────────────
# 3) 헬스 체크 엔드포인트
# ───────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    return {"message": "✅ FastAPI is running"}

# ───────────────────────────────────────────────
# 4) 라우터 등록
#    * 개별 라우터 파일에서 prefix, tags 지정했으므로
#      여기서는 include_router 만 호출하면 됨
# ───────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(equipment , prefix="/api")
app.include_router(equip_progress_router)
app.include_router(option_router, prefix="/api")
app.include_router(detail_router, prefix="/api")
app.include_router(updateoption, prefix="/api")
# app.include_router(user_router)

# ───────────────────────────────────────────────
# (선택) 애플리케이션 실행 시 등록된 라우트 출력
# ───────────────────────────────────────────────
if __name__ == "__main__":
    # python backend/main.py 로 실행했을 때만 실행
    from fastapi.routing import APIRoute
    for r in app.router.routes:
        if isinstance(r, APIRoute):
            print(f"▶ {r.path}  →  {r.name}")
