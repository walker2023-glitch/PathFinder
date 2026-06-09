import { useState, useEffect } from 'react'
import { API_BASE_URL } from './config'
import './App.css'

// ── Constants ────────────────────────────────────────────────────────────────

const SOURCE_LABELS = {
  ge:     'General Education',
  major:  'CS Major',
  minor1: 'Statistics Minor',
  minor2: 'AI Engineering Minor',
}

const SEMESTERS = [
  'Fall 2024',
  'Winter 2025', 'Spring 2025',
  'Fall 2025',
  'Winter 2026', 'Spring 2026',
  'Fall 2026',
  'Winter 2027', 'Spring 2027',
  'Fall 2027',
  'Winter 2028', 'Spring 2028',
]

// 3-state cycle order
const NEXT_STATUS = { planned: 'in-progress', 'in-progress': 'completed', completed: 'planned' }

// Icon shown on the course card status button for each state
const STATUS_ICON  = { planned: '○', 'in-progress': '◑', completed: '✓' }
const STATUS_LABEL = { planned: 'Planned', 'in-progress': 'In Progress', completed: 'Completed' }

// ── Semester era helpers ──────────────────────────────────────────────────────

const TERM_END_MONTH   = { Winter: 4, Spring: 6, Fall: 12 }
const TERM_START_MONTH = { Winter: 1, Spring: 4, Fall: 9  }

function semesterEndDate(semId) {
  const [term, year] = semId.split(' ')
  return new Date(parseInt(year, 10), (TERM_END_MONTH[term] ?? 12) - 1, 28)
}
function semesterStartDate(semId) {
  const [term, year] = semId.split(' ')
  return new Date(parseInt(year, 10), (TERM_START_MONTH[term] ?? 9) - 1, 1)
}
function getSemesterEra(semId) {
  const now = new Date()
  if (semesterEndDate(semId) < now) return 'past'
  if (semesterStartDate(semId) <= now) return 'current'
  return 'future'
}
function defaultStatus(semId) {
  return getSemesterEra(semId) === 'future' ? 'planned' : 'completed'
}

// ── API helper ────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `Request failed (${res.status})`)
  }
  return res.status === 204 ? null : res.json()
}

// ── App ───────────────────────────────────────────────────────────────────────

// ── AuditModal ────────────────────────────────────────────────────────────────

