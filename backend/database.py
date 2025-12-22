from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from model import Base  # Import shared Base from model.py

SQLALCHEMY_DATABASE_URL = "sqlite:///./app.db"  # SQLite for simplicity
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create tables (run once on import)
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()