"""SQLAlchemy engine + session setup for the MySQL database."""
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db_session():
    """A plain session for our stores to use. Since this is a small student
    project (no request-scoped dependency injection needed), each store just
    opens one short-lived session per call and closes it when done.
    """
    return SessionLocal()
