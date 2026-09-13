import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


LOCAL_DATABASE_URL = (
    "postgresql://darktracex:darktracex_password"
    "@localhost:5432/darktracex"
)

DATABASE_URL = os.getenv("DATABASE_URL", LOCAL_DATABASE_URL)

# Some hosted PostgreSQL providers may return the older postgres:// scheme.
# SQLAlchemy expects postgresql:// for the psycopg2 driver.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace(
        "postgres://",
        "postgresql://",
        1,
    )

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()