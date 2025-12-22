from sqlalchemy import Column, Integer, Float, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional, Union

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    uuid = Column(String, unique=True, index=True, nullable=True)
    balance = Column(Float, default=100.0)

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer)
    receiver_id = Column(Integer)
    amount = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="SUCCESS")

# UPDATED: Accept either email or ID for receiver
class TransferRequest(BaseModel):
    sender_id: int
    receiver_identifier: Union[int, str]  # Can be email or user ID as string
    amount: float

class TransferResponse(BaseModel):
    status: str
    message: Optional[str] = None

class BalanceResponse(BaseModel):
    balance: float

class AuditLogResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    amount: float
    timestamp: datetime
    status: str

    class Config:
        from_attributes = True  

class UserCreate(BaseModel):
    email: str
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if len(v) > 128:
            raise ValueError("Password too long (maximum 128 characters)")
        return v

    class Config:
        from_attributes = True

class UserBalanceCreate(BaseModel):
    id: int
    balance: float

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: str
    password: str
    
    @field_validator("password")
    @classmethod
    def validate_password_length_login(cls, v: str) -> str:
        if len(v) > 128:
            raise ValueError("Password too long (maximum 128 characters)")
        return v
    
    class Config:
        from_attributes = True

class UserResponse(BaseModel):
    id: int
    email: str
    uuid: Optional[str] = None
    balance: float

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"