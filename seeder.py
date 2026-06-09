"""Populate the PathFound SQLite database from the user's degree text files.

The seeder reads each of `ge.txt`, `my_major.txt`, `my_minor1.txt`, and
`my_minor2.txt`, detects category headers (the line preceding the
"Total Credits" marker), and extracts course rows formatted as
`<CODE> - <Title> (<credits>)`.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator

from sqlmodel import Session, delete

from database import ROOT_DIR, engine, init_db
from models import Course, DegreeRequirement


SOURCES: dict[str, Path] = {
    "ge": ROOT_DIR / "ge.txt",
    "major": ROOT_DIR / "my_major.txt",
    "minor1": ROOT_DIR / "my_minor1.txt",
    "minor2": ROOT_DIR / "my_minor2.txt",
}

# Matches "CSE110 - Introduction to Programming (2)" and similar.
# Letters: 2-6 uppercase. Digits: exactly 3 with optional trailing uppercase letter.
COURSE_RE = re.compile(
    r"^([A-Z]{2,6})(\d{3}[A-Z]?)\s*-\s*(.+?)\s*\(([^)]+)\)\s*$"
)

# Matches credit count lines like "14", "9 - 10", "1 - 2", "3-4".
CREDIT_LINE_RE = re.compile(r"^\d+(?:\s*-\s*\d+)?$")

REQUIREMENTS_MARKER = "Program Course Requirements"
TOTAL_CREDITS_MARKER = "Total Credits"
GRAND_TOTAL_PREFIX = "Grand Total Credits"


@dataclass(frozen=True)
class ParsedRow:
    source: str
    category: str
    code: str
    title: str
    credits: str


def normalize_code(letters: str, digits: str) -> str:
    """Insert a space between the subject prefix and the numeric portion."""
    return f"{letters} {digits}"


def parse_file(source_name: str, path: Path) -> Iterator[ParsedRow]:
    """Yield ParsedRow records for every course found inside `path`."""
    lines = [line.strip() for line in path.read_text(encoding="utf-8").splitlines()]

    category = "General"
    in_requirements = False

    for index, line in enumerate(lines):
        if not line:
            continue

        if line == REQUIREMENTS_MARKER:
            in_requirements = True
            continue
        if not in_requirements:
            continue
        if line.startswith(GRAND_TOTAL_PREFIX):
            break

        # Category headers sit directly above a "<credits>" / "Total Credits" pair.
        if index + 2 < len(lines):
            next_line = lines[index + 1].strip()
            after_next = lines[index + 2].strip()
            if after_next == TOTAL_CREDITS_MARKER and CREDIT_LINE_RE.match(next_line):
                category = line
                continue

        match = COURSE_RE.match(line)
        if not match:
            continue

        letters, digits, title, credits = match.groups()
        yield ParsedRow(
            source=source_name,
            category=category,
            code=normalize_code(letters, digits),
            title=title.strip(),
            credits=credits.strip(),
        )


def wipe_existing(session: Session) -> None:
    """Remove any previously seeded course and requirement rows."""
    session.exec(delete(DegreeRequirement))
    session.exec(delete(Course))
    session.commit()


def seed() -> tuple[int, int]:
    """Populate the database from the four source files.

    Returns a tuple of (courses_inserted, requirements_inserted).
    """
    init_db()

    courses_inserted = 0
    requirements_inserted = 0
    seen_codes: set[str] = set()

    with Session(engine) as session:
        wipe_existing(session)

        for source_name, path in SOURCES.items():
            if not path.exists():
                print(f"WARN: source file missing, skipping: {path.name}")
                continue

            file_course_count = 0
            file_req_count = 0
            for row in parse_file(source_name, path):
                if row.code not in seen_codes:
                    session.add(
                        Course(code=row.code, title=row.title, credits=row.credits)
                    )
                    seen_codes.add(row.code)
                    courses_inserted += 1
                    file_course_count += 1

                session.add(
                    DegreeRequirement(
                        source_file=row.source,
                        category=row.category,
                        course_code=row.code,
                    )
                )
                requirements_inserted += 1
                file_req_count += 1

            print(
                f"  {source_name:<6} -> {file_course_count} new courses, "
                f"{file_req_count} requirement rows from {path.name}"
            )

        session.commit()

    return courses_inserted, requirements_inserted


def main() -> None:
    print("Seeding PathFound database...")
    courses, requirements = seed()
    print(
        f"Done. Inserted {courses} unique courses and {requirements} "
        f"degree-requirement rows."
    )


if __name__ == "__main__":
    main()
