import { defaults, type JournalEntry, type Phase, type State, type Task, type TodayGoal } from "./model";
import { dayKey, nextClock } from "./schedule";
export { defaults };
export const remaining = (s: State, now: number) =>
  s.timer
    ? Math.max(
        0,
        Math.min(
          s.timer.duration,
          s.timer.status === "running"
            ? s.timer.endAt - now
            : s.timer.remaining,
        ),
      )
    : s.settings.focus * 60000;
export function startPhase(
  s: State,
  now: number,
  phase: Phase,
  task = "",
  category = "Study",
  customDurationMs?: number,
) {
  if (s.timer && s.timer.status !== "complete")
    throw new Error("End the current timer first.");
  let duration = customDurationMs;
  if (duration === undefined && task && s.tasks) {
    const matchedTask = s.tasks.find(
      (t) => t.title.trim().toLowerCase() === task.trim().toLowerCase(),
    );
    if (matchedTask) {
      if (phase === "focus" && matchedTask.focusDuration) {
        duration = matchedTask.focusDuration * 60000;
      } else if (phase === "short" && matchedTask.shortBreak) {
        duration = matchedTask.shortBreak * 60000;
      } else if (phase === "long" && matchedTask.longBreak) {
        duration = matchedTask.longBreak * 60000;
      }
    }
  }
  if (duration === undefined) {
    duration = s.settings[phase] * 60000;
  }
  s.timer = {
    id: crypto.randomUUID(),
    phase,
    status: "running",
    startedAt: now,
    endAt: now + duration,
    remaining: duration,
    duration,
    task,
    category,
  };
}
export function nextPhase(s: State): Phase {
  if (s.timer?.phase === "focus") return "short";
  if (s.timer?.phase === "short") {
    const cycleCount =
      s.timer.status === "complete"
        ? s.completedCycle
        : s.completedCycle + 1;
    return cycleCount % s.settings.cycles === 0 ? "long" : "focus";
  }
  return "focus";
}
export function pause(s: State, now: number) {
  if (s.timer?.status === "running") {
    s.timer.remaining = remaining(s, now);
    s.timer.status = "paused";
  }
}
export function resume(s: State, now: number) {
  if (s.timer?.status === "paused") {
    s.timer.endAt = now + s.timer.remaining;
    s.timer.status = "running";
  }
}
export function end(s: State, now: number) {
  const t = s.timer;
  if (!t) return;
  if (t.phase === "focus" && t.status !== "complete")
    s.sessions.push({
      id: t.id,
      startedAt: t.startedAt,
      endedAt: now,
      duration: Math.max(0, t.duration - remaining(s, now)),
      status: "abandoned",
      task: t.task,
      category: t.category,
      note: "",
    });
  if (t.phase === "short" && t.status !== "complete") {
    s.completedCycle++;
  }
  s.timer = null;
}
export function activate(s: State, now: number, mode: "clock" | "elapsed") {
  s.run = {
    id: crypto.randomUUID(),
    mode,
    activatedAt: now,
    previousAt: now,
    nextAt:
      mode === "clock"
        ? nextClock(now, s.schedule, s.settings.timezone)
        : now + s.interval * 60000,
    interval: s.interval,
    timezone: s.settings.timezone,
    schedule: structuredClone(s.schedule),
  };
}
export function changeTimezone(s: State, zone: string, now: number) {
  new Intl.DateTimeFormat("en", { timeZone: zone }).format();
  s.settings.timezone = zone;
  if (s.run?.mode === "clock") {
    s.run.timezone = zone;
    s.run.nextAt = nextClock(now, s.run.schedule, zone);
  }
}
export function reconcile(
  s: State,
  now: number,
  allowAuto = false,
): { completed: boolean; checkpoints: number } {
  let completed = false,
    checkpoints = 0;
  const t = s.timer;
  if (t?.status === "running" && now >= t.endAt) {
    t.status = "complete";
    t.remaining = 0;
    completed = true;
    if (t.phase === "focus" && !s.sessions.some((x) => x.id === t.id)) {
      s.sessions.push({
        id: t.id,
        startedAt: t.startedAt,
        endedAt: t.endAt,
        duration: t.duration,
        status: "completed",
        task: t.task,
        category: t.category,
        note: "",
      });
      s.rewards[`focus:${t.id}`] = Math.floor(t.duration / 60000);
      recordTaskFocus(s, t.task, Math.floor(t.duration / 1000));
    }
    if (t.phase === "short") {
      s.completedCycle++;
    }
    const auto =
      t.phase === "focus" ? s.settings.autoBreak : s.settings.autoFocus;
    if (auto && allowAuto && now - t.endAt < 2500)
      startPhase(s, now, nextPhase(s), t.task, t.category);
  }
  const r = s.run;
  // Bounded batches recover arbitrarily long absences without blocking the interface.
  while (r && r.nextAt <= now && checkpoints < 500) {
    const id = `${r.id}:${r.nextAt}`;
    if (!s.checkpoints.some((x) => x.id === id))
      s.checkpoints.push({
        id,
        runId: r.id,
        start: r.previousAt,
        end: r.nextAt,
        status: "pending",
        activity: "",
        category: "Study",
        mood: "",
      });
    r.previousAt = r.nextAt;
    r.nextAt =
      r.mode === "elapsed"
        ? r.nextAt + r.interval * 60000
        : nextClock(r.nextAt, r.schedule, r.timezone);
    checkpoints++;
  }
  return { completed, checkpoints };
}
export function logCheckpoint(
  s: State,
  id: string,
  activity: string,
  category: string,
  mood: string,
  now: number,
  skip = false,
  photo?: string,
) {
  const c = s.checkpoints.find((x) => x.id === id);
  if (!c) throw new Error("Checkpoint no longer exists.");
  if (!skip && !activity.trim() && !photo)
    throw new Error("Add a short activity note or photo.");
  Object.assign(c, {
    activity: activity.trim(),
    category,
    mood,
    status: skip ? "skipped" : "logged",
    loggedAt: now,
  });
  if (!skip && photo) c.photo = photo;
  else delete c.photo;
  if (!skip && !Object.hasOwn(s.rewards, `check:${id}`))
    s.rewards[`check:${id}`] = 5;
}
export function deleteSession(s: State, id: string) {
  const index = s.sessions.findIndex((session) => session.id === id);
  if (index < 0) throw new Error("Session no longer exists.");
  s.sessions.splice(index, 1);
  delete s.rewards[`focus:${id}`];
}
export function deleteCheckpoint(s: State, id: string) {
  const index = s.checkpoints.findIndex((checkpoint) => checkpoint.id === id);
  if (index < 0) throw new Error("Check-in no longer exists.");
  s.checkpoints.splice(index, 1);
  delete s.rewards[`check:${id}`];
}
export type JournalOverlap =
  { kind: "check-in"; id: string } | { kind: "journal"; id: string };
