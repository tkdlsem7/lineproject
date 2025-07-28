# 📁 backend/routers/machine_info.py
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.db.database import get_db
from backend.schemas.machine_info import MachineInfoOut
from backend.crud.machine_info   import get_machines_by_site

router = APIRouter(
    prefix="",          # /machineinfor 그대로 쓰고 싶다면 prefix 비움
    tags=["machineinfo"]
)


@router.get(
    "/machineinfor",                # ▶ GET /machineinfor?site=본사
    response_model=list[MachineInfoOut],
    status_code=status.HTTP_200_OK
)
def list_machine_info(
    site: str = Query('', description="본사 / 부항리 / 진우리"),
    db: Session = Depends(get_db),
):
    """
    선택한 `site` 의 장비 목록을 반환  
    - site 파라미터가 비어 있으면 전체 장비
    - 결과가 없으면 204 No Content
    """
    rows = get_machines_by_site(db, site)
    if not rows:
        return []          # FastAPI 가 빈 리스트일 때 200 으로 내려주길 원한다면 그대로
    return rows
