# backend/schemas/auth.py

from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str
    