export function findJournalOverlap(
  s: State,
  start: number,
  end: number,
  ignoreId?: string,
): JournalOverlap | undefined {
  const overlaps = (entry: { id: string; start: number; end: number }) =>
    entry.id !== ignoreId && start < entry.end && end > entry.start;
  const checkpoint = s.checkpoints.find(overlaps);
  if (checkpoint) return { kind: "check-in", id: checkpoint.id };
  const journal = s.journalEntries.find(overlaps);
  return journal ? { kind: "journal", id: journal.id } : undefined;
}
function assertJournalEntry(
  s: State,
  start: number,
  end: number,
  activity: string,
  photo: string | undefined,
  ignoreId?: string,
) {
  if (end <= start) throw new Error("End time must be after start time.");
  if (!activity.trim() && !photo)
    throw new Error("Add a journal note or photo.");
  if (findJournalOverlap(s, start, end, ignoreId))
    throw new Error(
      "That time is already recorded. Edit the existing entry instead.",
    );
}
export function addJournalEntry(
  s: State,
  entry: Omit<JournalEntry, "id" | "createdAt">,
  now: number,
) {
  assertJournalEntry(s, entry.start, entry.end, entry.activity, entry.photo);
  s.journalEntries.push({
    ...entry,
    id: crypto.randomUUID(),
    activity: entry.activity.trim(),
    createdAt: now,
  });
}
export function editJournalEntry(
  s: State,
  id: string,
  entry: Omit<JournalEntry, "id" | "createdAt">,
) {
  const journal = s.journalEntries.find((x) => x.id === id);
  if (!journal) throw new Error("Journal entry no longer exists.");
  assertJournalEntry(
    s,
    entry.start,
    entry.end,
    entry.activity,
    entry.photo,
    id,
  );
  Object.assign(journal, { ...entry, activity: entry.activity.trim() });
}
export function deleteJournalEntry(s: State, id: string) {
  const index = s.journalEntries.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error("Journal entry no longer exists.");
  s.journalEntries.splice(index, 1);
}
export function clearDay(s: State, date: string, timezone: string) {
  for (const checkpoint of s.checkpoints)
    if (dayKey(checkpoint.end, timezone) === date)
      delete s.rewards[`check:${checkpoint.id}`];
  s.checkpoints = s.checkpoints.filter(
    (checkpoint) => dayKey(checkpoint.end, timezone) !== date,
  );
  s.journalEntries = s.journalEntries.filter(
    (entry) => dayKey(entry.end, timezone) !== date,
  );
}
export function resetProgress(s: State) {
  s.timer = null;
  s.run = null;
  s.completedCycle = 0;
  s.sessions = [];
  s.checkpoints = [];
  s.journalEntries = [];
  s.rewards = {};
}
export function focusTotal(s: State, from: number, to: number) {
  return s.sessions
    .filter(
      (x) => x.status === "completed" && x.endedAt >= from && x.endedAt < to,
    )
    .reduce((n, x) => n + x.duration, 0);
}
export const totalXP = (s: State) =>
  Object.values(s.rewards).reduce((a, b) => a + b, 0);

