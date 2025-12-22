# backend/api/routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import timedelta

from model import (
    User, AuditLog, UserCreate, UserLogin, Token, TransferRequest,
    TransferResponse, UserResponse
)
from database import get_db
from auth import (
    get_password_hash, verify_password, create_access_token, 
    get_current_user, ACCESS_TOKEN_EXPIRE_MINUTES
)
from transfer import transfer_funds
from logger import logger

router = APIRouter()

@router.post("/register", response_model=Token)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user_data.password)
    new_user = User(email=user_data.email, password_hash=hashed_password, balance=100.0)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(
        data={"sub": str(new_user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == user_data.email).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/history")
def get_transaction_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    logs = (
        db.query(AuditLog)
        .filter(or_(AuditLog.sender_id == current_user.id, AuditLog.receiver_id == current_user.id))
        .order_by(AuditLog.timestamp.desc())
        .all()
    )
    return logs

@router.post("/transfer", response_model=TransferResponse)
def perform_transfer(
    request: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if request.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only transfer from your own account")

    # FIXED: receiver_id (not receiver_identifier)
    logger.info(f"Transfer initiated: {request.sender_id} → {request.receiver_identifier} (${request.amount})")

    try:
        transfer_funds(db, request.sender_id, request.receiver_identifier, request.amount)
        db.commit()
        return TransferResponse(status="success", message="Transfer successful")

    except HTTPException:
        db.rollback()
        logger.warning(f"Transfer failed (client error)")
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Transfer failed (server error): {str(e)}")
        raise HTTPException(status_code=500, detail="Transfer failed due to server error")