function AuditModal({ plan, requirements, courseStatusMap, onClose }) {
  // All completed entries, grouped by semester in SEMESTERS order
  const completedBySem = SEMESTERS
    .map(semId => ({
      semId,
      entries: (plan[semId] ?? []).filter(e => e.status === 'completed'),
    }))
    .filter(({ entries }) => entries.length > 0)

  const totalCompleted = completedBySem.reduce((n, { entries }) => n + entries.length, 0)

  // Requirement satisfaction: for each source+category, partition into done / missing
  const reqSections = Object.entries(requirements).map(([source, categories]) => ({
    source,
    label: SOURCE_LABELS[source] ?? source,
    categories: Object.entries(categories).map(([category, codes]) => ({
      category,
      done:    codes.filter(c => courseStatusMap[c] === 'completed'),
      missing: codes.filter(c => courseStatusMap[c] !== 'completed'),
    })),
  }))

  const totalReqCodes  = Object.values(requirements).flatMap(c => Object.values(c).flat()).length
  const satisfiedCount = Object.values(requirements)
    .flatMap(c => Object.values(c).flat())
    .filter(c => courseStatusMap[c] === 'completed').length

  // Close on backdrop click
  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="audit-backdrop" onClick={handleBackdrop} role="dialog" aria-modal="true" aria-label="Progress Audit">
      <div className="audit-modal">

        {/* Header */}
        <div className="audit-header">
          <div>
            <h2 className="audit-title">Progress Audit</h2>
            <p className="audit-sub">BYU-Idaho · PathFound Report</p>
          </div>
          <button className="audit-close" onClick={onClose} aria-label="Close audit">×</button>
        </div>

        {/* Summary bar */}
        <div className="audit-summary">
          <div className="audit-stat">
            <span className="audit-stat-num green">{totalCompleted}</span>
            <span className="audit-stat-label">Courses completed</span>
          </div>
          <div className="audit-stat">
            <span className="audit-stat-num yellow">{satisfiedCount}</span>
            <span className="audit-stat-label">Requirements met</span>
          </div>
          <div className="audit-stat">
            <span className="audit-stat-num red">{totalReqCodes - satisfiedCount}</span>
            <span className="audit-stat-label">Still needed</span>
          </div>
          <div className="audit-progress-wrap">
            <div className="audit-progress-bar">
              <div
                className="audit-progress-fill"
                style={{ width: `${totalReqCodes ? (satisfiedCount / totalReqCodes) * 100 : 0}%` }}
              />
            </div>
            <span className="audit-progress-pct">
              {totalReqCodes ? Math.round((satisfiedCount / totalReqCodes) * 100) : 0}% complete
            </span>
          </div>
        </div>

        <div className="audit-body">

          {/* Left: completed courses by semester */}
          <section className="audit-section">
            <h3 className="audit-section-title">Completed by Semester</h3>
            {completedBySem.length === 0 ? (
              <p className="audit-empty">No completed courses yet.</p>
            ) : (
              completedBySem.map(({ semId, entries }) => (
                <div key={semId} className="audit-sem-group">
                  <p className="audit-sem-label">{semId}</p>
                  <ul className="audit-course-list">
                    {entries.map(e => (
                      <li key={e.id} className="audit-course-row">
                        <span className="audit-check">✓</span>
                        <span className="audit-course-code">{e.course_code}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </section>

          {/* Right: requirement satisfaction */}
          <section className="audit-section">
            <h3 className="audit-section-title">Requirement Checklist</h3>
            {reqSections.map(({ source, label, categories }) => (
              <div key={source} className="audit-req-source">
                <p className="audit-req-source-label">{label}</p>
                {categories.map(({ category, done, missing }) => (
                  <div key={category} className="audit-req-category">
                    <p className="audit-req-cat-label">
                      {category}
                      <span className="audit-req-fraction"> {done.length}/{done.length + missing.length}</span>
                    </p>
                    <div className="audit-pill-row">
                      {done.map(c => (
                        <span key={c} className="audit-pill done">{c}</span>
                      ))}
                      {missing.map(c => (
                        <span key={c} className="audit-pill missing">{c}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>

        </div>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [requirements, setRequirements] = useState({})
  const [plan, setPlan] = useState({})
  const [inputs, setInputs] = useState({})
  const [dragOverSem, setDragOverSem] = useState(null)
  const [showAudit, setShowAudit] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [actionError, setActionError] = useState(null)

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      try {
        const [reqs, planData] = await Promise.all([
          apiFetch('/requirements'),
          apiFetch('/plan'),
        ])
        if (!cancelled) {
          setRequirements(reqs)
          setPlan(planData)
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [])

  // ── Derived: course_code → best status in plan ─────────────────────────────
  // Priority: completed > in-progress > planned. A course in multiple semesters
  // shows its highest-priority status in the sidebar.
  const PRIORITY = { completed: 3, 'in-progress': 2, planned: 1 }
  const courseStatusMap = {}
  for (const entry of Object.values(plan).flat()) {
    const existing = courseStatusMap[entry.course_code]
    if (!existing || PRIORITY[entry.status] > PRIORITY[existing]) {
      courseStatusMap[entry.course_code] = entry.status
    }
  }

  // Sidebar pill CSS class based on plan membership and status
  function pillClass(code) {
    const s = courseStatusMap[code]
    if (!s) return 'pill-missing'
    if (s === 'completed') return 'pill-completed'
    return 'pill-inprogress'
  }

  // ── Core add helper (used by both text input and drag-drop) ───────────────
  async function addCourse(semesterId, courseCode) {
    const raw = courseCode.trim().toUpperCase()
    if (!raw) return
    setActionError(null)
    try {
      const newEntry = await apiFetch('/plan/add', {
        method: 'POST',
        body: JSON.stringify({
          course_code: raw,
          semester_id: semesterId,
          sort_order: (plan[semesterId] ?? []).length,
          status: defaultStatus(semesterId),
        }),
      })
      setPlan(prev => ({
        ...prev,
        [semesterId]: [...(prev[semesterId] ?? []), newEntry],
      }))
    } catch (err) {
      setActionError(err.message)
    }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  async function handleAdd(semesterId) {
    const raw = (inputs[semesterId] ?? '').trim()
    if (!raw) return
    await addCourse(semesterId, raw)
    setInputs(prev => ({ ...prev, [semesterId]: '' }))
  }

  async function handleCycleStatus(entry) {
    const next = NEXT_STATUS[entry.status] ?? 'planned'
    setActionError(null)
    try {
      const updated = await apiFetch(`/plan/update/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      })
      setPlan(prev => ({
        ...prev,
        [entry.semester_id]: (prev[entry.semester_id] ?? []).map(e =>
          e.id === entry.id ? updated : e
        ),
      }))
    } catch (err) {
      setActionError(err.message)
    }
  }

  async function handleRemove(planId, semesterId) {
    setActionError(null)
    try {
      await apiFetch(`/plan/remove/${planId}`, { method: 'DELETE' })
      setPlan(prev => ({
        ...prev,
        [semesterId]: (prev[semesterId] ?? []).filter(e => e.id !== planId),
      }))
    } catch (err) {
      setActionError(err.message)
    }
  }

  // ── Drag-and-drop ──────────────────────────────────────────────────────────

  function handleDragStart(e, code) {
    e.dataTransfer.setData('text/plain', code)
    e.dataTransfer.effectAllowed = 'copy'
  }

  function handleDragOver(e, semId) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSem(semId)
  }

  function handleDrop(e, semesterId) {
    e.preventDefault()
    setDragOverSem(null)
    const code = e.dataTransfer.getData('text/plain')
    if (code) addCourse(semesterId, code)
  }

  // ── Render: offline ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="load-error">
        <h2>Backend unreachable</h2>
        <p>{loadError}</p>
        <p>Start the API: <code>python -m uvicorn main:app --reload</code></p>
      </div>
    )
  }

  // ── Render: dashboard ──────────────────────────────────────────────────────

  // Sidebar summary counts
  const allCodes = Object.values(requirements).flatMap(cats => Object.values(cats).flat())
  const missingCount     = allCodes.filter(c => !courseStatusMap[c]).length
  const inProgressCount  = allCodes.filter(c => courseStatusMap[c] && courseStatusMap[c] !== 'completed').length
  const completedCount   = allCodes.filter(c => courseStatusMap[c] === 'completed').length

  return (
    <div className="dashboard">

      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2>Degree Checklist</h2>
          <div className="sidebar-legend">
            <span className="legend-dot missing" />
            <span className="legend-count">{missingCount}</span>
            <span className="legend-dot inprogress" />
            <span className="legend-count">{inProgressCount}</span>
            <span className="legend-dot completed" />
            <span className="legend-count">{completedCount}</span>
          </div>
        </div>

        <div className="sidebar-body">
          {Object.entries(requirements).map(([source, categories]) => (
            <section key={source} className="req-source">
              <h3 className="req-source-label">
                {SOURCE_LABELS[source] ?? source}
              </h3>
              {Object.entries(categories).map(([category, codes]) => (
                <div key={category} className="req-category">
                  <p className="category-label">{category}</p>
                  <ul className="pill-list">
                    {codes.map(code => (
                      <li
                        key={code}
                        className={`req-pill ${pillClass(code)}`}
                        draggable
                        onDragStart={e => handleDragStart(e, code)}
                        title={
                          courseStatusMap[code]
                            ? STATUS_LABEL[courseStatusMap[code]]
                            : 'Not yet planned — drag to a semester'
                        }
                      >
                        {code}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
        </div>
      </aside>

      {/* ── Canvas ── */}
      <main className="canvas">
        <header className="canvas-header">
          <div className="canvas-title">
            <h1>PathFound</h1>
            <p className="canvas-sub">BYU-Idaho · Graduation Planner</p>
          </div>

          <div className="header-actions">
            <button
              className="audit-btn"
              onClick={() => setShowAudit(true)}
            >
              📋 Audit Report
            </button>

            {actionError && (
              <div className="action-error" role="alert">
                <span>{actionError}</span>
                <button
                  className="dismiss-btn"
                  onClick={() => setActionError(null)}
                  aria-label="Dismiss error"
                >×</button>
              </div>
            )}
          </div>
        </header>

        {showAudit && (
          <AuditModal
            plan={plan}
            requirements={requirements}
            courseStatusMap={courseStatusMap}
            onClose={() => setShowAudit(false)}
          />
        )}

        <div className="semester-grid">
          {SEMESTERS.map(semId => {
            const era = getSemesterEra(semId)
            const entries = (plan[semId] ?? [])
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
            const doneCount = entries.filter(e => e.status === 'completed').length
            const isDragOver = dragOverSem === semId

            return (
              <div
                key={semId}
                className={[
                  'semester-col',
                  `era-${era}`,
                  isDragOver ? 'drag-over' : '',
                ].join(' ')}
                onDragOver={e => handleDragOver(e, semId)}
                onDragLeave={() => setDragOverSem(null)}
                onDrop={e => handleDrop(e, semId)}
              >
                <div className="semester-col-header">
                  <div className="semester-title-row">
                    <h3 className="semester-title">{semId}</h3>
                    {era === 'past' && <span className="era-badge past">Past</span>}
                    {era === 'current' && <span className="era-badge current">Now</span>}
                  </div>
                  <span className="credit-badge">{doneCount}/{entries.length}</span>
                </div>

                {entries.length > 0 && (
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${(doneCount / entries.length) * 100}%` }}
                    />
                  </div>
                )}

                <div className="course-list">
                  {entries.map(entry => (
                    <div key={entry.id} className={`course-card status-${entry.status}`}>
                      <button
                        className={`status-btn s-${entry.status}`}
                        onClick={() => handleCycleStatus(entry)}
                        aria-label={`${entry.course_code}: ${STATUS_LABEL[entry.status]} — click to advance`}
                        title={`${STATUS_LABEL[entry.status]} → click to advance`}
                      >
                        {STATUS_ICON[entry.status] ?? '○'}
                      </button>

                      <span className="course-code">{entry.course_code}</span>

                      <button
                        className="remove-btn"
                        onClick={() => handleRemove(entry.id, semId)}
                        aria-label={`Remove ${entry.course_code}`}
                        title="Remove"
                      >×</button>
                    </div>
                  ))}
                </div>

                <div className="add-row">
                  <input
                    type="text"
                    className="add-input"
                    placeholder="e.g. CSE 210"
                    value={inputs[semId] ?? ''}
                    onChange={e =>
                      setInputs(prev => ({ ...prev, [semId]: e.target.value }))
                    }
                    onKeyDown={e => e.key === 'Enter' && handleAdd(semId)}
                    aria-label={`Add course to ${semId}`}
                  />
                  <button className="add-btn" onClick={() => handleAdd(semId)}>
                    Add
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
