"use client";
/* Native links intentionally load cached HTML for offline navigation. Artwork is locally optimized WebP. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import FullscreenTimer from "./fullscreen-timer";
import { LogPhoto } from "./log-photo";
import {
  Leaf,
  Timer,
  Clock3,
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Settings2,
  Play,
  Pause,
  Square,
  Check,
  ArrowRight,
  Sun,
  Volume2,
  Download,
  Upload,
  X,
  Sprout,
  Bell,
  ChevronRight,
  Maximize2,
} from "lucide-react";
import type { State, Checkpoint, Schedule, Phase } from "../core/model";
import {
  activate,
  changeTimezone,
  end,
  logCheckpoint,
  nextPhase,
  pause,
  reconcile,
  remaining,
  resume,
  startPhase,
  totalXP,
} from "../core/engine";
import { dayKey } from "../core/schedule";
import { transact, restore } from "../data/store";
import { parseBackup } from "../data/backup";
import { ringtones, type Ringtone } from "../core/ringtones";
import {
  alertUser,
  enableNotifications,
  setupOffline,
  unlockAudio,
  previewRingtone,
} from "../adapters/browser";

const tabs = [
  ["Focus", Timer],
  ["Check-ins", Clock3],
  ["Journal", BookOpen],
  ["Progress", ChartNoAxesColumnIncreasing],
] as const;
const phaseName = { focus: "Focus", short: "Short break", long: "Long break" };
const categories = [
  "Study",
  "Work",
  "Creative",
  "Exercise",
  "Break",
  "Away",
  "Other",
];
const countdown = (ms: number) => {
  const n = Math.ceil(ms / 1000);
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
};
const duration = (ms: number) => {
  const m = Math.floor(ms / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
function NumberField({
  label,
  value,
  onChange,
  max = 1440,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <label className="field">
      {label}
      <input
        required
        type="number"
        min="1"
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function Category({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="field">
      Category
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {categories.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </select>
    </label>
  );
}
export default function Pacana() {
  const [state, setState] = useState<State | null>(null),
    [now, setNow] = useState(0),
    [tab, setTab] = useState("Focus"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [task, setTask] = useState(""),
    [category, setCategory] = useState("Study"),
    [setup, setSetup] = useState(false),
    [fullscreen, setFullscreen] = useState(false),
    [editing, setEditing] = useState<Checkpoint | null>(null),
    [sessionId, setSessionId] = useState<string | null>(null),
    [note, setNote] = useState("");
  const [sessionPhoto, setSessionPhoto] = useState<string | undefined>();
  const [photoBusy, setPhotoBusy] = useState(false);
  const [date, setDate] = useState(""),
    [online, setOnline] = useState(true);
  const lastTick = useRef(0),
    busy = useRef(false);
  const time = (ts: number) =>
    new Intl.DateTimeFormat("en", {
      timeZone: state?.settings.timezone,
      hour: "numeric",
      minute: "2-digit",
    }).format(ts);
  const update = async (fn: (s: State) => void) => {
    try {
      unlockAudio();
      const { state: s } = await transact((s) => {
        reconcile(s, Date.now(), false);
        fn(s);
      });
      setState(s);
      setNow(Date.now);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };
  useEffect(() => {
    let live = true;
    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      const current = Date.now();
      setNow(current);
      try {
        const auto =
          document.visibilityState === "visible" &&
          lastTick.current > 0 &&
          current - lastTick.current < 2500;
        const { state: s, result } = await transact((s) =>
          reconcile(s, current, auto),
        );
        if (live) {
          setState(s);
          if (result.completed || result.checkpoints) {
            const text = result.completed
              ? "Your session is complete. Take a little breath."
              : `${result.checkpoints} check-in${result.checkpoints === 1 ? "" : "s"} ready to log.`;
            setNotice(text);
            alertUser(s.settings, "Pacana · A little check-in", text);
          }
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        lastTick.current = current;
        busy.current = false;
      }
    };
    const wake = () => {
      lastTick.current = 0;
      void tick();
    };
    const connection = () => setOnline(navigator.onLine);
    void tick();
    setupOffline();
    connection();
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("pageshow", wake);
    window.addEventListener("online", connection);
    window.addEventListener("offline", connection);
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("pageshow", wake);
      window.removeEventListener("online", connection);
      window.removeEventListener("offline", connection);
    };
  }, []);
  if (!state)
    return (
      <main className="loading">
        <Leaf size={40} />
        <h1>Making room for a calmer day.</h1>
        <p>{error || "Opening your local journal…"}</p>
        {error && <button onClick={() => location.reload()}>Try again</button>}
      </main>
    );
  const today = dayKey(now, state.settings.timezone),
    selected = date || today,
    pending = state.checkpoints.filter((c) => c.status === "pending");
  const todaySessions = state.sessions.filter(
    (s) =>
      dayKey(s.endedAt, state.settings.timezone) === today &&
      s.status === "completed",
  );
  const todayChecks = state.checkpoints.filter(
    (c) => dayKey(c.end, state.settings.timezone) === today,
  );
  const timer = state.timer,
    xp = totalXP(state),
    ms = remaining(state, now),
    phase = timer?.phase || "focus";
  const choose = (name: string) => {
    setTab(name);
    setNotice("");
  };
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <span className="brand-mark">
            <Leaf />
          </span>
          pacana<span className="brand-dot">®</span>
        </a>
        <p className="eyebrow sidebar-label">YOUR LITTLE FOCUS NOOK</p>
        <nav aria-label="Main navigation">
          {tabs.map(([name, Icon]) => (
            <button
              key={name}
              className={tab === name ? "nav-item active" : "nav-item"}
              onClick={() => choose(name)}
              aria-current={tab === name ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{name}</span>
              {name === "Check-ins" && pending.length > 0 && (
                <b className="badge">{pending.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="grow-card">
            <Sprout size={30} />
            <p>
              Little by little,
              <br />a little becomes a lot.
            </p>
            <span>GROW AT YOUR OWN PACE</span>
          </div>
          <button
            className={tab === "Settings" ? "nav-item active" : "nav-item"}
            onClick={() => choose("Settings")}
          >
            <Settings2 size={19} />
            <span>Settings</span>
          </button>
          <div className="local-status">
            <i /> Saved on this device
          </div>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <span className="breadcrumb">
            Your woodland retreat <ChevronRight size={14} />{" "}
            <strong>{tab}</strong>
          </span>
          <a className="mobile-brand" href="/">
            pacana <Leaf size={20} />
          </a>
          <div className="top-actions">
            <span className="clock">
              <Sun size={17} />
              {time(now)}
            </span>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => choose("Settings")}
            >
              <Settings2 size={20} />
            </button>
            <span className="level-chip">
              <Sprout size={16} /> Level {Math.floor(xp / 100) + 1}
            </span>
          </div>
        </header>
        <main className="workspace" id="main">
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {!online && (
            <div className="alert">
              You’re offline. Your journal still saves on this device.
            </div>
          )}
          {notice && (
            <div className="alert" role="status">
              {notice}
              <button
                onClick={() => {
                  setTab("Check-ins");
                  setNotice("");
                }}
              >
                View check-ins
              </button>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                <Leaf size={13} /> A LITTLE INTENTION GOES A LONG WAY
              </p>
              <h1>
                {tab === "Focus"
                  ? "Make space for focus."
                  : tab === "Check-ins"
                    ? "A moment to check in."
                    : tab === "Journal"
                      ? "The story of your day."
                      : tab === "Progress"
                        ? "Small steps. Real growth."
                        : "Make yourself at home."}
              </h1>
              <p>
                {tab === "Focus"
                  ? "One thing at a time. Your capybara’s keeping you company."
                  : tab === "Check-ins"
                    ? "Keep a gentle rhythm. Remember where your time went."
                    : tab === "Journal"
                      ? "A little reflection, without the pressure."
                      : tab === "Progress"
                        ? "Every intentional minute is a small step forward."
                        : "Your rhythm, your preferences, your data."}
              </p>
            </div>
            <span className="date-pill">
              {new Intl.DateTimeFormat("en", {
                timeZone: state.settings.timezone,
                month: "short",
                day: "numeric",
                weekday: "short",
              }).format(now)}
            </span>
          </div>
          {tab === "Focus" && (
            <div className="focus-layout">
              <section className="focus-main">
                <div className="timer-card">
                  <div className="timer-tabs">
                    {(["focus", "short", "long"] as Phase[]).map((p) => (
                      <button
                        disabled={!!timer && timer.status !== "complete"}
                        className={phase === p ? "selected" : ""}
                        key={p}
                        onClick={() => {
                          if (p === "focus")
                            void update((s) => {
                              s.timer = null;
                            });
                          else
                            void update((s) => {
                              startPhase(s, Date.now(), p, task, category);
                              pause(s, Date.now());
                            });
                        }}
                      >
                        {phaseName[p]}
                      </button>
                    ))}
                    <button
                      className="timer-settings"
                      aria-label="Timer setup"
                      onClick={() => setSetup(true)}
                    >
                      <Settings2 size={18} />
                    </button>
                    <button
                      aria-label="Open fullscreen timer"
                      title="Fullscreen timer"
                      onClick={() => setFullscreen(true)}
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                  <div className="timer-scene">
                    <img
                      src="/art/forest.webp"
                      alt="A little capybara reading peacefully in a woodland nook"
                      className="forest-art"
                    />
                    <div className="timer-content">
                      <span className="session-label">
                        <span className="status-dot" />
                        {timer?.status === "complete"
                          ? "SESSION COMPLETE"
                          : timer?.status === "paused"
                            ? "A LITTLE PAUSE"
                            : phaseName[phase].toUpperCase() + " TIME"}
                      </span>
                      <div
                        className="timer-digits"
                        role="timer"
                        aria-label={`${phaseName[phase]} remaining`}
                      >
                        {countdown(ms)}
                      </div>
                      <p className="timer-caption">
                        {timer?.status === "complete"
                          ? "Well done. Take a little breath."
                          : timer?.task || "A little focus goes a long way."}
                      </p>
                      <div className="timer-buttons">
                        {!timer ? (
                          <button
                            className="primary"
                            onClick={() =>
                              void update((s) =>
                                startPhase(
                                  s,
                                  Date.now(),
                                  "focus",
                                  task,
                                  category,
                                ),
                              )
                            }
                          >
                            <Play size={18} fill="currentColor" /> Start focus
                          </button>
                        ) : timer.status === "running" ? (
                          <>
                            <button
                              className="primary"
                              onClick={() =>
                                void update((s) => pause(s, Date.now()))
                              }
                            >
                              <Pause size={18} /> Pause
                            </button>
                            <button
                              className="icon-button end-button"
                              aria-label="End session"
                              onClick={() =>
                                void update((s) => end(s, Date.now()))
                              }
                            >
                              <Square size={17} />
                            </button>
                          </>
                        ) : timer.status === "paused" ? (
                          <>
                            <button
                              className="primary"
                              onClick={() =>
                                void update((s) => resume(s, Date.now()))
                              }
                            >
                              <Play size={18} /> Resume
                            </button>
                            <button
                              className="icon-button end-button"
                              aria-label="End session"
                              onClick={() =>
                                void update((s) => end(s, Date.now()))
                              }
                            >
                              <Square size={17} />
                            </button>
                          </>
                        ) : (
                          <button
                            className="primary"
                            onClick={() =>
                              void update((s) =>
                                startPhase(
                                  s,
                                  Date.now(),
                                  nextPhase(s),
                                  timer.task,
                                  timer.category,
                                ),
                              )
                            }
                          >
                            Start {phaseName[nextPhase(state)].toLowerCase()}{" "}
                            <ArrowRight size={18} />
                          </button>
                        )}
                      </div>
                      <span className="cycle-label">
                        SESSION{" "}
                        {(state.completedCycle % state.settings.cycles) + 1} OF{" "}
                        {state.settings.cycles} <span>•</span>{" "}
                        {state.settings.focus} / {state.settings.short} MIN
                        RHYTHM
                      </span>
                    </div>
                  </div>
                  <div className="timer-foot">
                    <Leaf size={17} />
                    <span>
                      Focus on what’s in front of you. The rest can wait.
                    </span>
                    <button
                      aria-label={
                        state.settings.sound ? "Mute sound" : "Enable sound"
                      }
                      className={
                        state.settings.sound ? "sound active" : "sound"
                      }
                      onClick={() =>
                        void update((s) => {
                          s.settings.sound = !s.settings.sound;
                        })
                      }
                    >
                      <Volume2 size={18} />
                    </button>
                  </div>
                </div>
                {timer?.status === "complete" && timer.phase === "focus" && (
                  <div className="completion card">
                    <Sprout />
                    <div>
                      <h3>A little progress, made.</h3>
                      <p>
                        +{Math.floor(timer.duration / 60000)} XP · What did you
                        accomplish?
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSessionId(timer.id);
                        setSessionPhoto(
                          state.sessions.find((s) => s.id === timer.id)?.photo,
                        );
                        setNote(
                          state.sessions.find((s) => s.id === timer.id)?.note ||
                            "",
                        );
                      }}
                    >
                      Add a note
                    </button>
                  </div>
                )}
                <div className="task-card card">
                  <span className="soft-icon">
                    <BookOpen size={21} />
                  </span>
                  <label className="field">
                    WHAT ARE YOU WORKING ON?
                    <input
                      maxLength={1000}
                      placeholder="Give this moment an intention…"
                      value={
                        timer && timer.status !== "complete" ? timer.task : task
                      }
                      onChange={(e) => setTask(e.target.value)}
                      disabled={!!timer && timer.status !== "complete"}
                    />
                  </label>
                  <select
                    aria-label="Focus category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    disabled={!!timer && timer.status !== "complete"}
                  >
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="mini-stats">
                  <div className="card">
                    <Timer />
                    <span>Focused today</span>
                    <strong>
                      {duration(
                        todaySessions.reduce((a, s) => a + s.duration, 0),
                      )}
                    </strong>
                  </div>
                  <div className="card">
                    <Check />
                    <span>Sessions completed</span>
                    <strong>
                      {todaySessions.length}
                      <small> little wins</small>
                    </strong>
                  </div>
                  <div className="card">
                    <Sprout />
                    <span>Growing together</span>
                    <strong>
                      {xp}
                      <small> total XP</small>
                    </strong>
                  </div>
                </div>
                <p className="quiet-quote">
                  “You don’t have to do it all. Just the next little thing.”
                </p>
              </section>
              <aside className="rhythm card">
                <div className="section-title">
                  <h2>Today’s rhythm</h2>
                  <span className="soft-icon">
                    <Clock3 size={19} />
                  </span>
                </div>
                <p>A little awareness, hour by hour.</p>
                {todayChecks.length === 0 ? (
                  <div className="empty-rhythm">
                    <Sprout size={34} />
                    <h3>A fresh little page.</h3>
                    <p>Your check-ins will find a home here.</p>
                    <button onClick={() => choose("Check-ins")}>
                      Set your rhythm <ArrowRight size={15} />
                    </button>
                  </div>
                ) : (
                  <div className="timeline">
                    {todayChecks.slice(-6).map((c) => (
                      <button
                        className="timeline-item"
                        key={c.id}
                        onClick={() => setEditing(c)}
                      >
                        <span className={"timeline-dot " + c.status}>
                          {c.status === "logged" ? (
                            <Check size={12} />
                          ) : (
                            <span />
                          )}
                        </span>
                        <span>
                          <small>{time(c.end)}</small>
                          <strong>
                            {c.status === "pending"
                              ? "Ready to reflect"
                              : c.activity || "Skipped"}
                          </strong>
                          <em>
                            {time(c.start)} – {time(c.end)}
                          </em>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {state.run && (
                  <div className="next-check">
                    <span className="eyebrow">NEXT CHECK-IN</span>
                    <strong>{time(state.run.nextAt)}</strong>
                    <span>
                      in {countdown(Math.max(0, state.run.nextAt - now))}
                    </span>
                  </div>
                )}
                <button className="text-link" onClick={() => choose("Journal")}>
                  Open your journal <ArrowRight size={16} />
                </button>
                <div className="kind-note">
                  <div
                    role="img"
                    aria-label="Your capybara companion"
                    className={`companion ${timer?.status === "complete" ? "celebrate" : phase !== "focus" ? "rest" : timer?.status === "running" ? "study" : "idle"}`}
                  />
                  <p>
                    A moment to notice.
                    <br />A little room to grow.
                  </p>
                </div>
              </aside>
            </div>
          )}
          {tab === "Check-ins" && (
            <>
              <div className="two-col">
                <ScheduleCard state={state} update={update} />
                <ElapsedCard state={state} update={update} />
              </div>
              {state.run && (
                <div className="active-run card">
                  <span className="status-dot" />
                  <div>
                    <h3>
                      {state.run.mode === "clock"
                        ? "Clock Schedule"
                        : "Start Now"}{" "}
                      is active
                    </h3>
                    <p>
                      Next: {time(state.run.nextAt)} ·{" "}
                      {countdown(Math.max(0, state.run.nextAt - now))} remaining
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      void update((s) => {
                        s.run = null;
                      })
                    }
                  >
                    Stop check-ins
                  </button>
                </div>
              )}
              <section className="card journal-card">
                <div className="section-title">
                  <h2>Pending check-ins</h2>
                  <span className="badge">{pending.length}</span>
                </div>
                <p>Late is okay. Your original time periods stay the same.</p>
                {pending.length ? (
                  pending.map((c) => (
                    <div className="log-row" key={c.id}>
                      <Clock3 />
                      <div>
                        <strong>
                          {time(c.start)} – {time(c.end)}
                        </strong>
                        <p>
                          {dayKey(c.end, state.settings.timezone)} · Unlogged
                        </p>
                      </div>
                      <button onClick={() => setEditing(c)}>
                        Reflect <ArrowRight size={15} />
                      </button>
                    </div>
                  ))
                ) : (
                  <Empty text="All caught up. A little room to breathe." />
                )}
              </section>
            </>
          )}
          {tab === "Journal" && (
            <section className="card journal-card">
              <div className="section-title">
                <h2>Your daily timeline</h2>
                <input
                  aria-label="Journal date"
                  type="date"
                  value={selected}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <p>Timer records and your reflections are shown separately.</p>
              {[
                ...state.checkpoints
                  .filter(
                    (c) => dayKey(c.end, state.settings.timezone) === selected,
                  )
                  .map((c) => ({ at: c.end, id: c.id, checkpoint: c })),
                ...state.sessions
                  .filter(
                    (s) =>
                      dayKey(s.endedAt, state.settings.timezone) === selected,
                  )
                  .map((s) => ({ at: s.endedAt, id: s.id, session: s })),
              ]
                .sort((a, b) => a.at - b.at)
                .map((item) =>
                  "checkpoint" in item ? (
                    <div className="log-row" key={item.id}>
                      <span
                        className={"timeline-dot " + item.checkpoint.status}
                      >
                        {item.checkpoint.status === "logged" ? (
                          <Check size={14} />
                        ) : (
                          <Clock3 size={14} />
                        )}
                      </span>
                      <div>
                        <small>
                          {time(item.checkpoint.start)} –{" "}
                          {time(item.checkpoint.end)} · Check-in
                        </small>
                        <strong>
                          {item.checkpoint.activity ||
                            (item.checkpoint.photo ? "Photo reflection" : "") ||
                            (item.checkpoint.status === "pending"
                              ? "Unlogged period"
                              : "Skipped")}
                        </strong>
                        <p>
                          {item.checkpoint.category}
                          {item.checkpoint.mood && ` · ${item.checkpoint.mood}`}
                        </p>
                        {item.checkpoint.photo && (
                          <a
                            href={item.checkpoint.photo}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              className="journal-photo"
                              src={item.checkpoint.photo}
                              alt="Photo of this activity"
                            />
                          </a>
                        )}
                      </div>
                      <button onClick={() => setEditing(item.checkpoint)}>
                        Edit
                      </button>
                    </div>
                  ) : (
                    <div className="log-row" key={item.id}>
                      <Timer />
                      <div>
                        <small>
                          {time(item.session.startedAt)} –{" "}
                          {time(item.session.endedAt)} · Focus timer
                        </small>
                        <strong>{item.session.task || "Focus session"}</strong>
                        <p>
                          {duration(item.session.duration)} ·{" "}
                          {item.session.status}
                          {item.session.note && ` · ${item.session.note}`}
                        </p>
                        {item.session.photo && (
                          <a
                            href={item.session.photo}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <img
                              className="journal-photo"
                              src={item.session.photo}
                              alt="Photo of this focus session"
                            />
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSessionId(item.id);
                          setNote(item.session.note);
                          setSessionPhoto(item.session.photo);
                        }}
                      >
                        Edit note
                      </button>
                    </div>
                  ),
                )}
              {!state.checkpoints.some(
                (c) => dayKey(c.end, state.settings.timezone) === selected,
              ) &&
                !state.sessions.some(
                  (s) =>
                    dayKey(s.endedAt, state.settings.timezone) === selected,
                ) && (
                  <Empty text="Nothing written here yet. Your next session is a lovely place to start." />
                )}
            </section>
          )}
          {tab === "Progress" && <Progress state={state} now={now} />}
          {tab === "Settings" && (
            <Preferences
              state={state}
              update={update}
              setError={setError}
              setNotice={setNotice}
              onRestore={setState}
            />
          )}
          <footer className="app-footer">
            <Leaf size={13} /> A calmer pace. A clearer day.
            <span>Pacana · Your data stays with you</span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {tabs.map(([name, Icon]) => (
          <button
            key={name}
            className={tab === name ? "active" : ""}
            onClick={() => choose(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {fullscreen && (
        <FullscreenTimer
          state={state}
          now={now}
          error={error}
          close={() => setFullscreen(false)}
          stop={() => void update((s) => end(s, Date.now()))}
          primary={() =>
            void update((s) => {
              if (!s.timer) startPhase(s, Date.now(), "focus", task, category);
              else if (s.timer.status === "running") pause(s, Date.now());
              else if (s.timer.status === "paused") resume(s, Date.now());
              else
                startPhase(
                  s,
                  Date.now(),
                  nextPhase(s),
                  s.timer.task,
                  s.timer.category,
                );
            })
          }
        />
      )}
      {setup && (
        <Modal title="Find your focus rhythm" close={() => setSetup(false)}>
          <TimerSettings
            state={state}
            save={async (values) => {
              if (
                await update((s) => {
                  Object.assign(s.settings, values);
                })
              )
                setSetup(false);
            }}
          />
        </Modal>
      )}
      {editing && (
        <Modal title="A moment to reflect" close={() => setEditing(null)}>
          <p>
            {time(editing.start)} – {time(editing.end)} ·{" "}
            {dayKey(editing.end, state.settings.timezone)}
          </p>
          <LogForm
            checkpoint={editing}
            save={async (activity, cat, mood, skip, photo) => {
              if (
                await update((s) =>
                  logCheckpoint(
                    s,
                    editing.id,
                    activity,
                    cat,
                    mood,
                    Date.now(),
                    skip,
                    photo,
                  ),
                )
              )
                setEditing(null);
            }}
          />
        </Modal>
      )}
      {sessionId && (
        <Modal
          title="What did you accomplish?"
          close={() => setSessionId(null)}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (photoBusy) return;
              const saved = await update((s) => {
                const item = s.sessions.find((x) => x.id === sessionId);
                if (item) {
                  item.note = note;
                  item.photo = sessionPhoto;
                }
              });
              if (saved) setSessionId(null);
            }}
          >
            <label className="field">
              Session note
              <textarea
                autoFocus
                maxLength={10000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <button className="primary">
              {photoBusy ? "Preparing photo…" : "Save note"} <Check size={17} />
            </button>
            <LogPhoto
              value={sessionPhoto}
              onChange={setSessionPhoto}
              onBusy={setPhotoBusy}
            />
          </form>
        </Modal>
      )}
      {!state.settings.onboarded && (
        <Modal
          title="Welcome to your little focus nook."
          close={() =>
            void update((s) => {
              s.settings.onboarded = true;
            })
          }
        >
          <img
            className="welcome-art"
            src="/art/forest.webp"
            alt="Capybara in a quiet forest"
          />
          <p>
            Settle into a focus session, check in with your day, and keep a
            little journal of where your time went.
          </p>
          <p className="muted">
            Everything saves on this device. Keep Pacana open for reminders;
            alarms aren’t guaranteed after the browser closes.
          </p>
          <button
            className="primary"
            onClick={() =>
              void update((s) => {
                s.settings.onboarded = true;
              })
            }
          >
            Make myself at home <ArrowRight size={17} />
          </button>
          <button
            className="text-link"
            onClick={() =>
              void update((s) => {
                s.settings.onboarded = true;
              })
            }
          >
            Skip introduction
          </button>
        </Modal>
      )}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Sprout size={34} />
      <p>{text}</p>
    </div>
  );
}
function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog ref={ref} className="modal" onCancel={close}>
      <div className="section-title">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function TimerSettings({
  state,
  save,
}: {
  state: State;
  save: (
    v: Pick<
      State["settings"],
      "focus" | "short" | "long" | "cycles" | "autoBreak" | "autoFocus"
    >,
  ) => void;
}) {
  const [v, set] = useState({
    focus: state.settings.focus,
    short: state.settings.short,
    long: state.settings.long,
    cycles: state.settings.cycles,
    autoBreak: state.settings.autoBreak,
    autoFocus: state.settings.autoFocus,
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(v);
      }}
    >
      <div className="form-grid">
        <NumberField
          label="Focus minutes"
          value={v.focus}
          onChange={(n) => set({ ...v, focus: n })}
        />
        <NumberField
          label="Short break minutes"
          value={v.short}
          onChange={(n) => set({ ...v, short: n })}
        />
        <NumberField
          label="Long break minutes"
          value={v.long}
          onChange={(n) => set({ ...v, long: n })}
        />
        <NumberField
          label="Sessions per cycle"
          max={24}
          value={v.cycles}
          onChange={(n) => set({ ...v, cycles: n })}
        />
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={v.autoBreak}
          onChange={(e) => set({ ...v, autoBreak: e.target.checked })}
        />{" "}
        Automatically start breaks
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={v.autoFocus}
          onChange={(e) => set({ ...v, autoFocus: e.target.checked })}
        />{" "}
        Automatically start the next focus session
      </label>
      <p className="muted">
        Changes apply to the next phase. After browser suspension, continue
        manually.
      </p>
      <button className="primary">
        Save rhythm <Check size={17} />
      </button>
    </form>
  );
}
function ScheduleCard({
  state,
  update,
}: {
  state: State;
  update: (fn: (s: State) => void) => Promise<boolean>;
}) {
  const [v, set] = useState<Schedule>(structuredClone(state.schedule)),
    [explicit, setExplicit] = useState(state.schedule.explicit.join(", "));
  return (
    <section className="card settings-card">
      <span className="soft-icon">
        <Clock3 />
      </span>
      <h2>Clock Schedule</h2>
      <p>On the hour. In your rhythm.</p>
      <div className="example">Start at 6:58 → check in at 7:00</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void update((s) => {
            const times = explicit.trim()
              ? explicit.split(",").map((t) => t.trim())
              : [];
            if (times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
              throw new Error(
                "Use comma-separated 24-hour times, such as 06:00, 09:30.",
              );
            if (!v.days.length) throw new Error("Choose at least one weekday.");
            if (!times.length && v.end < v.start)
              throw new Error("End time must follow start time.");
            s.schedule = { ...v, explicit: times };
            activate(s, Date.now(), "clock");
          });
        }}
      >
        <div className="form-grid">
          <label className="field">
            Start time
            <input
              required
              type="time"
              value={v.start}
              onChange={(e) => set({ ...v, start: e.target.value })}
            />
          </label>
          <label className="field">
            End time
            <input
              required
              type="time"
              value={v.end}
              onChange={(e) => set({ ...v, end: e.target.value })}
            />
          </label>
        </div>
        <NumberField
          label="Repeat every (minutes)"
          value={v.interval}
          onChange={(n) => set({ ...v, interval: n })}
        />
        <fieldset className="days">
          <legend>Repeat on</legend>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <label key={day}>
              <input
                type="checkbox"
                checked={v.days.includes(i)}
                onChange={(e) =>
                  set({
                    ...v,
                    days: e.target.checked
                      ? [...v.days, i]
                      : v.days.filter((d) => d !== i),
                  })
                }
              />
              <span>{day}</span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          Or use specific times
          <input
            value={explicit}
            placeholder="06:00, 09:30, 13:00"
            onChange={(e) => setExplicit(e.target.value)}
          />
        </label>
        <p className="muted">
          Specific times replace the interval and time window.{" "}
          {state.settings.timezone}. Only future checkpoints are created.
        </p>
        <button className="primary">
          {state.run ? "Switch to this schedule" : "Start clock schedule"}{" "}
          <ArrowRight size={17} />
        </button>
      </form>
    </section>
  );
}
function ElapsedCard({
  state,
  update,
}: {
  state: State;
  update: (fn: (s: State) => void) => Promise<boolean>;
}) {
  const [interval, set] = useState(state.interval);
  return (
    <section className="card settings-card elapsed-card">
      <span className="soft-icon honey">
        <Play />
      </span>
      <h2>Start Now</h2>
      <p>Your next interval starts with you.</p>
      <div className="example">Start at 6:58 → 7:08 → 7:18</div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void update((s) => {
            s.interval = interval;
            activate(s, Date.now(), "elapsed");
          });
        }}
      >
        <NumberField
          label="Check in every (minutes)"
          value={interval}
          onChange={set}
        />
        <p className="muted">
          Begins at the exact moment you press Start. It follows elapsed time,
          never the clock hour.
        </p>
        <button className="primary">
          {state.run ? "Switch and start now" : "Start now"} <Play size={17} />
        </button>
      </form>
      <div className="gentle-tip">
        <Leaf />
        <p>
          Focus and check-ins can run together. A check-in won’t interrupt your
          timer.
        </p>
      </div>
    </section>
  );
}
function LogForm({
  checkpoint,
  save,
}: {
  checkpoint: Checkpoint;
  save: (
    a: string,
    c: string,
    m: string,
    skip: boolean,
    photo?: string,
  ) => void;
}) {
  const [activity, setActivity] = useState(checkpoint.activity),
    [category, setCategory] = useState(checkpoint.category),
    [mood, setMood] = useState(checkpoint.mood);
  const [photo, setPhoto] = useState(checkpoint.photo);
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) save(activity, category, mood, false, photo);
      }}
    >
      <label className="field">
        What did you do?
        <textarea
          autoFocus
          required={!photo}
          maxLength={10000}
          placeholder="A few words about this little part of your day…"
          value={activity}
          onChange={(e) => setActivity(e.target.value)}
        />
      </label>
      <LogPhoto value={photo} onChange={setPhoto} onBusy={setBusy} />
      <div className="quick-options">
        {["Break", "Away"].map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              setActivity(v === "Break" ? "Taking a break" : "Away");
              setCategory(v);
            }}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <Category value={category} onChange={setCategory} />
        <label className="field">
          How did it feel? (optional)
          <select value={mood} onChange={(e) => setMood(e.target.value)}>
            <option value="">No mood selected</option>
            {["Low energy", "Okay", "Good", "Focused"].map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button className="primary">
          Save reflection <Check size={17} />
        </button>
        <button type="button" onClick={() => save("", category, mood, true)}>
          Skip this period
        </button>
      </div>
    </form>
  );
}
function Progress({ state, now }: { state: State; now: number }) {
  const today = dayKey(now, state.settings.timezone),
    xp = totalXP(state);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(`${today}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 6 + i);
    return date.toISOString().slice(0, 10);
  });
  const totals = days.map((d) =>
    state.sessions
      .filter(
        (s) =>
          s.status === "completed" &&
          dayKey(s.endedAt, state.settings.timezone) === d,
      )
      .reduce((n, s) => n + s.duration, 0),
  );
  const checkpoints = state.checkpoints.filter((c) =>
      days.includes(dayKey(c.end, state.settings.timezone)),
    ),
    logged = checkpoints.filter((c) => c.status === "logged").length;
  return (
    <>
      <div className="mini-stats">
        <div className="card">
          <Timer />
          <span>Today’s focus</span>
          <strong>{duration(totals[6])}</strong>
        </div>
        <div className="card">
          <ChartNoAxesColumnIncreasing />
          <span>Last seven days</span>
          <strong>{duration(totals.reduce((a, b) => a + b, 0))}</strong>
        </div>
        <div className="card">
          <Check />
          <span>Weekly check-ins</span>
          <strong>
            {logged} / {checkpoints.length}
            <small> logged</small>
          </strong>
        </div>
      </div>
      <div className="two-col progress-grid">
        <section className="card settings-card">
          <h2>Your week, little by little</h2>
          <p>Completed focus sessions · measured timer time</p>
          <div className="bar-chart">
            {days.map((d, i) => (
              <div key={d}>
                <span>{duration(totals[i])}</span>
                <div className="bar-track">
                  <div
                    className="bar"
                    style={{
                      height: `${totals[i] ? Math.max(3, (totals[i] / Math.max(...totals)) * 100) : 0}%`,
                    }}
                  />
                </div>
                <small>
                  {new Intl.DateTimeFormat("en", {
                    weekday: "short",
                    timeZone: "UTC",
                  }).format(new Date(d))}
                </small>
              </div>
            ))}
          </div>
          <p className="muted">
            Journal reflections are self-reported and aren’t added to focus
            time.
          </p>
        </section>
        <section className="card settings-card xp-card">
          <Sprout size={56} />
          <p className="eyebrow">GROWING AT YOUR OWN PACE</p>
          <h2>Level {Math.floor(xp / 100) + 1}</h2>
          <strong>{xp} XP</strong>
          <progress
            max="100"
            value={xp % 100}
            aria-label="Progress toward next level"
          />
          <p>{100 - (xp % 100)} XP until your next little milestone.</p>
          <p className="muted">
            Completed focus minutes earn 1 XP each. A first saved check-in earns
            5 XP. Rest is welcome; there’s nothing to lose.
          </p>
        </section>
      </div>
    </>
  );
}
function Preferences({
  state,
  update,
  setError,
  setNotice,
  onRestore,
}: {
  state: State;
  update: (fn: (s: State) => void) => Promise<boolean>;
  setError: (v: string) => void;
  setNotice: (v: string) => void;
  onRestore: (s: State) => void;
}) {
  const [zone, setZone] = useState(state.settings.timezone),
    [backup, setBackup] = useState<State | null>(null);
  return (
    <div className="two-col preferences">
      <section className="card settings-card">
        <h2>Your timer rhythm</h2>
        <TimerSettings
          state={state}
          save={(v) =>
            void update((s) => {
              Object.assign(s.settings, v);
            })
          }
        />
      </section>
      <div className="settings-stack">
        <section className="card settings-card">
          <h2>Gentle reminders</h2>
          <label className="toggle">
            <input
              type="checkbox"
              checked={state.settings.sound}
              onChange={(e) =>
                void update((s) => {
                  s.settings.sound = e.target.checked;
                })
              }
            />{" "}
            Play a soft chime
          </label>
          <label className="field">
            Ringtone
            <select
              value={state.settings.ringtone}
              onChange={(e) => {
                const ringtone = e.target.value as Ringtone;
                void update((s) => {
                  s.settings.ringtone = ringtone;
                });
              }}
            >
              {ringtones.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={async () => {
              try {
                await previewRingtone(state.settings.ringtone);
              } catch {
                setError(
                  "Sound could not play. Check your browser audio permissions and device volume.",
                );
              }
            }}
          >
            <Volume2 size={17} /> Preview ringtone
          </button>
          <p className="muted">
            Free, open-source synthesized chimes. Works offline, with no
            downloads. Enable “Play a soft chime” to use your selection for
            reminders.
          </p>
          <button
            onClick={async () => {
              try {
                unlockAudio();
                if (!state.settings.notifications) await enableNotifications();
                await update((s) => {
                  s.settings.notifications = !s.settings.notifications;
                });
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Bell size={17} />
            {state.settings.notifications
              ? "Disable notifications"
              : "Enable notifications"}
          </button>
          <p className="muted">
            Keep Pacana open for reminders. Closed-browser alarms are not
            guaranteed.
          </p>
        </section>
        <section className="card settings-card">
          <h2>Your timezone</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void update((s) => changeTimezone(s, zone, Date.now()));
            }}
          >
            <label className="field">
              IANA timezone
              <input
                required
                list="timezones"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </label>
            <datalist id="timezones">
              {[
                "Asia/Manila",
                "Asia/Tokyo",
                "Europe/London",
                "America/New_York",
                "America/Los_Angeles",
                "Australia/Sydney",
                "UTC",
              ].map((z) => (
                <option key={z} value={z} />
              ))}
            </datalist>
            <button>Save timezone</button>
          </form>
        </section>
        <section className="card settings-card">
          <h2>Your data stays with you</h2>
          <p>
            Back up your journal before clearing browser data or changing
            devices.
          </p>
          <div className="actions">
            <button
              onClick={async () => {
                try {
                  const { state: s } = await transact(() => {});
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(s, null, 2)], {
                      type: "application/json",
                    }),
                  );
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pacana-backup-${dayKey(Date.now(), s.settings.timezone)}.json`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Download size={17} /> Export backup
            </button>
            <label className="file-button">
              <Upload size={17} /> Import backup
              <input
                type="file"
                accept="application/json,.json"
                onChange={async (e) => {
                  try {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 20 * 1024 * 1024)
                      throw new Error("Backup must be smaller than 20 MB.");
                    setBackup(parseBackup(JSON.parse(await file.text())));
                  } catch (e) {
                    setError((e as Error).message);
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </section>
      </div>
      {backup && (
        <Modal
          title="Replace your local journal?"
          close={() => setBackup(null)}
        >
          <p>
            This backup contains {backup.sessions.length} sessions and{" "}
            {backup.checkpoints.length} check-ins. Restoring replaces all
            current Pacana data on this device.
          </p>
          <div className="actions">
            <button
              className="primary"
              onClick={async () => {
                try {
                  const { state: s } = await restore(backup);
                  onRestore(s);
                  setBackup(null);
                  setNotice("Your backup has been restored.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Replace and restore
            </button>
            <button onClick={() => setBackup(null)}>Keep current data</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
