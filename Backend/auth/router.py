from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, User
from auth.schemas import RegisterRequest, LoginRequest, AuthResponse, UserOut
from auth.utils import hash_password, verify_password, create_access_token
from auth.dependencies import get_current_user

router = APIRouter()


@router.post("/register", response_model=AuthResponse)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered.")

    user = User(
        name=data.name,
        email=data.email,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "email": user.email})
    user.active_token = token
    db.commit()

    return AuthResponse(token=token, user=UserOut.from_orm(user))


@router.post("/login", response_model=AuthResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    # Issue a new token and overwrite active_token — invalidates any existing session
    token = create_access_token({"sub": str(user.id), "email": user.email})
    user.active_token = token
    db.commit()

    return AuthResponse(token=token, user=UserOut.from_orm(user))


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.active_token = None
    db.commit()
    return {"message": "Logged out successfully."}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.from_orm(current_user)
