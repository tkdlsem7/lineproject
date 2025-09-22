# backend/create_db.py
# ─────────────────────────────────────────────────────────────
# 개발용 테이블 생성 스크립트
#  - 반드시 "루트 폴더"에서 실행: python -m backend.create_db
#  - DB 엔진은 deps.py(단일 출처)에서만 가져온다
#  - 모델이 선언된 모듈을 import 해서 메타데이터에 등록시킨 뒤, create_all
# ─────────────────────────────────────────────────────────────

from .deps import engine  # ✅ 단일 출처: deps.py의 엔진만 사용

# ⚠️ 중요: 모델 모듈을 import 해야 메타데이터(Base.metadata)에 테이블들이 등록됩니다.
#   (import 자체가 side-effect로 클래스 등록을 수행)
from .Login import models as login_models  # noqa: F401  # 예: User 모델이 여기 있음

# Base 가져오기
from .Login.models import Base  # ✅ Base가 여기서 정의되어 있다면 이걸 사용

def main() -> None:
    print("[create_db] creating tables with engine:", engine.url.render_as_string(hide_password=True))
    Base.metadata.create_all(bind=engine)
    print("[create_db] done.")

if __name__ == "__main__":
    main()
