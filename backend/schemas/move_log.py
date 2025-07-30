from pydantic import BaseModel

class MoveLogIn(BaseModel):
    machine_id: str
    manager: str
    from_site: str
    from_slot: str
    to_site: str
    to_slot: str
