import { defaults, type State, type Phase } from "./model";
import { nextClock } from "./schedule";
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
) {
  if (s.timer && s.timer.status !== "complete")
    throw new Error("End the current timer first.");
  const duration = s.settings[phase] * 60000;
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
  return s.timer?.phase === "focus"
    ? s.completedCycle % s.settings.cycles === 0
      ? "long"
      : "short"
    : "focus";
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
export function focusTotal(s: State, from: number, to: number) {
  return s.sessions
    .filter(
      (x) => x.status === "completed" && x.endedAt >= from && x.endedAt < to,
    )
    .reduce((n, x) => n + x.duration, 0);
}
export const totalXP = (s: State) =>
  Object.values(s.rewards).reduce((a, b) => a + b, 0);
