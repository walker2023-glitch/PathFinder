"""SQLModel table definitions for the PathFound graduation planner."""

from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Course(SQLModel, table=True):
    """A unique course offered in the catalog (e.g., CSE 210)."""

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(index=True, unique=True)
    title: str
    credits: str


class DegreeRequirement(SQLModel, table=True):
    """A course required by one of the user's degree documents."""

    id: Optional[int] = Field(default=None, primary_key=True)
    source_file: str = Field(index=True)
    category: str = Field(index=True)
    course_code: str = Field(index=True)


class SemesterPlan(SQLModel, table=True):
    """A user's placement of a course into a specific semester slot."""

    id: Optional[int] = Field(default=None, primary_key=True)
    course_code: str = Field(index=True)
    semester_id: str = Field(index=True)
    sort_order: int = Field(default=0)
    status: str = Field(default="planned")  # "planned" | "completed"
