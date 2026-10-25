from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, EmailStr
import uuid
from datetime import datetime
from database import get_connection
from auth import verify_password, get_password_hash, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict

@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE email = %s", (req.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    
    user_id = f"usr_{uuid.uuid4().hex[:12]}"
    pwd_hash = get_password_hash(req.password)
    now = datetime.utcnow().isoformat()
    
    cursor.execute(
        "INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, req.email, pwd_hash, req.full_name, "user", now)
    )
    conn.commit()
    conn.close()
    
    token = create_access_token({"sub": user_id, "email": req.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": req.email,
            "full_name": req.full_name,
            "role": "user"
        }
    }

@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, password_hash, full_name, role FROM users WHERE email = %s", (req.email,))
    row = cursor.fetchone()
    conn.close()
    
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    token = create_access_token({"sub": row["id"], "email": row["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": row["role"]
        }
    }

@router.post("/demo-login", response_model=AuthResponse)
def demo_login():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, email, full_name, role FROM users WHERE email = %s", ("demo@finpath.ai",))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Demo account not found. Please re-seed database.")
        
    token = create_access_token({"sub": row["id"], "email": row["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "email": row["email"],
            "full_name": row["full_name"],
            "role": row["role"]
        }
    }

@router.get("/me")
def get_profile(current_user: dict = Depends(get_current_user)):
    return {"user": current_user}
