"use client";
/* Native links intentionally load cached HTML for offline navigation. Artwork is locally optimized WebP. */
/* eslint-disable @next/next/no-html-link-for-pages, @next/next/no-img-element */
import { useEffect, useRef, useState, useCallback } from "react";
import SidebarCompanion from "./sidebar-companion";
import InteractiveCompanion from "./interactive-companion";
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
  ChevronDown,
  Maximize2,
  Minimize2,
  Music,
  Trash2,
  Plus,
} from "lucide-react";
import type {
  State,
  Checkpoint,
  JournalEntry,
  Schedule,
  Phase,
} from "../core/model";
import {
  activate,
  addJournalEntry,
  changeTimezone,
  clearDay,
  deleteCheckpoint,
  deleteJournalEntry,
  end,
  editJournalEntry,
  findJournalOverlap,
  logCheckpoint,
  nextPhase,
  pause,
  reconcile,
  remaining,
  resume,
  startPhase,
  resetProgress,
  totalXP,
} from "../core/engine";
import { dayKey, localInstant, parts } from "../core/schedule";
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
const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that audio file."));
    reader.readAsDataURL(file);
  });
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
    [manualJournal, setManualJournal] = useState<"new" | JournalEntry | null>(
      null,
    );
  const [date, setDate] = useState(""),
    [online, setOnline] = useState(true),
    [isCompanionFloating, setIsCompanionFloating] = useState(false),
    [companionDropPos, setCompanionDropPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsCompanionFloating(
        localStorage.getItem("pacana:companion:floating") === "true",
      );
    }
  }, []);

  useEffect(() => {
    const handleSwitchTab = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      if (customEvent.detail) {
        setTab(customEvent.detail);
        setNotice("");
      }
    };
    window.addEventListener("pacana:switch-tab", handleSwitchTab);
    return () => {
      window.removeEventListener("pacana:switch-tab", handleSwitchTab);
    };
  }, []);

  const handleToggleCompanion = (floating: boolean, dropPos?: { x: number; y: number }) => {
    if (dropPos) {
      setCompanionDropPos(dropPos);
      if (typeof window !== "undefined") {
        localStorage.setItem("pacana:companion:pos", JSON.stringify(dropPos));
      }
    }
    setIsCompanionFloating(floating);
    if (typeof window !== "undefined") {
      localStorage.setItem("pacana:companion:floating", floating ? "true" : "false");
    }
  };

  const toggleFullscreen = useCallback(
    (desired?: boolean) => {
      const isElectron =
        typeof window !== "undefined" &&
        Boolean((window as any).pacanaDesktop?.setFullscreen);

      if (isElectron) {
        const next = typeof desired === "boolean" ? desired : !fullscreen;
        void (window as any).pacanaDesktop
          .setFullscreen(next)
          .then((res: boolean) => {
            setFullscreen(res);
          })
          .catch(() => {});
      } else if (typeof document !== "undefined") {
        const isWebFull = Boolean(document.fullscreenElement);
        const next = typeof desired === "boolean" ? desired : !isWebFull;
        if (next) {
          if (
            document.documentElement.requestFullscreen &&
            !document.fullscreenElement
          ) {
            document.documentElement.requestFullscreen().catch(() => {});
          }
        } else {
          if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
          }
        }
      }
    },
    [fullscreen],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    if ((window as any).pacanaDesktop?.onFullscreenChange) {
      if (typeof (window as any).pacanaDesktop.isFullscreen === "function") {
        (window as any).pacanaDesktop
          .isFullscreen()
          .then((isFull: boolean) => {
            setFullscreen(isFull);
          })
          .catch(() => {});
      }
      const cleanup = (window as any).pacanaDesktop.onFullscreenChange(
        (isFull: boolean) => {
          setFullscreen(isFull);
        },
      );
      return cleanup;
    }

    const handleFsChange = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", handleFsChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (fullscreen) {
      document.body.classList.add("is-fullscreen");
    } else {
      document.body.classList.remove("is-fullscreen");
    }
  }, [fullscreen]);
  const lastTick = useRef(0),
    busy = useRef(false);
  const completionPlayedRef = useRef<string | null>(null);
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
          reconcile(s, current, false),
        );
        if (live) {
          setState(s);
          if (result.completed || result.checkpoints) {
            const text = result.completed
              ? "Your session is complete. Take a little breath."
              : `${result.checkpoints} check-in${result.checkpoints === 1 ? "" : "s"} ready to log.`;
            setNotice(text);

            if (result.completed) {
              const completedTimer = s.timer;
              const timerId = completedTimer?.id;
              if (timerId && completionPlayedRef.current === timerId) {
                return;
              }
              if (timerId) {
                completionPlayedRef.current = timerId;
              }
              const completedPhase = completedTimer?.phase;
              const shouldAutoStart =
                auto &&
                (completedPhase === "focus"
                  ? s.settings.autoBreak
                  : s.settings.autoFocus);
              const upcomingPhase = nextPhase(s);
              const taskToContinue = completedTimer?.task;
              const catToContinue = completedTimer?.category;

              window.dispatchEvent(
                new CustomEvent("pacana:timer-complete", {
                  detail: { phase: completedPhase },
                }),
              );

              if (shouldAutoStart) {
                let started = false;
                let fallbackTimer: NodeJS.Timeout | null = null;

                const startNextSession = () => {
                  if (started) return;
                  started = true;
                  window.removeEventListener("pacana:sound-ended", handleSoundEnded);
                  if (fallbackTimer) clearTimeout(fallbackTimer);
                  void update((latestState) => {
                    if (latestState.timer?.status === "complete") {
                      startPhase(
                        latestState,
                        Date.now(),
                        upcomingPhase,
                        taskToContinue,
                        catToContinue,
                      );
                    }
                  });
                };

                const handleSoundEnded = () => {
                  startNextSession();
                };

                window.addEventListener("pacana:sound-ended", handleSoundEnded, {
                  once: true,
                });

                // Safety fallback in case sound fails or event is missed
                fallbackTimer = setTimeout(startNextSession, 15000);

                void alertUser(s.settings, "Pacana · A little check-in", text, {
                  forceSound: true,
                }).then((soundPlayed) => {
                  if (live && !soundPlayed) {
                    setNotice(
                      "Your timer finished, but sound is blocked. Click the speaker icon to enable and test it.",
                    );
                    setTimeout(startNextSession, 1800);
                  }
                });
              } else {
                void alertUser(s.settings, "Pacana · A little check-in", text, {
                  forceSound: true,
                }).then((soundPlayed) => {
                  if (live && !soundPlayed) {
                    setNotice(
                      "Your timer finished, but sound is blocked. Click the speaker icon to enable and test it.",
                    );
                  }
                });
              }
            } else {
              void alertUser(s.settings, "Pacana · A little check-in", text, {
                forceSound: false,
              });
            }
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
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.protocol === "pacana:" ||
        navigator.userAgent.includes("Electron"))
    ) {
      document.body.classList.add("is-desktop");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true");

      // Ctrl+, -> Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        choose("Settings");
      }
      // Ctrl+1..4 -> Switch tabs
      else if (
        (e.ctrlKey || e.metaKey) &&
        ["1", "2", "3", "4"].includes(e.key)
      ) {
        e.preventDefault();
        const tabNames = ["Focus", "Check-ins", "Journal", "Progress"];
        const target = tabNames[parseInt(e.key, 10) - 1];
        if (target) choose(target);
      }
      // Space -> Start / pause / resume focus timer
      else if (
        e.code === "Space" &&
        !isInput &&
        !editing &&
        !manualJournal &&
        !setup
      ) {
        e.preventDefault();
        void update((s) => {
          if (!s.timer || s.timer.status === "complete") {
            startPhase(s, Date.now(), "focus", task, category);
          } else if (s.timer.status === "running") {
            pause(s, Date.now());
          } else if (s.timer.status === "paused") {
            resume(s, Date.now());
          }
        });
      }
      // F key -> Toggle fullscreen
      else if (
        (e.key === "f" || e.key === "F") &&
        !isInput &&
        !editing &&
        !manualJournal &&
        !setup &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleFullscreen();
      }
      // Escape -> Exit fullscreen if active
      else if (e.key === "Escape" && fullscreen) {
        e.preventDefault();
        toggleFullscreen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editing, manualJournal, setup, task, category, toggleFullscreen, fullscreen]);
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
  const journalItems = [
    ...state.checkpoints
      .filter(
        (checkpoint) =>
          dayKey(checkpoint.end, state.settings.timezone) === selected,
      )
      .map((entry) => ({ kind: "check-in" as const, entry })),
    ...state.journalEntries
      .filter(
        (entry) => dayKey(entry.end, state.settings.timezone) === selected,
      )
      .map((entry) => ({ kind: "journal" as const, entry })),
  ].sort((a, b) => a.entry.start - b.entry.start || a.entry.end - b.entry.end);
  const timer = state.timer,
    xp = totalXP(state),
    ms = remaining(state, now),
    phase = timer?.phase || "focus";
  const choose = (name: string) => {
    setTab(name);
    setNotice("");
  };
  const hourNum = new Date(now).getHours();
  const greeting =
    hourNum >= 5 && hourNum < 12
      ? "Good morning"
      : hourNum >= 12 && hourNum < 18
        ? "Good afternoon"
        : "Good evening";
  const userName = "Eleazar";
  const formattedDate = new Intl.DateTimeFormat("en", {
    timeZone: state.settings.timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(now);
  return (
    <div className="app-shell">
      <div className="desktop-titlebar" aria-hidden="true" data-capybara-obstacle>
        <div className="titlebar-brand">
          <span className="titlebar-icon">
            <Leaf size={12} strokeWidth={2.6} />
          </span>
          <span className="titlebar-title">Pacana</span>
        </div>
        <div className="titlebar-drag-region" />
      </div>
      <div className="desktop-titlebar-line" aria-hidden="true" />
      <aside className="sidebar" data-capybara-obstacle>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            if (
              typeof window !== "undefined" &&
              window.location.protocol === "pacana:"
            ) {
              e.preventDefault();
              choose("Focus");
            }
          }}
        >
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
              data-tab={name}
              data-capybara-target={name === "Focus" ? "nav-focus" : undefined}
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
        <header className="topbar" data-capybara-obstacle>
          <div className="header-greeting">
            <span className="greeting-leaf">
              <Leaf size={16} />
            </span>
            <strong className="greeting-text">
              {tab === "Focus"
                ? `${greeting}, ${userName}!`
                : `${greeting}, ${userName}! · ${tab}`}
            </strong>
          </div>
          <a
            className="mobile-brand"
            href="/"
            onClick={(e) => {
              if (
                typeof window !== "undefined" &&
                window.location.protocol === "pacana:"
              ) {
                e.preventDefault();
                choose("Focus");
              }
            }}
          >
            pacana <Leaf size={20} />
          </a>
          <div className="top-actions">
            <span className="header-date">
              <Sun size={15} className="sun-icon" />
              <span className="date-sep">|</span>
              <span>{formattedDate}</span>
            </span>
            <button
              className="icon-button"
              aria-label="Settings"
              onClick={() => choose("Settings")}
            >
              <Settings2 size={19} />
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
                <div className="timer-card" data-capybara-obstacle>
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
                      title="Fullscreen timer (F)"
                      onClick={() => toggleFullscreen(true)}
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
                            data-capybara-target="focus"
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
                              data-capybara-target="focus"
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
                              data-capybara-target="focus"
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
                            data-capybara-target="focus"
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
                        {state.timer?.phase === "long" ? (
                          <>
                            CYCLE COMPLETE <span>•</span> LONG BREAK
                          </>
                        ) : (
                          <>
                            SESSION{" "}
                            {(state.completedCycle % state.settings.cycles) + 1} OF{" "}
                            {state.settings.cycles} <span>•</span>{" "}
                            {state.timer?.phase === "short"
                              ? "SHORT BREAK"
                              : `${state.settings.focus} / ${state.settings.short} MIN RHYTHM`}
                          </>
                        )}
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
                        state.settings.sound
                          ? "Mute check-in sounds"
                          : "Enable check-in sounds"
                      }
                      className={
                        state.settings.sound ? "sound active" : "sound"
                      }
                      onClick={async () => {
                        const sound = !state.settings.sound;
                        if (sound) {
                          const activeCustom =
                            state.settings.customRingtones?.find(
                              (r) => r.id === state.settings.ringtone,
                            )?.data || state.settings.customRingtone;
                          await unlockAudio(activeCustom);
                        }
                        if (
                          await update((s) => {
                            s.settings.sound = sound;
                          })
                        ) {
                          if (!sound) return;
                          try {
                            await previewRingtone({
                              ...state.settings,
                              sound: true,
                            });
                            setNotice(
                              "Sound is on. You should hear a short preview now.",
                            );
                          } catch (error) {
                            setError(
                              error instanceof Error
                                ? error.message
                                : "Sound could not start.",
                            );
                          }
                        }
                      }}
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
                        +{Math.floor(timer.duration / 60000)} XP · Your measured
                        focus time is saved in Progress.
                      </p>
                    </div>
                  </div>
                )}
                <div className="task-card card" data-capybara-obstacle>
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
                  <div className="task-category-wrapper">
                    <select
                      className="task-category-select"
                      aria-label="Focus category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={!!timer && timer.status !== "complete"}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="task-category-chevron"
                      aria-hidden="true"
                    />
                  </div>
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
              <aside className="rhythm card" data-capybara-obstacle>
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
                      <span>Set your rhythm</span>
                      <ArrowRight size={15} />
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
                  <SidebarCompanion
                    pose={
                      phase !== "focus"
                        ? "rest"
                        : timer?.status === "running"
                          ? "study"
                          : "idle"
                    }
                    isFloating={isCompanionFloating}
                    onToggleFloating={handleToggleCompanion}
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
                <div className="journal-controls">
                  <button
                    className="primary compact"
                    onClick={() => setManualJournal("new")}
                  >
                    <Plus size={16} /> Add journal
                  </button>
                  <input
                    aria-label="Journal date"
                    type="date"
                    value={selected}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
              <p>
                Add a note for any open time. Check-ins and manual notes stay
                separate from Focus time, which lives in Progress.
              </p>
              {journalItems.map(({ kind, entry }) =>
                kind === "check-in" ? (
                  <div className="log-row" key={entry.id}>
                    <span className={"timeline-dot " + entry.status}>
                      {entry.status === "logged" ? (
                        <Check size={14} />
                      ) : (
                        <Clock3 size={14} />
                      )}
                    </span>
                    <div>
                      <small>
                        {time(entry.start)} – {time(entry.end)} · Check-in
                      </small>
                      <strong>
                        {entry.activity ||
                          (entry.photo
                            ? "Photo reflection"
                            : entry.status === "pending"
                              ? "Unlogged period"
                              : "Skipped")}
                      </strong>
                      <p>
                        {entry.category}
                        {entry.mood && ` · ${entry.mood}`}
                      </p>
                      {entry.photo && (
                        <a href={entry.photo} target="_blank" rel="noreferrer">
                          <img
                            className="journal-photo"
                            src={entry.photo}
                            alt="Photo of this activity"
                          />
                        </a>
                      )}
                    </div>
                    <div className="log-actions">
                      <button onClick={() => setEditing(entry)}>Edit</button>
                      <button
                        className="danger-link"
                        aria-label="Delete check-in"
                        onClick={() => {
                          if (
                            window.confirm(
                              "Delete this check-in? Its reflection and XP reward will be removed.",
                            )
                          )
                            void update((s) => deleteCheckpoint(s, entry.id));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="log-row" key={entry.id}>
                    <span className="timeline-dot logged">
                      <BookOpen size={14} />
                    </span>
                    <div>
                      <small>
                        {time(entry.start)} – {time(entry.end)} · Journal
                      </small>
                      <strong>{entry.activity || "Photo journal note"}</strong>
                      <p>
                        {entry.category}
                        {entry.mood && ` · ${entry.mood}`}
                      </p>
                      {entry.photo && (
                        <a href={entry.photo} target="_blank" rel="noreferrer">
                          <img
                            className="journal-photo"
                            src={entry.photo}
                            alt="Photo of this journal entry"
                          />
                        </a>
                      )}
                    </div>
                    <div className="log-actions">
                      <button onClick={() => setManualJournal(entry)}>
                        Edit
                      </button>
                      <button
                        className="danger-link"
                        aria-label="Delete journal entry"
                        onClick={() => {
                          if (window.confirm("Delete this journal entry?"))
                            void update((s) => deleteJournalEntry(s, entry.id));
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ),
              )}
              {!journalItems.length && (
                <Empty text="No journal entries here yet. Add a note for an open part of your day." />
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
            data-tab={name}
            data-capybara-target={name === "Focus" ? "nav-focus-mobile" : undefined}
            className={tab === name ? "active" : ""}
            onClick={() => choose(name)}
          >
            <Icon size={21} />
            <span>{name}</span>
          </button>
        ))}
      </nav>
      {isCompanionFloating && !fullscreen && (
        <InteractiveCompanion
          isFloating={true}
          isFullScreen={false}
          onToggleFloating={handleToggleCompanion}
          initialPos={companionDropPos || undefined}
          externalPose={
            phase !== "focus"
              ? "rest"
              : timer?.status === "running"
                ? "study"
                : "idle"
          }
        />
      )}
      {fullscreen && (
        <FullscreenTimer
          state={state}
          now={now}
          error={error}
          close={() => toggleFullscreen(false)}
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
      {manualJournal && (
        <Modal
          title={
            manualJournal === "new" ? "Add to your journal" : "Edit journal"
          }
          close={() => setManualJournal(null)}
        >
          <JournalForm
            state={state}
            date={selected}
            entry={manualJournal === "new" ? undefined : manualJournal}
            onOpenOverlap={(overlap) => {
              if (overlap.kind === "check-in") {
                const checkpoint = state.checkpoints.find(
                  (entry) => entry.id === overlap.id,
                );
                if (checkpoint) setEditing(checkpoint);
                setManualJournal(null);
                return;
              }
              const entry = state.journalEntries.find(
                (journal) => journal.id === overlap.id,
              );
              if (entry) setManualJournal(entry);
            }}
            save={async (entry) => {
              if (
                await update((s) => {
                  if (manualJournal === "new")
                    addJournalEntry(s, entry, Date.now());
                  else editJournalEntry(s, manualJournal.id, entry);
                })
              )
                setManualJournal(null);
            }}
          />
        </Modal>
      )}
      {!state.settings.onboarded && (
        <Modal title="Welcome to your little focus nook.">
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
  close?: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const d = ref.current;
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        if (close) {
          close();
        } else {
          e.preventDefault();
        }
      }}
    >
      <div className="section-title">
        <h2>{title}</h2>
        {close && (
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X />
          </button>
        )}
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
type JournalDraft = Omit<JournalEntry, "id" | "createdAt">;
function JournalForm({
  state,
  date,
  entry,
  save,
  onOpenOverlap,
}: {
  state: State;
  date: string;
  entry?: JournalEntry;
  save: (entry: JournalDraft) => void;
  onOpenOverlap: (
    overlap: Exclude<ReturnType<typeof findJournalOverlap>, undefined>,
  ) => void;
}) {
  const clock = (timestamp: number) => {
    const value = parts(timestamp, state.settings.timezone);
    return `${String(value.hour).padStart(2, "0")}:${String(value.minute).padStart(2, "0")}`;
  };
  const [start, setStart] = useState(entry ? clock(entry.start) : "09:00"),
    [end, setEnd] = useState(entry ? clock(entry.end) : "10:00"),
    [activity, setActivity] = useState(entry?.activity ?? ""),
    [category, setCategory] = useState(entry?.category ?? "Study"),
    [mood, setMood] = useState(entry?.mood ?? ""),
    [photo, setPhoto] = useState(entry?.photo),
    [busy, setBusy] = useState(false),
    [problem, setProblem] = useState<
      ReturnType<typeof findJournalOverlap> | "time" | "note" | null
    >(null);
  const toInstant = (value: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = value.split(":").map(Number);
    return localInstant(
      year,
      month,
      day,
      hour,
      minute,
      state.settings.timezone,
    );
  };
  const overlapText =
    problem && typeof problem === "object"
      ? problem.kind === "check-in"
        ? "This time already has a check-in. Edit it instead."
        : "This time already has a journal entry. Edit it instead."
      : problem === "time"
        ? "Choose an end time after the start time."
        : problem === "note"
          ? "Add a journal note or photo."
          : "";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const startAt = toInstant(start),
          endAt = toInstant(end);
        if (startAt === null || endAt === null || endAt <= startAt) {
          setProblem("time");
          return;
        }
        if (!activity.trim() && !photo) {
          setProblem("note");
          return;
        }
        const overlap = findJournalOverlap(state, startAt, endAt, entry?.id);
        if (overlap) {
          setProblem(overlap);
          return;
        }
        setProblem(null);
        save({ start: startAt, end: endAt, activity, category, mood, photo });
      }}
    >
      {problem && (
        <div className="form-error" role="alert">
          <span>{overlapText}</span>
          {typeof problem === "object" && (
            <button type="button" onClick={() => onOpenOverlap(problem)}>
              Edit existing entry
            </button>
          )}
        </div>
      )}
      <div className="form-grid">
        <label className="field">
          Start time
          <input
            required
            type="time"
            value={start}
            onChange={(event) => {
              setStart(event.target.value);
              setProblem(null);
            }}
          />
        </label>
        <label className="field">
          End time
          <input
            required
            type="time"
            value={end}
            onChange={(event) => {
              setEnd(event.target.value);
              setProblem(null);
            }}
          />
        </label>
      </div>
      <p className="muted">
        {date} · {state.settings.timezone}
      </p>
      <label className="field">
        What happened?
        <textarea
          autoFocus
          required={!photo}
          maxLength={10000}
          placeholder="A few words about this part of your day…"
          value={activity}
          onChange={(event) => {
            setActivity(event.target.value);
            setProblem(null);
          }}
        />
      </label>
      <LogPhoto value={photo} onChange={setPhoto} onBusy={setBusy} />
      <div className="form-grid">
        <Category value={category} onChange={setCategory} />
        <label className="field">
          How did it feel? (optional)
          <select
            value={mood}
            onChange={(event) => setMood(event.target.value)}
          >
            <option value="">No mood selected</option>
            {["Low energy", "Okay", "Good", "Focused"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="actions">
        <button className="primary" disabled={busy}>
          <Check size={17} /> {entry ? "Save changes" : "Add journal"}
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
    [backup, setBackup] = useState<State | null>(null),
    [clearAction, setClearAction] = useState<"day" | "all" | null>(null);
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
              onChange={async (e) => {
                const sound = e.target.checked;
                if (sound) {
                  const activeCustom =
                    state.settings.customRingtones?.find(
                      (r) => r.id === state.settings.ringtone,
                    )?.data || state.settings.customRingtone;
                  await unlockAudio(activeCustom);
                }
                if (
                  await update((s) => {
                    s.settings.sound = sound;
                  })
                ) {
                  if (sound)
                    try {
                      await previewRingtone({ ...state.settings, sound: true });
                      setNotice(
                        "Sound is on. You should hear a short preview now.",
                      );
                    } catch (error) {
                      setError((error as Error).message);
                    }
                }
              }}
            />{" "}
            Play a chime for check-ins
          </label>
          {(() => {
            const customList = [
              ...(state.settings.customRingtones || []),
              ...(state.settings.customRingtone &&
              !state.settings.customRingtones?.some((r) => r.id === "custom")
                ? [
                    {
                      id: "custom",
                      name: "My uploaded audio",
                      data: state.settings.customRingtone,
                    },
                  ]
                : []),
            ];
            const isCustomActive =
              state.settings.ringtone === "custom" ||
              state.settings.ringtone.startsWith("custom-");

            return (
              <>
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
                    <optgroup label="Built-in Ringtones">
                      {ringtones.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                    {customList.length > 0 && (
                      <optgroup label="Uploaded Ringtones">
                        {customList.map((cr) => (
                          <option key={cr.id} value={cr.id}>
                            🎵 {cr.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </label>
                {customList.length > 0 && (
                  <div className="uploaded-ringtones-tray">
                    <span className="tray-label">
                      Uploaded ringtones ({customList.length}):
                    </span>
                    <div className="uploaded-chips">
                      {customList.map((cr) => {
                        const isSelected = state.settings.ringtone === cr.id;
                        return (
                          <div
                            key={cr.id}
                            className={`uploaded-chip ${isSelected ? "is-selected" : ""}`}
                          >
                            <button
                              type="button"
                              className="chip-select-btn"
                              title={`Select "${cr.name}"`}
                              onClick={() => {
                                void update((s) => {
                                  s.settings.ringtone = cr.id;
                                });
                              }}
                            >
                              <Music size={12} />
                              <span>{cr.name}</span>
                            </button>
                            <button
                              type="button"
                              className="chip-remove-btn"
                              title={`Delete "${cr.name}"`}
                              onClick={async (e) => {
                                e.stopPropagation();
                                const oldUrl = cr.data;
                                if (
                                  oldUrl &&
                                  oldUrl.startsWith("pacana://app/audio/") &&
                                  typeof window !== "undefined" &&
                                  (window as any).pacanaDesktop?.deleteAudio
                                ) {
                                  const id = oldUrl.replace(
                                    "pacana://app/audio/",
                                    "",
                                  );
                                  await (window as any).pacanaDesktop
                                    .deleteAudio(id)
                                    .catch(() => {});
                                }
                                await update((s) => {
                                  s.settings.customRingtones = (
                                    s.settings.customRingtones || []
                                  ).filter((r) => r.id !== cr.id);
                                  if (
                                    s.settings.customRingtone &&
                                    cr.id === "custom"
                                  ) {
                                    delete s.settings.customRingtone;
                                  }
                                  if (s.settings.ringtone === cr.id) {
                                    s.settings.ringtone = "classic";
                                  }
                                });
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="ringtone-actions">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await previewRingtone(state.settings);
                      } catch (err) {
                        setError(
                          (err as Error)?.message ||
                            "Sound could not play. Check your browser audio permissions and device volume.",
                        );
                      }
                    }}
                  >
                    <Volume2 size={17} /> Preview ringtone
                  </button>
                  <label className="file-button">
                    <Music size={17} /> Upload audio ringtone
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm,.mp3,.wav,.ogg,.m4a,.webm,.aac,.flac"
                      onChange={async (e) => {
                        try {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          const isAudio =
                            file.type.startsWith("audio/") ||
                            /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(
                              file.name,
                            );

                          if (!isAudio || file.size > 5 * 1024 * 1024)
                            throw new Error(
                              "Choose an audio file (MP3, WAV, OGG, or M4A) under 5 MB.",
                            );

                          const dataUrl = await readAsDataUrl(file);
                          const cleanName =
                            file.name.replace(/\.[^/.]+$/, "").slice(0, 30) ||
                            "Uploaded sound";
                          const newId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
                          const newEntry = {
                            id: newId,
                            name: cleanName,
                            data: dataUrl,
                          };

                          if (
                            await update((s) => {
                              const existing = s.settings.customRingtones || [];
                              s.settings.customRingtones = [
                                ...existing,
                                newEntry,
                              ];
                              s.settings.ringtone = newId;
                              s.settings.sound = true;
                            })
                          ) {
                            await previewRingtone({
                              ...state.settings,
                              ringtone: newId,
                              customRingtones: [
                                ...(state.settings.customRingtones || []),
                                newEntry,
                              ],
                              sound: true,
                            });
                            setNotice(
                              `"${cleanName}" uploaded and added to your ringtones.`,
                            );
                          }
                        } catch (error) {
                          setError((error as Error).message);
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                  {isCustomActive && (
                    <button
                      type="button"
                      className="remove-active-btn"
                      title="Remove currently selected uploaded ringtone"
                      onClick={async () => {
                        const activeId = state.settings.ringtone;
                        await update((s) => {
                          s.settings.customRingtones = (
                            s.settings.customRingtones || []
                          ).filter((r) => r.id !== activeId);
                          if (
                            s.settings.customRingtone &&
                            activeId === "custom"
                          ) {
                            delete s.settings.customRingtone;
                          }
                          s.settings.ringtone = "classic";
                        });
                      }}
                    >
                      <X size={15} /> Remove active
                    </button>
                  )}
                </div>
              </>
            );
          })()}
          <p className="muted">
            Focus and break endings always play this ringtone. Enable check-in
            sounds if you also want a chime when an accountability prompt is
            ready.
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
        <section className="card settings-card reset-card">
          <h2>Reset your journal</h2>
          <p className="muted">
            Journal controls affect only check-ins and reflections. Focus time
            and XP remain in Progress.
          </p>
          <div className="actions">
            <button onClick={() => setClearAction("day")}>
              Clear today’s journal
            </button>
            <button
              className="danger-button"
              onClick={() => setClearAction("all")}
            >
              Reset all progress
            </button>
          </div>
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
      {clearAction && (
        <Modal
          title={
            clearAction === "day"
              ? "Clear today’s journal?"
              : "Reset all Pacana progress?"
          }
          close={() => setClearAction(null)}
        >
          <p>
            {clearAction === "day"
              ? "This removes today’s check-ins and reflections, including their photos and check-in XP. Focus time and progress stay intact."
              : "This removes every focus session, check-in, journal entry, XP reward, and active timer. Your preferences and backup files stay intact."}
          </p>
          <div className="actions">
            <button
              className="danger-button"
              onClick={async () => {
                const done = await update((s) =>
                  clearAction === "day"
                    ? clearDay(
                        s,
                        dayKey(Date.now(), s.settings.timezone),
                        s.settings.timezone,
                      )
                    : resetProgress(s),
                );
                if (done) {
                  setClearAction(null);
                  setNotice(
                    clearAction === "day"
                      ? "Today’s journal has been cleared."
                      : "Progress has been reset.",
                  );
                }
              }}
            >
              {clearAction === "day" ? "Clear today" : "Reset progress"}
            </button>
            <button onClick={() => setClearAction(null)}>Keep my data</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