export function getTasks(s: State): Task[] {
  return s.tasks || [];
}

export function addTask(
  s: State,
  task: Omit<Task, "id" | "createdAt" | "completedSessions" | "totalFocusSeconds" | "completed" | "order"> & {
    id?: string;
    createdAt?: number;
    completedSessions?: number;
    totalFocusSeconds?: number;
    completed?: boolean;
    order?: number;
  },
  now = Date.now(),
) {
  if (!s.tasks) s.tasks = [];
  const newTask: Task = {
    id: task.id || crypto.randomUUID(),
    title: task.title.trim(),
    category: task.category || "Study",
    priority: task.priority || "medium",
    dueDate: task.dueDate,
    estimatedSessions: task.estimatedSessions ?? 2,
    completedSessions: task.completedSessions ?? 0,
    totalFocusSeconds: task.totalFocusSeconds ?? 0,
    completed: task.completed ?? false,
    createdAt: task.createdAt ?? now,
    order: task.order ?? s.tasks.length,
    focusDuration: task.focusDuration,
    shortBreak: task.shortBreak,
    longBreak: task.longBreak,
  };
  s.tasks.push(newTask);
  return newTask;
}

export function updateTask(s: State, id: string, updates: Partial<Task>) {
  if (!s.tasks) s.tasks = [];
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return;
  Object.assign(t, updates);
  if (updates.title) t.title = updates.title.trim();
}

export function toggleTask(s: State, id: string, now = Date.now()) {
  if (!s.tasks) s.tasks = [];
  const t = s.tasks.find((x) => x.id === id);
  if (!t) return;
  t.completed = !t.completed;
  t.completedAt = t.completed ? now : undefined;
}

export function deleteTask(s: State, id: string) {
  if (!s.tasks) s.tasks = [];
  const index = s.tasks.findIndex((x) => x.id === id);
  if (index >= 0) {
    s.tasks.splice(index, 1);
  }
}

export function setTodayGoal(s: State, goal: Partial<TodayGoal>) {
  if (!s.todayGoal) {
    s.todayGoal = {
      title: "Finish my lab report",
      completed: false,
      targetSessions: 4,
      quote: "Discipline today, results tomorrow.",
    };
  }
  Object.assign(s.todayGoal, goal);
  if (goal.title) s.todayGoal.title = goal.title.trim();
}

export function recordTaskFocus(s: State, taskTitle: string, durationSeconds: number) {
  if (!taskTitle || !s.tasks) return;
  const t = s.tasks.find(
    (x) => x.title.trim().toLowerCase() === taskTitle.trim().toLowerCase(),
  );
  if (t) {
    t.totalFocusSeconds += durationSeconds;
    t.completedSessions += 1;
    if (t.estimatedSessions && t.completedSessions >= t.estimatedSessions && !t.completed) {
      t.completed = true;
      t.completedAt = Date.now();
    }
  }
}
