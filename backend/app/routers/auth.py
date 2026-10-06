from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import (
    verify_password, 
    create_access_token, 
    get_current_user
)
from app.models.user import User
from app.models.schema import LoginRequest, AuthResponse, UserResponse
from app.services.schema_builder import drop_all_warehouse_tables

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

@router.post("/login", response_model=AuthResponse)
def login(login_req: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user credentials and return signed access token."""
    username = login_req.username.strip()
    user = db.query(User).filter(User.username == username).first()
    
    if not user or not verify_password(login_req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password."
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact the administrator."
        )

    token = create_access_token({
        "sub": user.username,
        "role": user.role,
        "id": user.id,
        "email": user.email
    })

    return {
        "token": token,
        "user": user
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve profile of currently authenticated user."""
    return current_user

@router.post("/logout")
def logout(db: Session = Depends(get_db)):
    """
    Logout user and clean up the database session:
    Drops all uploaded dataset tables and resets metadata so the next session starts completely fresh.
    """
    try:
        drop_all_warehouse_tables(db)
        return {
            "success": True,
            "message": "Logged out successfully. All warehouse tables have been dropped and session cleaned."
        }
    except Exception as e:
        return {
            "success": False,
            "message": f"Logged out, table cleanup encountered: {str(e)}"
        }
