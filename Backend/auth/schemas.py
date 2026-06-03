"""
auth/schemas.py
---------------
Pydantic models that define the shape of request/response data
for the auth endpoints. FastAPI uses these for automatic validation.
"""
from pydantic import BaseModel, EmailStr, ConfigDict


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut
