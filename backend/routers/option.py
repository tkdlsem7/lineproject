# backend/routers/option.py
# --------------------------------------------------------------
# ✅ 옵션(option) 라우터
#   - 목록 조회  : GET /task-options
#   - 단건 조회  : GET /task-options/{name}
#   - 새 옵션 등록 : POST /task-options
# --------------------------------------------------------------

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.schemas.option import OptionRead, OptionCreate   # 📌 스키마 명칭을 직관적으로
from backend.models.option import options                     # 📌 SQLAlchemy 모델 (단수형 대문자)

# prefix는 ‘컬렉션(복수형)’ 관례를 따르는 편이 REST 설계·프런트 코드와 맞물리기 쉽다.
router = APIRouter(prefix="/task-options", tags=["task-options"])


# -----------------------------------------------------------------
# 1) 옵션 전체 목록 조회
#    - 프런트 첫 화면에서 사용
# -----------------------------------------------------------------
@router.get("/", response_model=list[OptionRead])
def read_options(
    skip: int = 0,                   # 페이지네이션(선택)
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    옵션 컬렉션 전체 조회  
    (skip/limit 파라미터로 페이지네이션 지원)
    """
    return (
        db.query(options)
        .offset(skip)
        .limit(limit)
        .all()
    )


# -----------------------------------------------------------------
# 2) 옵션 단건 조회
#    - 상세 화면 혹은 중복 체크 등에 활용
# -----------------------------------------------------------------
@router.get("/{name}", response_model=OptionRead)
def read_option(
    name: str,                       # ← ✔️ name 뒤에 콤마(,) 필요
    db: Session = Depends(get_db),
):
    """
    name(PK)로 옵션 한 건 조회  
    존재하지 않으면 404 반환
    """
    option = db.query(options).filter(options.name == name).first()

    if option is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Option '{name}' not found",
        )

    return option


# -----------------------------------------------------------------
# 3) 새 옵션 등록 (필요 시)
# -----------------------------------------------------------------
@router.post("/", response_model=OptionRead, status_code=status.HTTP_201_CREATED)
def create_option(
    option_in: OptionCreate,
    db: Session = Depends(get_db),
):
    """
    옵션 신규 등록  
    - 이름이 중복되면 409(CONFLICT) 반환
    """
    # 중복 체크
    if db.query(options).filter(options.name == option_in.name).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Option already exists",
        )

    option = options(**option_in.dict())
    db.add(option)
    db.commit()
    db.refresh(option)
    return option
