import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy import MetaData
from sqlalchemy.orm import sessionmaker, DeclarativeBase

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is missing. Put it in apps/ai-fastapi/.env")

AI_DB_SCHEMA = os.getenv("AI_DB_SCHEMA", "ai").strip()
if not AI_DB_SCHEMA.replace("_", "").isalnum() or not AI_DB_SCHEMA[0].isalpha():
    raise RuntimeError("AI_DB_SCHEMA must start with a letter and contain only letters, numbers, and underscores")

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": f"-csearch_path={AI_DB_SCHEMA},public"},
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    metadata = MetaData(schema=AI_DB_SCHEMA)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
