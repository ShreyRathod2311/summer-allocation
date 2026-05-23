import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import logoUrl from "./src/SoFI Black Logo (Light Theme)-B3FKSLl0.svg";

// ── Helpers ───────────────────────────────────────────────────────────────────
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const VACATION_START = new Date("2025-06-01");
const VACATION_END = new Date("2025-07-31");
const TOTAL_VACATION_DAYS = 61;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function isAdminUser(user) {
  if (!supabase || !user) return false;
  const { data, error } = await supabase
    .from("admin_users")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

const DEFAULT_PROJECTS = [
  { id: "p1", name: "Centricity-Wealth Management platform", description: " ", slots: 3, sector: "Wealth Management" },
  { id: "p2", name: "ER 1", description: " ", slots: 2, sector: "Industrials" },
  { id: "p3", name: "ER 2", description: " ", slots: 2, sector: "Technology" },
  { id: "p4", name: "ER 3", description: " ", slots: 3, sector: "Healthcare" },
  { id: "p5", name: "ER 4", description: " ", slots: 2, sector: "Consumer" },
];

function getLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function setLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function dateRanges(dates) {
  if (!dates.length) return "None";
  const sorted = [...dates].sort();
  const ranges = [];
  let start = sorted[0], end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(end), cur = new Date(sorted[i]);
    const diff = (cur - prev) / 86400000;
    if (diff === 1) { end = sorted[i]; }
    else { ranges.push({ start, end }); start = sorted[i]; end = sorted[i]; }
  }
  ranges.push({ start, end });
  return ranges.map(({ start, end }) => {
    const s = new Date(start), e = new Date(end);
    const fmt = (d) => `${d.toLocaleString("default", { month: "short" })} ${d.getDate()}`;
    return s.getTime() === e.getTime() ? fmt(s) : `${fmt(s)}–${fmt(e)}`;
  }).join(", ");
}

// ── CSS Variables ─────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #F7F5F0;
    --surface: #FFFFFF;
    --border: #E8E4DC;
    --text-primary: #1A1814;
    --text-secondary: #6B6560;
    --text-muted: #A09890;
    --accent: #2D5A3D;
    --accent-light: #EAF2EC;
    --accent-muted: #7FA98B;
    --danger: #C0392B;
    --danger-light: #FDECEA;
    --amber: #B8860B;
    --amber-light: #FDF8E1;
  }
  body {
    background: var(--bg);
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    color: var(--text-primary);
    min-height: 100vh;
  }
  input, textarea, select {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    color: var(--text-primary);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    width: 100%;
    outline: none;
    transition: border-color 0.15s;
  }
  input:focus, textarea:focus { border-color: var(--accent-muted); }
  button { cursor: pointer; font-family: 'DM Sans', sans-serif; border: none; }
  * { -webkit-font-smoothing: antialiased; }

  @media (max-width: 768px) {
    .admin-layout { flex-direction: column !important; }
    .sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid var(--border) !important; flex-direction: row !important; align-items: center !important; padding: 12px 16px !important; flex-wrap: wrap; gap: 8px; }
    .sidebar-title { display: none !important; }
    .sidebar-nav { flex-direction: row !important; gap: 4px !important; padding: 0 !important; }
    .sidebar-nav-item { padding: 6px 12px !important; }
    .sidebar-bottom { display: none !important; }
    .stats-grid { grid-template-columns: 1fr 1fr !important; }
    .calendar-grid { flex-direction: column !important; }
  }
