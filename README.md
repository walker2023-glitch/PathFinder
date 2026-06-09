# PathFound

PathFound is a local graduation planner for BYU-Idaho. It helps you track degree requirements across general education, your major, and minors, then build a semester-by-semester plan with course status tracking.

The app has two parts:

- **Backend** — FastAPI + SQLModel + SQLite (`main.py`)
- **Frontend** — React + Vite dashboard (`frontend/`)

Your plan data stays on your machine in `pathfound.db`. Degree requirements are seeded from the text files in the project root (`ge.txt`, `my_major.txt`, `my_minor1.txt`, `my_minor2.txt`).

## Features

- Degree requirement checklist grouped by program and category
- Semester planning board with drag-and-drop from the sidebar
- Course status tracking: `planned`, `in-progress`, `completed`
- Progress audit report for completed courses and remaining requirements
- Local SQLite database — no cloud account required

## Prerequisites

- **Python 3.11+** (3.13 works)
- **Node.js 18+** and npm
- Two terminal windows (one for the API, one for the UI)

## Project structure

```
PathFound/
├── main.py              # FastAPI routes
├── models.py            # SQLModel tables
├── database.py          # SQLite engine and migrations
├── seeder.py            # Populates requirements from text files
├── requirements.txt     # Python dependencies
├── ge.txt               # General education requirements
├── my_major.txt         # Major requirements
├── my_minor1.txt        # Minor 1 requirements
├── my_minor2.txt        # Minor 2 requirements
└── frontend/            # React dashboard
    └── src/
        ├── App.jsx
        └── config.js    # API base URL
```

## Run locally

### 1. Clone and open the project

```powershell
git clone https://github.com/walker2023-glitch/PathFinder.git
cd PathFinder
```

### 2. Set up the backend

```powershell
pip install -r requirements.txt
python seeder.py
python -m uvicorn main:app --reload --port 8001
```

Leave this terminal running. The API will be available at [http://127.0.0.1:8001](http://127.0.0.1:8001).

Verify it works: open [http://127.0.0.1:8001/docs](http://127.0.0.1:8001/docs) — you should see the **PathFound** API docs.

> **Port note:** PathFound uses port **8001** by default because port 8000 is often taken by other local apps. If you change the port, update `frontend/src/config.js` to match.

### 3. Set up the frontend

Open a **second** terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually [http://localhost:5173](http://localhost:5173)).

### 4. First-time database seed

Run `python seeder.py` whenever you update the requirement text files. It refreshes `Course` and `DegreeRequirement` rows but does **not** delete your semester plan.

`pathfound.db` is gitignored and created automatically on first API startup.

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/requirements` | All degree requirements by source and category |
| `GET` | `/plan` | Current semester plan |
| `POST` | `/plan/add` | Add a course to a semester |
| `PATCH` | `/plan/update/{plan_id}` | Update course status |
| `DELETE` | `/plan/remove/{plan_id}` | Remove a course from the plan |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| UI shows "Backend unreachable" | Start the API with `python -m uvicorn main:app --reload --port 8001` |
| Empty requirements sidebar | Run `python seeder.py` |
| `No module named 'sqlmodel'` | Run `pip install -r requirements.txt` |
| `/requirements` returns 404 | Another app may be on port 8000 — use port 8001 and check `/docs` shows **PathFound** |
| CORS errors | Frontend must run on `localhost:5173` or `localhost:3000` (already allowed in `main.py`) |

## Development notes

- Re-seed requirements: `python seeder.py`
- API auto-reloads with `--reload` when you edit Python files
- Frontend hot-reloads via Vite during `npm run dev`
- Optional scraper: `scraper.py` (Kuali catalog cache builder; not required for the planner UI)

## License

Personal academic planning project. Not affiliated with BYU-Idaho.
