import { z } from "zod";
import type { State } from "../core/model";
const timestamp = z.number().finite().nonnegative().max(8640000000000000);
const positive = z.number().int().min(1).max(1440);
const photo = z
  .string()
  .max(1500000)
  .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/)
  .optional();
const customRingtoneData = z
  .string()
  .max(8000000)
  .regex(
    /^(?:data:audio\/(?:mpeg|wav|ogg|mp4|webm|x-m4a|aac|flac|mp3|x-wav);base64,[A-Za-z0-9+/]+={0,2}|pacana:\/\/app\/audio\/[a-zA-Z0-9_\-\.]+)$/,
  );
const customRingtoneItem = z.object({
  id: z.string().max(100),
  name: z.string().max(100),
  data: customRingtoneData,
  duration: z.number().min(0).max(3600).optional(),
});
const customRingtone = customRingtoneData.optional();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const timezone = z.string().refine((v) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: v });
    return true;
  } catch {
    return false;
  }
}, "Invalid timezone");
const schedule = z
  .object({
    start: clock,
    end: clock,
    interval: positive,
    days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    explicit: z.array(clock).max(1440),
  })
  .refine(
    (v) => v.explicit.length > 0 || v.end >= v.start,
    "End time must follow start time",
  );
const taskPriority = z.enum(["low", "medium", "high"]);
const taskItem = z.object({
  id: z.string(),
  title: z.string().max(1000),
  category: z.string().max(100).optional(),
  priority: taskPriority.optional(),
  dueDate: z.string().max(100).optional(),
  estimatedSessions: z.number().int().min(1).max(100).optional(),
  completedSessions: z.number().int().nonnegative(),
  totalFocusSeconds: z.number().int().nonnegative(),
  completed: z.boolean(),
  completedAt: timestamp.optional(),
  createdAt: timestamp,
  order: z.number().int().nonnegative(),
  focusDuration: z.number().int().min(1).max(180).optional(),
  shortBreak: z.number().int().min(1).max(60).optional(),
  longBreak: z.number().int().min(1).max(60).optional(),
});
const todayGoalSchema = z.object({
  title: z.string().max(1000),
  completed: z.boolean(),
  targetSessions: z.number().int().min(1).max(100).optional(),
  quote: z.string().max(1000).optional(),
});
const schema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  settings: z.object({
    focus: positive,
    short: positive,
    long: positive,
    cycles: z.number().int().min(1).max(24),
    autoBreak: z.boolean(),
    autoFocus: z.boolean(),
    timezone,
    sound: z.boolean(),
    ringtone: z
      .string()
      .max(100)
      .refine(
        (v) =>
          [
            "classic",
            "woodland",
            "raindrop",
            "sunrise",
            "bright-bell",
            "morning-call",
            "focus-alarm",
            "ulah-oscar",
            "custom",
          ].includes(v) || v.startsWith("custom-"),
        "Invalid ringtone",
      )
      .default("classic"),
    customRingtone,
    customRingtones: z.array(customRingtoneItem).max(50).optional().default([]),
    ringtoneFavorites: z.array(z.string().max(100)).max(100).optional().default([]),
    recentRingtones: z.array(z.string().max(100)).max(20).optional().default([]),
    autoPromptCheckin: z.boolean().optional().default(true),
    notifications: z.boolean(),
    onboarded: z.boolean(),
  }),
  timer: z
    .object({
      id: z.string(),
      phase: z.enum(["focus", "short", "long"]),
      status: z.enum(["running", "paused", "complete"]),
      startedAt: timestamp,
      endAt: timestamp,
      remaining: timestamp,
      duration: timestamp,
      task: z.string().max(1000),
      category: z.string().max(100),
    })
    .refine(
      (t) =>
        t.duration > 0 && t.remaining <= t.duration && t.endAt >= t.startedAt,
    )
    .nullable(),
  completedCycle: z.number().int().nonnegative(),
  schedule,
  interval: positive,
  run: z
    .object({
      id: z.string(),
      mode: z.enum(["clock", "elapsed"]),
      activatedAt: timestamp,
      previousAt: timestamp,
      nextAt: timestamp,
      interval: positive,
      timezone,
      schedule,
    })
    .refine((r) => r.nextAt > r.previousAt && r.previousAt >= r.activatedAt)
    .nullable(),
  sessions: z
    .array(
      z
        .object({
          id: z.string(),
          startedAt: timestamp,
          endedAt: timestamp,
          duration: timestamp,
          status: z.enum(["completed", "abandoned"]),
          task: z.string().max(1000),
          category: z.string().max(100),
          note: z.string().max(10000),
          photo,
        })
        .refine(
          (s) =>
            s.endedAt >= s.startedAt && s.duration <= s.endedAt - s.startedAt,
        ),
    )
    .max(100000),
  checkpoints: z
    .array(
      z
        .object({
          id: z.string(),
          runId: z.string(),
          start: timestamp,
          end: timestamp,
          status: z.enum(["pending", "logged", "skipped"]),
          activity: z.string().max(10000),
          category: z.string().max(100),
          mood: z.string().max(100),
          loggedAt: timestamp.optional(),
          photo,
        })
        .refine((c) => c.end > c.start),
    )
    .max(100000),
  journalEntries: z
    .array(
      z
        .object({
          id: z.string(),
          start: timestamp,
          end: timestamp,
          activity: z.string().max(10000),
          category: z.string().max(100),
          mood: z.string().max(100),
          createdAt: timestamp,
          photo,
        })
        .refine((entry) => entry.end > entry.start),
    )
    .max(100000)
    .default([]),
  rewards: z.record(z.number().int().nonnegative()),
  tasks: z.array(taskItem).max(10000).optional().default([]),
  todayGoal: todayGoalSchema.optional(),
});
export function parseBackup(input: unknown): State {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new Error(
      "This backup is invalid or uses an unsupported version. Your current data is unchanged.",
    );
  const s = result.data;
  if (
    new Set(s.sessions.map((x) => x.id)).size !== s.sessions.length ||
    new Set(s.checkpoints.map((x) => x.id)).size !== s.checkpoints.length ||
    new Set(s.journalEntries.map((x) => x.id)).size !== s.journalEntries.length ||
    (s.tasks && new Set(s.tasks.map((x) => x.id)).size !== s.tasks.length)
  )
    throw new Error("Backup contains duplicate records.");
  const journalIntervals = [...s.checkpoints, ...s.journalEntries].sort(
    (a, b) => a.start - b.start || a.end - b.end,
  );
  for (let index = 1; index < journalIntervals.length; index++)
    if (journalIntervals[index].start < journalIntervals[index - 1].end)
      throw new Error("Backup contains overlapping journal time.");
  for (const [key, value] of Object.entries(s.rewards)) {
    if (key.startsWith("focus:")) {
      const session = s.sessions.find((x) => `focus:${x.id}` === key);
      if (
        !session ||
        session.status !== "completed" ||
        value !== Math.floor(session.duration / 60000)
      )
        throw new Error("Invalid focus reward in backup.");
    } else if (key.startsWith("check:")) {
      if (
        value !== 5 ||
        !s.checkpoints.some(
          (x) => `check:${x.id}` === key && x.loggedAt !== undefined,
        )
      )
        throw new Error("Invalid checkpoint reward in backup.");
    } else throw new Error("Unknown reward in backup.");
  }
  return s;
}
