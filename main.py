"""PathFound graduation planner — FastAPI application."""

from __future__ import annotations

from collections import defaultdict
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, SQLModel, select

from database import get_session, init_db
from models import DegreeRequirement, SemesterPlan

# ---------------------------------------------------------------------------
# Response / request schemas
# Defined independently of the table=True models so SQLModel does not try to
# register them as additional database tables.
# ---------------------------------------------------------------------------


class SemesterPlanRead(SQLModel):
    """Read schema returned to the client for a SemesterPlan row."""

    id: int
    course_code: str
    semester_id: str
    sort_order: int
    status: str


class PlanAddRequest(SQLModel):
    """Write schema accepted by POST /plan/add."""

    course_code: str
    semester_id: str
    sort_order: int = 0
    status: str = "planned"


# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="PathFound", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["Content-Type"],
)

SessionDep = Annotated[Session, Depends(get_session)]


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ---------------------------------------------------------------------------
# GET /requirements
# ---------------------------------------------------------------------------

RequirementsResponse = dict[str, dict[str, list[str]]]


@app.get(
    "/requirements",
    response_model=RequirementsResponse,
    summary="All degree requirements grouped by source and category",
)
def get_requirements(session: SessionDep) -> RequirementsResponse:
    """Return every DegreeRequirement row nested as:
    ``{ source_file: { category: [course_code, ...] } }``
    """
    rows = session.exec(
        select(DegreeRequirement).order_by(
            DegreeRequirement.source_file, DegreeRequirement.category
        )
    ).all()

    grouped: dict[str, dict[str, list[str]]] = defaultdict(lambda: defaultdict(list))
    for row in rows:
        grouped[row.source_file][row.category].append(row.course_code)

    # Convert inner defaultdicts to plain dicts for clean JSON serialisation.
    return {src: dict(cats) for src, cats in grouped.items()}


# ---------------------------------------------------------------------------
# GET /plan
# ---------------------------------------------------------------------------

PlanResponse = dict[str, list[SemesterPlanRead]]


@app.get(
    "/plan",
    response_model=PlanResponse,
    summary="Current semester plan grouped by semester",
)
def get_plan(session: SessionDep) -> PlanResponse:
    """Return every SemesterPlan row nested as:
    ``{ semester_id: [ {id, course_code, semester_id, sort_order}, ... ] }``
    Entries within each semester are ordered by ``sort_order``.
    """
    rows = session.exec(
        select(SemesterPlan).order_by(
            SemesterPlan.semester_id, SemesterPlan.sort_order
        )
    ).all()

    grouped: dict[str, list[SemesterPlanRead]] = defaultdict(list)
    for row in rows:
        grouped[row.semester_id].append(SemesterPlanRead.model_validate(row))

    return dict(grouped)


# ---------------------------------------------------------------------------
# POST /plan/add
# ---------------------------------------------------------------------------


@app.post(
    "/plan/add",
    response_model=SemesterPlanRead,
    status_code=201,
    summary="Add a course to a semester slot",
)
def add_to_plan(body: PlanAddRequest, session: SessionDep) -> SemesterPlanRead:
    """Insert a new SemesterPlan row.

    Returns the created row including its auto-generated ``id``.
    """
    if not body.course_code.strip():
        raise HTTPException(status_code=422, detail="course_code must not be blank.")
    if not body.semester_id.strip():
        raise HTTPException(status_code=422, detail="semester_id must not be blank.")
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="status must be 'planned', 'in-progress', or 'completed'.",
        )

    entry = SemesterPlan(
        course_code=body.course_code.strip(),
        semester_id=body.semester_id.strip(),
        sort_order=body.sort_order,
        status=body.status,
    )

    try:
        session.add(entry)
        session.commit()
        session.refresh(entry)
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=500, detail="Could not save plan entry.")

    return SemesterPlanRead.model_validate(entry)


# ---------------------------------------------------------------------------
# PATCH /plan/update/{plan_id}
# ---------------------------------------------------------------------------


class PlanStatusUpdate(SQLModel):
    """Write schema accepted by PATCH /plan/update/{plan_id}."""

    status: str


VALID_STATUSES = {"planned", "in-progress", "completed"}


@app.patch(
    "/plan/update/{plan_id}",
    response_model=SemesterPlanRead,
    summary="Update the status of a plan entry",
)
def update_plan_status(
    plan_id: int, body: PlanStatusUpdate, session: SessionDep
) -> SemesterPlanRead:
    """Update the ``status`` field of an existing SemesterPlan row.

    Accepted values: ``"planned"``, ``"in-progress"``, ``"completed"``.
    """
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="status must be 'planned', 'in-progress', or 'completed'.",
        )

    entry = session.get(SemesterPlan, plan_id)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"No plan entry found with id {plan_id}.",
        )

    entry.status = body.status

    try:
        session.add(entry)
        session.commit()
        session.refresh(entry)
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=500, detail="Could not update plan entry.")

    return SemesterPlanRead.model_validate(entry)


# ---------------------------------------------------------------------------
# DELETE /plan/remove/{plan_id}
# ---------------------------------------------------------------------------


@app.delete(
    "/plan/remove/{plan_id}",
    response_model=dict[str, str],
    summary="Remove a course entry from the semester plan",
)
def remove_from_plan(plan_id: int, session: SessionDep) -> dict[str, str]:
    """Delete the SemesterPlan row identified by ``plan_id``."""
    entry = session.get(SemesterPlan, plan_id)
    if entry is None:
        raise HTTPException(
            status_code=404,
            detail=f"No plan entry found with id {plan_id}.",
        )

    try:
        session.delete(entry)
        session.commit()
    except SQLAlchemyError:
        session.rollback()
        raise HTTPException(status_code=500, detail="Could not remove plan entry.")

    return {"detail": f"Plan entry {plan_id} removed."}