`;

// ── Shared UI Primitives ──────────────────────────────────────────────────────
const s = {
  label: { fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8, display: "block", fontWeight: 500 },
  error: { fontSize: 13, color: "var(--danger)", marginTop: 4 },
  input: { marginBottom: 0 },
  section: { display: "flex", flexDirection: "column", gap: 12 },
};

function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={s.error}>{msg}</div>;
}

// ── Calendar ──────────────────────────────────────────────────────────────────
function MonthCalendar({ year, month, selected, onToggle }) {
  const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Shift to Mon-first
  const startOffset = (firstDay + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ flex: "1 1 220px" }}>
      <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12, textAlign: "center" }}>{monthName} {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 34px)", gap: 2, justifyContent: "center" }}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => (
          <div key={d} style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", height: 34, display: "flex", alignItems: "center", justifyContent: "center" }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const sel = selected.includes(iso);
          return (
            <div
              key={iso}
              onClick={() => onToggle(iso)}
              style={{
                width: 34, height: 34, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, cursor: "pointer", fontWeight: sel ? 500 : 400,
                background: sel ? "var(--danger-light)" : "transparent",
                color: sel ? "var(--danger)" : "var(--text-primary)",
                transition: "background 0.1s",
                userSelect: "none",
              }}
              onMouseEnter={e => { if (!sel) e.currentTarget.style.background = "var(--border)"; }}
              onMouseLeave={e => { if (!sel) e.currentTarget.style.background = "transparent"; }}
            >
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Student Form ──────────────────────────────────────────────────────────────
function StudentForm({ onAdminLink }) {
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [leaveDays, setLeaveDays] = useState([]);
  const [contributions, setContributions] = useState("");
  const [pitchedBefore, setPitchedBefore] = useState(false);
  const [pitchNotes, setPitchNotes] = useState("");
  const [pitchedSectors, setPitchedSectors] = useState([]);
  const [preferences, setPreferences] = useState({}); // { projectId: rank }
  const [availNote, setAvailNote] = useState("");
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const projects = getLS("projects", DEFAULT_PROJECTS);
  const sectorOptions = [...new Set(projects.map(p => p.sector).filter(Boolean))];

  const toggleLeave = (iso) => {
    setLeaveDays(prev => prev.includes(iso) ? prev.filter(d => d !== iso) : [...prev, iso]);
  };

  const setRank = (projectId, rank) => {
    setPreferences(prev => {
      const next = { ...prev };
      // Remove this rank from any other project
      for (const pid in next) if (next[pid] === rank && pid !== projectId) delete next[pid];
      if (next[projectId] === rank) delete next[projectId]; // toggle off
      else next[projectId] = rank;
      return next;
    });
  };

  const toggleSector = (sector) => {
    setPitchedSectors(prev => (
      prev.includes(sector) ? prev.filter(s => s !== sector) : [...prev, sector]
    ));
  };

  const validate = () => {
    const e = {};
    if (!name.trim()) e.name = "Full name is required.";
    if (!studentId.trim()) e.studentId = "Student ID is required.";
    if (!email.trim() || !email.includes("@")) e.email = "A valid email is required.";
    if (!mobile.trim()) e.mobile = "Mobile number is required.";
    if (!contributions.trim()) e.contributions = "Please describe your contributions.";
    if (Object.keys(preferences).length === 0) e.preferences = "Please rank at least one project.";
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const prefs = Object.entries(preferences)
      .map(([projectId, rank]) => ({ projectId, rank }))
      .sort((a, b) => a.rank - b.rank);
    const entry = {
      id: uuid(), name: name.trim(), studentId: studentId.trim(), email: email.trim(), mobile: mobile.trim(),
      leaveDays, contributions: contributions.trim(),
      pitchedBefore,
      pitchNotes: pitchNotes.trim(),
      pitchedSectors,
      preferences: prefs, availabilityNote: availNote.trim(),
      submittedAt: new Date().toISOString(),
    };
    const existing = getLS("allocations", []);
    setLS("allocations", [...existing, entry]);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12, padding: 24 }}>
        <div style={{ fontSize: 48, color: "var(--accent)" }}>✓</div>
        <div style={{ fontSize: 18, fontWeight: 300 }}>Application received.</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>You can close this window.</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "48px 24px 80px", position: "relative" }}>
      <img
        src={logoUrl}
        alt="SoFI"
        style={{ position: "absolute", top: 18, left: 20, height: 28, width: "auto" }}
      />
      <div style={{ maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32 }}>
        {/* Header */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoUrl} alt="SoFI" style={{ height: 24, width: "auto" }} />
            <h1 style={{ fontSize: 24, fontWeight: 300, color: "var(--text-primary)" }}>Summer Allocations</h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>Submit your availability and project preferences.</p>
        </div>

        {/* Section 1 — Identity */}
        <div style={s.section}>
          <span style={s.label}>Identity</span>
          <div>
            <input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} style={s.input} />
            <FieldError msg={errors.name} />
          </div>
          <div>
            <input placeholder="Student ID" value={studentId} onChange={e => setStudentId(e.target.value)} style={s.input} />
            <FieldError msg={errors.studentId} />
          </div>
          <div>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={s.input} />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <input
              type="tel"
              placeholder="Mobile Number"
              value={mobile}
              onChange={e => setMobile(e.target.value)}
              style={s.input}
            />
            <FieldError msg={errors.mobile} />
          </div>
        </div>

        {/* Section 2 — Leave Days */}
        <div style={s.section}>
          <span style={s.label}>Leave Days</span>
          <div className="calendar-grid" style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <MonthCalendar year={2025} month={5} selected={leaveDays} onToggle={toggleLeave} />
            <MonthCalendar year={2025} month={6} selected={leaveDays} onToggle={toggleLeave} />
          </div>
          {leaveDays.length > 0 && (
            <div style={{ fontSize: 13, color: "var(--accent)" }}>{leaveDays.length} day{leaveDays.length !== 1 ? "s" : ""} selected</div>
          )}
        </div>

        {/* Section 3 — Past Contributions */}
        <div style={s.section}>
          <span style={s.label}>Past Contributions</span>
          <div>
            <textarea
              rows={4}
              placeholder="Briefly describe your contributions from the previous semester — projects worked on and key outcomes."
              value={contributions}
              onChange={e => setContributions(e.target.value)}
              style={{ ...s.input, resize: "vertical" }}
            />
            <FieldError msg={errors.contributions} />
          </div>
        </div>

        {/* Section 4 — Stock Pitches */}
        <div style={s.section}>
          <span style={s.label}>Stock Pitches (Optional)</span>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={pitchedBefore}
              onChange={(e) => {
                const next = e.target.checked;
                setPitchedBefore(next);
                if (!next) {
                  setPitchNotes("");
                  setPitchedSectors([]);
                }
              }}
              style={{ width: 16, height: 16 }}
            />
            I have pitched a stock before
          </label>

          {pitchedBefore && (
            <>
              <textarea
                rows={3}
                placeholder="Share the company name, ticker, and a short summary of your pitch (optional)."
                value={pitchNotes}
                onChange={e => setPitchNotes(e.target.value)}
                style={{ ...s.input, resize: "vertical" }}
              />
              {sectorOptions.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>
                    Pitched Sectors
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {sectorOptions.map(sector => (
                      <button
                        key={sector}
                        type="button"
                        onClick={() => toggleSector(sector)}
                        style={{
                          padding: "6px 12px", fontSize: 12, borderRadius: 16, fontWeight: 500,
                          background: pitchedSectors.includes(sector) ? "var(--accent-light)" : "var(--surface)",
                          border: `1px solid ${pitchedSectors.includes(sector) ? "var(--accent)" : "var(--border)"}`,
                          color: pitchedSectors.includes(sector) ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >{sector}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Section 5 — Project Preferences */}
        <div style={s.section}>
          <span style={s.label}>Rank your top 3 project choices</span>
          <FieldError msg={errors.preferences} />
          {pitchedBefore && pitchedSectors.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--accent)", marginTop: -6 }}>
              Recommended based on your pitched sectors: {projects
                .filter(p => pitchedSectors.includes(p.sector))
                .map(p => p.name)
                .join(", ") || "No matching projects yet."}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {projects.map(p => {
              const ranked = preferences[p.id];
              const recommended = pitchedBefore && pitchedSectors.includes(p.sector);
              return (
                <div
                  key={p.id}
                  style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
                    padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    borderLeft: ranked ? "3px solid var(--accent)" : "1px solid var(--border)",
                    transition: "border 0.15s",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{p.name}</span>
                      {recommended && (
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: "var(--accent-light)", color: "var(--accent)", fontWeight: 500 }}>
                          Recommended
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{p.description}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {[1, 2, 3].map(rank => (
                      <button
                        key={rank}
                        onClick={() => setRank(p.id, rank)}
                        style={{
                          width: 28, height: 28, borderRadius: 6, fontSize: 13, fontWeight: 500,
                          background: ranked === rank ? "var(--accent)" : "var(--surface)",
                          border: `1px solid ${ranked === rank ? "var(--accent)" : "var(--border)"}`,
                          color: ranked === rank ? "#fff" : "var(--text-secondary)",
                          transition: "all 0.15s",
                        }}
                      >{rank}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 6 — Availability Note */}
        <div style={s.section}>
          <span style={s.label}>Availability Note</span>
          <input
            placeholder="Any constraints we should know about? (optional)"
            value={availNote}
            onChange={e => setAvailNote(e.target.value)}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          style={{
            width: "100%", height: 48, background: "var(--accent)", color: "#fff",
            fontSize: 15, fontWeight: 500, borderRadius: 8, transition: "opacity 0.15s",
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = "0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity = "1"}
        >
          Submit Application
        </button>
      </div>

      {/* Admin link */}
      <button
        onClick={onAdminLink}
        style={{
          position: "fixed", bottom: 20, right: 24, fontSize: 13,
          color: "var(--text-muted)", background: "none", textDecoration: "underline",
        }}
      >Admin</button>
    </div>
  );
}

// ── Admin Login ───────────────────────────────────────────────────────────────
function AdminLogin({ onSuccess, onBack }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!supabase) {
      setError("Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
      if (authErr || !data?.user) throw new Error("Invalid credentials.");
      const allowed = await isAdminUser(data.user);
      if (!allowed) throw new Error("Access denied.");
      onSuccess();
    } catch (err) {
      setError(err?.message || "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
        padding: 40, width: "100%", maxWidth: 360,
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 24 }}>Admin Access</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()} />
          {error && <div style={s.error}>{error}</div>}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              height: 44, background: "var(--accent)", color: "#fff",
              fontSize: 15, fontWeight: 500, borderRadius: 8, marginTop: 4,
              opacity: loading ? 0.7 : 1,
            }}
          >{loading ? "Signing in..." : "Sign in"}</button>
        </div>
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <button onClick={onBack} style={{ fontSize: 13, color: "var(--text-muted)", background: "none" }}>← Back</button>
        </div>
      </div>
    </div>
  );
}

// ── Admin Dashboard ───────────────────────────────────────────────────────────
function AdminDashboard({ onSignOut }) {
  const [panel, setPanel] = useState("Overview");
  const [allocations, setAllocations] = useState(() => getLS("allocations", []));
  const [projectAllocations, setProjectAllocations] = useState(() => getLS("projectAllocations", {}));
  const [projects, setProjects] = useState(() => getLS("projects", DEFAULT_PROJECTS));

  const refreshData = () => {
    setAllocations(getLS("allocations", []));
    setProjectAllocations(getLS("projectAllocations", {}));
    setProjects(getLS("projects", DEFAULT_PROJECTS));
  };

  useEffect(() => { refreshData(); }, [panel]);

  const saveProjects = (updated) => {
    setProjects(updated);
    setLS("projects", updated);
  };

  const moveStudent = (studentId, projectId) => {
    const next = { ...projectAllocations };
    if (!projectId) delete next[studentId];
    else next[studentId] = projectId;
    setLS("projectAllocations", next);
    setProjectAllocations(next);
  };

  // ── Allocation Algorithm (v2) ─────────────────────────────────────────────
  //
  // Goals:
  //   1. Every project gets a balanced spread of availability (no clustering
  //      of all high-availability students in one project).
  //   2. If a student pitched a stock in a sector and a matching project exists,
  //      prioritize allocating them to that sector.
  //   3. Student preferences are respected as much as possible.
  //   4. Every student is allocated — no one left out as long as slots exist.
  //
  // Approach — three-phase balanced assignment:
  //
  //   Phase 1 — Sector match pass:
  //     For each student who pitched a sector, allocate them to the highest
  //     ranked project in that sector (or any open project in that sector if
  //     they did not rank it).
  //
  //   Phase 2 — Balanced fill pass (round-robin style):
  //     Sort remaining unallocated students by availability descending.
  //     Use a "balance score" per project that penalises projects whose
  //     current average availability is already high. In each round, assign
  //     the next student to their most-preferred project that still has
  //     open slots AND currently has the lowest average availability among
  //     their ranked choices — spreading high and low availability students
  //     across all projects.
  //
  //   Phase 3 — Fallback for unranked / overflow students:
  //     Any student still unallocated (ranked projects full, or didn't rank
  //     enough) gets placed in the project with the most open slots whose
  //     current average availability is lowest — ensuring balance is
  //     maintained even for forced placements.
  //
  const runAllocation = () => {
    // ── Setup ────────────────────────────────────────────────────────────────
    const newAlloc = { ...projectAllocations };
    const slots = {};
    projects.forEach(p => { slots[p.id] = p.slots; });
    // Deduct slots already consumed by prior allocations
    Object.values(newAlloc).forEach(pid => { if (slots[pid] !== undefined) slots[pid] = Math.max(0, slots[pid] - 1); });

    // Track which students are in each project (for avg-availability calc)
    const projectMembers = {}; // { pid: [studentId, ...] }
    projects.forEach(p => { projectMembers[p.id] = []; });
    Object.entries(newAlloc).forEach(([sid, pid]) => { if (projectMembers[pid]) projectMembers[pid].push(sid); });

    // Index students by studentId for fast lookup
    const studentById = {};
    allocations.forEach(s => { studentById[s.studentId] = s; });

    const unallocated = allocations.filter(s => !newAlloc[s.studentId]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const availPct = (s) => (TOTAL_VACATION_DAYS - s.leaveDays.length) / TOTAL_VACATION_DAYS; // 0–1

    const projectSectorById = {};
    projects.forEach(p => { projectSectorById[p.id] = (p.sector || "").trim(); });

    const matchesSector = (student, pid) => {
      const sector = projectSectorById[pid];
      const pitched = Array.isArray(student.pitchedSectors) ? student.pitchedSectors : [];
      return !!sector && pitched.includes(sector);
    };

    // Average availability of current members in a project (0 if empty)
    const avgAvail = (pid) => {
      const members = projectMembers[pid];
      if (!members.length) return 0;
      return members.reduce((sum, sid) => sum + (studentById[sid] ? availPct(studentById[sid]) : 0), 0) / members.length;
    };

    const allocate = (student, pid) => {
      newAlloc[student.studentId] = pid;
      slots[pid]--;
      projectMembers[pid].push(student.studentId);
    };

    // ── Phase 1: Sector match pass ───────────────────────────────────────────
    // If a student pitched a sector, place them in a matching project first.
    const stillUnalloc1 = [...unallocated];

    for (const student of stillUnalloc1) {
      if (newAlloc[student.studentId]) continue;
      const pitched = Array.isArray(student.pitchedSectors) ? student.pitchedSectors : [];
      if (!pitched.length) continue;

      const rankedMatches = student.preferences
        .filter(p => slots[p.projectId] > 0 && matchesSector(student, p.projectId))
        .sort((a, b) => a.rank - b.rank);

      if (rankedMatches.length) {
        allocate(student, rankedMatches[0].projectId);
        continue;
      }

      const openSectorProjects = projects.filter(p => slots[p.id] > 0 && matchesSector(student, p.id));
      if (!openSectorProjects.length) continue;

      openSectorProjects.sort((a, b) => avgAvail(a.id) - avgAvail(b.id));
      allocate(student, openSectorProjects[0].id);
    }

    // ── Phase 2: Balanced fill pass ──────────────────────────────────────────
    // Sort remaining students by availability descending (high-availability
    // students are harder to balance, assign them first).
    const remaining2 = unallocated.filter(s => !newAlloc[s.studentId]);
    remaining2.sort((a, b) => availPct(b) - availPct(a));

    for (const student of remaining2) {
      if (newAlloc[student.studentId]) continue;

      // Get this student's ranked projects that still have slots
      const rankedWithSlots = student.preferences
        .filter(p => slots[p.projectId] > 0)
        .sort((a, b) => a.rank - b.rank); // rank 1 first

      if (!rankedWithSlots.length) continue; // handled in phase 3

      // Among their ranked choices, prefer the project with the LOWEST
      // current average availability — this spreads high-availability
      // students to less-covered projects.
      // But don't stray too far from preference: weight both factors.
      // preference penalty: rank 1=0, rank 2=0.1, rank 3=0.2
      // balance bonus: lower avg avail = better (we want to fill it up)
      const scored = rankedWithSlots.map(p => ({
        pid: p.projectId,
        score: avgAvail(p.projectId) + (p.rank - 1) * 0.15,
      }));
      scored.sort((a, b) => a.score - b.score); // lowest score = best fit

      allocate(student, scored[0].pid);
    }

    // ── Phase 3: Fallback for unranked / overflow students ───────────────────
    const remaining3 = unallocated.filter(s => !newAlloc[s.studentId]);
    // Sort by availability desc so we can balance as we go
    remaining3.sort((a, b) => availPct(b) - availPct(a));

    for (const student of remaining3) {
      const openProjects = projects.filter(p => slots[p.id] > 0);
      if (!openProjects.length) break; // no slots left anywhere

      // Assign to the open project with the lowest current avg availability
      // (so this student — who might be high-availability — balances it out)
      openProjects.sort((a, b) => avgAvail(a.id) - avgAvail(b.id));
      allocate(student, openProjects[0].id);
    }

    setLS("projectAllocations", newAlloc);
    setProjectAllocations(newAlloc);
  };

  const navItems = ["Overview", "Students", "Allocations", "Projects"];

  return (
    <div className="admin-layout" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <div className="sidebar" style={{
        width: 240, background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        <div className="sidebar-title" style={{ fontSize: 15, fontWeight: 500, padding: "24px 24px 16px" }}>
          Summer Allocations
        </div>
        <div className="sidebar-nav" style={{ display: "flex", flexDirection: "column", flex: 1, padding: "8px 0" }}>
          {navItems.map(item => (
            <button
              key={item}
              onClick={() => setPanel(item)}
              style={{
                height: 40, padding: "0 16px", textAlign: "left", fontSize: 13,
                background: panel === item ? "var(--accent-light)" : "transparent",
                color: panel === item ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: panel === item ? 500 : 400,
                borderRadius: 6, margin: "0 8px",
                transition: "all 0.15s",
              }}
            >{item}</button>
          ))}
        </div>
        <div className="sidebar-bottom" style={{ padding: "16px 24px 24px" }}>
          <button
            onClick={onSignOut}
            style={{ fontSize: 13, color: "var(--text-muted)", background: "none" }}
          >Sign out</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: 40, minWidth: 0 }}>
        {panel === "Overview" && <OverviewPanel allocations={allocations} projectAllocations={projectAllocations} projects={projects} />}
        {panel === "Students" && <StudentsPanel allocations={allocations} projectAllocations={projectAllocations} projects={projects} />}
        {panel === "Allocations" && (
          <AllocationsPanel
            allocations={allocations}
            projectAllocations={projectAllocations}
            projects={projects}
            onRun={runAllocation}
            onMoveStudent={moveStudent}
          />
        )}
        {panel === "Projects" && <ProjectsPanel projects={projects} onSave={saveProjects} />}
      </div>
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────────────────────
function OverviewPanel({ allocations, projectAllocations, projects }) {
  const totalApplicants = allocations.length;
  const totalLeaveDays = allocations.reduce((s, a) => s + a.leaveDays.length, 0);
  const projectsCovered = projects.filter(p =>
    allocations.some(a => a.preferences.some(pref => pref.projectId === p.id))
  ).length;
  const unallocated = allocations.filter(a => !projectAllocations[a.studentId]).length;

  const stats = [
    { label: "Total Applicants", value: totalApplicants },
    { label: "Total Leave Days", value: totalLeaveDays },
    { label: "Projects Covered", value: `${projectsCovered}/${projects.length}` },
    { label: "Unallocated", value: unallocated },
  ];

  const recent = [...allocations].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)).slice(0, 5);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 300, marginBottom: 32 }}>Overview</h2>
      <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
        {stats.map(st => (
          <div key={st.label} style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "20px 24px",
          }}>
            <div style={{ fontSize: 28, fontWeight: 300 }}>{st.value}</div>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 4 }}>{st.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontSize: 15, fontWeight: 500 }}>Recent Submissions</div>
        {recent.length === 0 ? (
          <div style={{ padding: 24, fontSize: 15, color: "var(--text-muted)", textAlign: "center" }}>No submissions yet.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "Student ID", "Submitted", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", textAlign: "left", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((a, i) => {
                const allocated = !!projectAllocations[a.studentId];
                return (
                  <tr key={a.id} style={{ borderBottom: i < recent.length - 1 ? "1px solid var(--border)" : "none", height: 44 }}>
                    <td style={{ padding: "0 20px", fontSize: 13 }}>{a.name}</td>
                    <td style={{ padding: "0 20px", fontSize: 13, fontFamily: "DM Mono", color: "var(--text-muted)" }}>{a.studentId}</td>
                    <td style={{ padding: "0 20px", fontSize: 13, color: "var(--text-muted)" }}>
                      {new Date(a.submittedAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: "0 20px" }}>
                      <span style={{
                        fontSize: 12, padding: "3px 10px", borderRadius: 20,
                        background: allocated ? "var(--accent-light)" : "var(--amber-light)",
                        color: allocated ? "var(--accent)" : "var(--amber)",
                        fontWeight: 500,
                      }}>{allocated ? "Allocated" : "Pending"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Students Panel ─────────────────────────────────────────────────────────────
function StudentsPanel({ allocations, projectAllocations, projects }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState({});

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allocations.filter(a =>
      a.name.toLowerCase().includes(q) || a.studentId.toLowerCase().includes(q)
    );
  }, [allocations, search]);

  const getProjectName = (id) => projects.find(p => p.id === id)?.name || id;
  const availPct = (a) => Math.round(((TOTAL_VACATION_DAYS - a.leaveDays.length) / TOTAL_VACATION_DAYS) * 100);

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 300, marginBottom: 24 }}>Students</h2>
      <input
        placeholder="Search by name or student ID…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 20, maxWidth: 400 }}
      />
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, fontSize: 15, color: "var(--text-muted)", textAlign: "center" }}>
            {allocations.length === 0 ? "No students yet." : "No results."}
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Name", "Student ID", "Leave", "Availability", "Top Choice", ""].map((h, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => {
                const pct = availPct(a);
                const topChoice = a.preferences.find(p => p.rank === 1);
                const isExp = expanded[a.id];
                return (
                  <>
                    <tr
                      key={a.id}
                      style={{ borderBottom: "1px solid var(--border)", height: 52, verticalAlign: "middle" }}
                    >
                      <td style={{ padding: "0 16px", fontSize: 15, fontWeight: 500 }}>{a.name}</td>
                      <td style={{ padding: "0 16px", fontSize: 13, fontFamily: "DM Mono", color: "var(--text-muted)" }}>{a.studentId}</td>
                      <td style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)" }}>
                        {a.leaveDays.length} days
                      </td>
                      <td style={{ padding: "0 16px" }}>
                        <div style={{ fontSize: 13, marginBottom: 4 }}>{pct}%</div>
                        <div style={{ width: 80, height: 3, background: "var(--border)", borderRadius: 2 }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
                        </div>
                      </td>
                      <td style={{ padding: "0 16px", fontSize: 13, color: "var(--text-muted)", maxWidth: 140 }}>
                        {topChoice ? getProjectName(topChoice.projectId) : "—"}
                      </td>
                      <td style={{ padding: "0 16px" }}>
                        <button
                          onClick={() => setExpanded(prev => ({ ...prev, [a.id]: !prev[a.id] }))}
                          style={{ fontSize: 13, color: "var(--accent)", background: "none" }}
                        >{isExp ? "Hide" : "View"}</button>
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${a.id}-exp`} style={{ background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={6} style={{ padding: "16px 20px" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                            <div>
                              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Contributions</div>
                              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{a.contributions}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6 }}>Ranked Projects</div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                {a.preferences.map(p => (
                                  <div key={p.projectId} style={{ fontSize: 13, display: "flex", gap: 8 }}>
                                    <span style={{ fontWeight: 500, color: "var(--accent)", minWidth: 16 }}>#{p.rank}</span>
                                    <span>{getProjectName(p.projectId)}</span>
                                  </div>
                                ))}
                              </div>
                              {Array.isArray(a.pitchedSectors) && a.pitchedSectors.length > 0 && (
                                <>
                                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, marginTop: 12 }}>Pitched Sectors</div>
                                  <div style={{ fontSize: 13 }}>{a.pitchedSectors.join(", ")}</div>
                                </>
                              )}
                              {a.pitchNotes && (
                                <>
                                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, marginTop: 12 }}>Stock Pitch Notes</div>
                                  <div style={{ fontSize: 13 }}>{a.pitchNotes}</div>
                                </>
                              )}
                              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, marginTop: 12 }}>Leave Days</div>
                              <div style={{ fontSize: 13 }}>{dateRanges(a.leaveDays)}</div>
                              {a.availabilityNote && (
                                <>
                                  <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)", marginBottom: 6, marginTop: 12 }}>Note</div>
                                  <div style={{ fontSize: 13 }}>{a.availabilityNote}</div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Allocations Panel ─────────────────────────────────────────────────────────
function AllocationsPanel({ allocations, projectAllocations, projects, onRun, onMoveStudent }) {
  const hasAllocations = Object.keys(projectAllocations).length > 0;
  const [moveError, setMoveError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const getStudentsForProject = (projectId) =>
    allocations.filter(a => projectAllocations[a.studentId] === projectId);

  const availPct = (a) => Math.round(((TOTAL_VACATION_DAYS - a.leaveDays.length) / TOTAL_VACATION_DAYS) * 100);

  const prefLabel = (student, projectId) => {
    const p = student.preferences.find(p => p.projectId === projectId);
    if (!p) return { label: "Fallback", bg: "var(--amber-light)", color: "var(--amber)" };
    return {
      label: `Choice #${p.rank}`,
      bg: p.rank === 1 ? "var(--accent-light)" : p.rank === 2 ? "#EEF2FF" : "#F5F0FF",
      color: p.rank === 1 ? "var(--accent)" : p.rank === 2 ? "#4F5BD5" : "#7C4DBC",
    };
  };

  const allocationNote = (student, projectId) => {
    const sector = projects.find(p => p.id === projectId)?.sector;
    const pitched = Array.isArray(student.pitchedSectors) ? student.pitchedSectors : [];
    if (sector && pitched.includes(sector)) return "Sector match";
    const p = student.preferences.find(pref => pref.projectId === projectId);
    if (!p) return "Fallback placement";
    return `Ranked choice #${p.rank}`;
  };

  const filledByProject = useMemo(() => {
    const counts = {};
    projects.forEach(p => { counts[p.id] = 0; });
    Object.values(projectAllocations).forEach(pid => {
      if (counts[pid] !== undefined) counts[pid] += 1;
    });
    return counts;
  }, [projectAllocations, projects]);

  const handleMove = (studentId, fromProjectId, toProjectId) => {
    setMoveError("");
    if (toProjectId && toProjectId !== fromProjectId) {
      const target = projects.find(p => p.id === toProjectId);
      if (target && filledByProject[toProjectId] >= target.slots) {
        setMoveError(`${target.name} is already full.`);
        return;
      }
    }
    onMoveStudent(studentId, toProjectId || "");
  };

  const buildWhatsAppText = () => {
    const lines = ["Summer Allocations"]; 
    projects.forEach(p => {
      const members = allocations.filter(a => projectAllocations[a.studentId] === p.id);
      lines.push("");
      lines.push(`${p.name} (${members.length}/${p.slots})`);
      if (members.length === 0) {
        lines.push("- Open slot");
      } else {
        members.forEach(m => lines.push(`- ${m.name} (${m.studentId}) · ${m.mobile || "No mobile"}`));
      }
    });
    const unallocated = allocations.filter(a => !projectAllocations[a.studentId]);
    if (unallocated.length) {
      lines.push("");
      lines.push("Unallocated");
      unallocated.forEach(m => lines.push(`- ${m.name} (${m.studentId}) · ${m.mobile || "No mobile"}`));
    }
    return lines.join("\n");
  };

  const copyWhatsAppSummary = async () => {
    const text = buildWhatsAppText();
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("Copied to clipboard.");
    } catch {
      setCopyStatus("Copy failed. Select and copy from the preview below.");
    }
  };

  // Summary stats across all projects
  const totalSlots = projects.reduce((s, p) => s + p.slots, 0);
  const totalFilled = Object.keys(projectAllocations).length;
  const allAvailPcts = allocations.filter(a => projectAllocations[a.studentId]).map(availPct);
  const globalAvgAvail = allAvailPcts.length
    ? Math.round(allAvailPcts.reduce((s, v) => s + v, 0) / allAvailPcts.length)
    : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: hasAllocations ? 20 : 32, gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 24, fontWeight: 300 }}>Project Allocations</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={copyWhatsAppSummary}
            style={{ padding: "8px 16px", background: "var(--surface)", color: "var(--text-secondary)", fontSize: 13, fontWeight: 500, borderRadius: 8, border: "1px solid var(--border)" }}
          >Copy WhatsApp Summary</button>
          <button
            onClick={onRun}
            style={{ padding: "8px 20px", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, borderRadius: 8 }}
          >{hasAllocations ? "Re-run Allocation" : "Run Allocation"}</button>
        </div>
      </div>
      {moveError && <div style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12 }}>{moveError}</div>}
      {copyStatus && <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 12 }}>{copyStatus}</div>}

      {!hasAllocations ? (
        <div style={{ textAlign: "center", padding: "80px 0" }}>
          <div style={{ fontSize: 15, color: "var(--text-muted)", marginBottom: 8 }}>No allocations yet.</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            The algorithm will balance availability and experience across all projects.
          </div>
          <button
            onClick={onRun}
            style={{ padding: "10px 24px", background: "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 500, borderRadius: 8 }}
          >Run Allocation</button>
        </div>
      ) : (
        <>
          {/* Summary bar */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12,
            padding: "14px 20px", marginBottom: 20, display: "flex", gap: 32, flexWrap: "wrap",
          }}>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>Filled</span>
              <span style={{ fontSize: 15, fontWeight: 500, marginLeft: 10 }}>{totalFilled} / {totalSlots} slots</span>
            </div>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>Avg availability</span>
              <span style={{ fontSize: 15, fontWeight: 500, marginLeft: 10 }}>{globalAvgAvail}%</span>
            </div>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>Unallocated</span>
              <span style={{ fontSize: 15, fontWeight: 500, marginLeft: 10 }}>
                {allocations.length - totalFilled} student{allocations.length - totalFilled !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {projects.map(p => {
              const members = getStudentsForProject(p.id);
              const filled = members.length;
              const empty = Math.max(0, p.slots - filled);
              const projectAvgAvail = members.length
                ? Math.round(members.reduce((s, a) => s + availPct(a), 0) / members.length)
                : null;
              // Availability balance bar: show how this project's avg compares globally
              const balancePct = globalAvgAvail > 0 && projectAvgAvail !== null
                ? Math.round((projectAvgAvail / globalAvgAvail) * 50) // centre at 50
                : 50;

              return (
                <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 15, fontWeight: 500 }}>{p.name}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      {projectAvgAvail !== null && (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Avg avail</span>
                          <span style={{ fontSize: 13, fontWeight: 500, color: projectAvgAvail >= globalAvgAvail ? "var(--accent)" : "var(--amber)" }}>
                            {projectAvgAvail}%
                          </span>
                          {/* mini balance indicator */}
                          <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, position: "relative" }}>
                            <div style={{
                              position: "absolute", left: `${Math.min(Math.max(balancePct, 0), 100)}%`,
                              transform: "translateX(-50%)", top: 0,
                              width: 6, height: 4, borderRadius: 2,
                              background: projectAvgAvail >= globalAvgAvail ? "var(--accent)" : "var(--amber)",
                            }} />
                          </div>
                        </div>
                      )}
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{filled}/{p.slots} filled</span>
                    </div>
                  </div>

                  {/* Student rows */}
                  <div>
                    {members.map((a, idx) => {
                      const pref = prefLabel(a, p.id);
                      const pct = availPct(a);
                      return (
                        <div
                          key={a.id}
                          style={{
                            padding: "11px 20px",
                            borderBottom: idx < members.length - 1 || empty > 0 ? "1px solid var(--border)" : "none",
                            display: "flex", alignItems: "center", gap: 12,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ fontSize: 13 }}>{a.name}</span>
                            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                              {allocationNote(a, p.id)}
                            </span>
                            <select
                              value={projectAllocations[a.studentId] || ""}
                              onChange={(e) => handleMove(a.studentId, p.id, e.target.value)}
                              style={{ width: 160, fontSize: 12, padding: "4px 8px" }}
                            >
                              <option value="">Unassigned</option>
                              {projects.map(pr => (
                                <option key={pr.id} value={pr.id}>{pr.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Availability bar */}
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 12, color: "var(--text-muted)", minWidth: 32, textAlign: "right" }}>{pct}%</span>
                            <div style={{ width: 52, height: 3, background: "var(--border)", borderRadius: 2 }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", borderRadius: 2 }} />
                            </div>
                          </div>

                          {/* Preference badge */}
                          <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, background: pref.bg, color: pref.color, fontWeight: 500, flexShrink: 0 }}>
                            {pref.label}
                          </span>
                        </div>
                      );
                    })}

                    {/* Empty slots */}
                    {Array.from({ length: empty }).map((_, i) => (
                      <div key={i} style={{
                        padding: "11px 20px",
                        borderBottom: i < empty - 1 ? "1px solid var(--border)" : "none",
                        fontSize: 13, color: "var(--text-muted)",
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--border)" }} />
                        <span style={{ fontStyle: "italic" }}>Open slot</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* WhatsApp summary preview */}
          <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }}>
            <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: 8 }}>WhatsApp summary preview</div>
            <textarea
              readOnly
              value={buildWhatsAppText()}
              rows={8}
              style={{ width: "100%", fontSize: 12, fontFamily: "DM Mono", resize: "vertical" }}
            />
          </div>

          {/* Legend */}
          <div style={{ marginTop: 20, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, display: "flex", gap: 20, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Sector match = student pitched a stock in this sector</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Choice # = student's original preference rank · Fallback = placed outside ranked choices</span>
          </div>
        </>
      )}
    </div>
  );
}

// ── Projects Panel ─────────────────────────────────────────────────────────────
function ProjectsPanel({ projects, onSave }) {
  const [editing, setEditing] = useState({});

  const updateProject = (id, field, value) => {
    onSave(projects.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addProject = () => {
    onSave([...projects, { id: uuid(), name: "New Project", description: "Project description.", slots: 2, sector: "" }]);
  };

  return (
    <div>
      <h2 style={{ fontSize: 24, fontWeight: 300, marginBottom: 32 }}>Projects</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {projects.map(p => (
          <div key={p.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                {editing[`${p.id}-name`] ? (
                  <input
                    autoFocus
                    defaultValue={p.name}
                    onBlur={e => { updateProject(p.id, "name", e.target.value); setEditing(prev => ({ ...prev, [`${p.id}-name`]: false })); }}
                    style={{ fontSize: 15, fontWeight: 500, marginBottom: 8 }}
                  />
                ) : (
                  <div
                    onClick={() => setEditing(prev => ({ ...prev, [`${p.id}-name`]: true }))}
                    style={{ fontSize: 15, fontWeight: 500, marginBottom: 6, cursor: "text", padding: "2px 0" }}
                    title="Click to edit"
                  >{p.name}</div>
                )}
                {editing[`${p.id}-desc`] ? (
                  <input
                    autoFocus
                    defaultValue={p.description}
                    onBlur={e => { updateProject(p.id, "description", e.target.value); setEditing(prev => ({ ...prev, [`${p.id}-desc`]: false })); }}
                    style={{ fontSize: 13, color: "var(--text-muted)" }}
                  />
                ) : (
                  <div
                    onClick={() => setEditing(prev => ({ ...prev, [`${p.id}-desc`]: true }))}
                    style={{ fontSize: 13, color: "var(--text-muted)", cursor: "text", padding: "2px 0" }}
                    title="Click to edit"
                  >{p.description}</div>
                )}
                {editing[`${p.id}-sector`] ? (
                  <input
                    autoFocus
                    defaultValue={p.sector || ""}
                    onBlur={e => { updateProject(p.id, "sector", e.target.value); setEditing(prev => ({ ...prev, [`${p.id}-sector`]: false })); }}
                    style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}
                  />
                ) : (
                  <div
                    onClick={() => setEditing(prev => ({ ...prev, [`${p.id}-sector`]: true }))}
                    style={{ fontSize: 12, color: "var(--text-muted)", cursor: "text", padding: "2px 0", marginTop: 4 }}
                    title="Click to edit"
                  >{p.sector ? `Sector: ${p.sector}` : "Sector: Not set"}</div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Slots</span>
                <input
                  type="number"
                  min={1}
                  value={p.slots}
                  onChange={e => updateProject(p.id, "slots", parseInt(e.target.value) || 1)}
                  style={{ width: 56, textAlign: "center", fontSize: 15, fontWeight: 500 }}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          onClick={addProject}
          style={{
            padding: "10px 0", fontSize: 13, color: "var(--accent)", background: "transparent",
            border: "1px dashed var(--accent-muted)", borderRadius: 8, textAlign: "center",
          }}
        >+ Add Project</button>
      </div>
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("student");
  const [adminAuth, setAdminAuth] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    let authSubscription;
    const init = async () => {
      if (!supabase) { setAuthReady(true); return; }
      const { data } = await supabase.auth.getSession();
      const session = data?.session || null;
      if (session?.user) {
        const allowed = await isAdminUser(session.user);
        setAdminAuth(allowed);
      } else {
        setAdminAuth(false);
      }
      setAuthReady(true);

      const { data: subData } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
        if (!nextSession?.user) {
          setAdminAuth(false);
          return;
        }
        const allowed = await isAdminUser(nextSession.user);
        setAdminAuth(allowed);
      });
      authSubscription = subData?.subscription;
    };
    init();
    return () => { if (authSubscription) authSubscription.unsubscribe(); };
  }, []);

  if (view === "student") {
    return <StudentForm onAdminLink={() => setView("admin-login")} />;
  }
  if (view === "admin-login") {
    return (
      <AdminLogin
        onSuccess={() => { setAdminAuth(true); setView("admin"); }}
        onBack={() => setView("student")}
      />
    );
  }
  if (view === "admin" && adminAuth) {
    return (
      <AdminDashboard
        onSignOut={async () => {
          if (supabase) await supabase.auth.signOut();
          setAdminAuth(false);
          setView("student");
          window.location.href = "/";
        }}
      />
    );
  }
  if (view === "admin" && authReady && !adminAuth) {
    return <AdminLogin onSuccess={() => { setAdminAuth(true); setView("admin"); }} onBack={() => setView("student")} />;
  }
  return <StudentForm onAdminLink={() => setView("admin-login")} />;
}
