# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

from api.routes import router
from database import engine
from model import Base

load_dotenv()

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Secure Transaction System")

# Include router FIRST (before CORS)
app.include_router(router)

# CORS for React/Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Transaction System API - Use /login or /register to get started"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="localhost", port=8000, reload=True)