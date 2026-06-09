"""SQLite engine and session helpers for the PathFound graduation planner."""

from __future__ import annotations

from pathlib import Path
from typing import Iterator

from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine


ROOT_DIR = Path(__file__).resolve().parent
DATABASE_PATH = ROOT_DIR / "pathfound.db"
DATABASE_URL = f"sqlite:///{DATABASE_PATH}"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    """Create all tables and apply any pending column migrations."""
    import models  # noqa: F401  -- ensure table classes are registered

    SQLModel.metadata.create_all(engine)
    _migrate_semesterplan()


def _migrate_semesterplan() -> None:
    """Add the `status` column to semesterplan if it does not exist yet.

    SQLite does not support IF NOT EXISTS on ALTER TABLE, so we inspect the
    column list first and skip the statement when the column is already present.
    """
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(semesterplan)"))
        columns = {row[1] for row in result}
        if "status" not in columns:
            conn.execute(
                text("ALTER TABLE semesterplan ADD COLUMN status TEXT NOT NULL DEFAULT 'planned'")
            )
            conn.commit()


def get_session() -> Iterator[Session]:
    """FastAPI-friendly dependency that yields a database session."""
    with Session(engine) as session:
        yield session
