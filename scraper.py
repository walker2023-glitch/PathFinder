"""Download raw BYU-Idaho Kuali catalog payloads into local JSON caches."""

from __future__ import annotations

import json
from pathlib import Path

import requests


CATALOG_ID = "68dc4d77c3ad086d83653f48"
BASE_URL = f"https://byui.kuali.co/api/v1/catalog/items/{CATALOG_ID}"
ROOT_DIR = Path(__file__).resolve().parent

ENDPOINTS = {
    "programs": {
        "url": f"{BASE_URL}/programs",
        "output_path": ROOT_DIR / "raw_programs.json",
    },
    "courses": {
        "url": f"{BASE_URL}/courses",
        "output_path": ROOT_DIR / "raw_courses.json",
    },
}


def fetch_json(url: str) -> str:
    """Fetch a JSON endpoint and return the raw response text."""
    response = requests.get(url, timeout=30)
    response.raise_for_status()

    # Validate the response before caching it so failures are caught immediately.
    json.loads(response.text)
    return response.text


def cache_payload(name: str, url: str, output_path: Path) -> None:
    """Download one endpoint and write its raw JSON payload to disk."""
    payload = fetch_json(url)
    output_path.write_text(payload, encoding="utf-8")
    print(f"Saved {name} payload to {output_path}")


def main() -> None:
    failures: list[str] = []

    for name, endpoint in ENDPOINTS.items():
        try:
            cache_payload(name, endpoint["url"], endpoint["output_path"])
        except requests.HTTPError as error:
            failures.append(f"{name}: {error}")

    if failures:
        failed = "\n".join(f"- {failure}" for failure in failures)
        raise SystemExit(f"Failed to download one or more payloads:\n{failed}")


if __name__ == "__main__":
    main()
