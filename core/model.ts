import type { Ringtone } from "./ringtones";
export type Phase = "focus" | "short" | "long";
export type Settings = {
  focus: number;
  short: number;
  long: number;
  cycles: number;
  autoBreak: boolean;
  autoFocus: boolean;
  timezone: string;
  sound: boolean;
  ringtone: Ringtone;
  customRingtone?: string;
  notifications: boolean;
  onboarded: boolean;
};
export type Timer = {
  id: string;
  phase: Phase;
  status: "running" | "paused" | "complete";
  startedAt: number;
  endAt: number;
  remaining: number;
  duration: number;
  task: string;
  category: string;
};
export type Session = {
  id: string;
  startedAt: number;
  endedAt: number;
  duration: number;
  status: "completed" | "abandoned";
  task: string;
  category: string;
  note: string;
  photo?: string;
};
export type Schedule = {
  start: string;
  end: string;
  interval: number;
  days: number[];
  explicit: string[];
};
export type Run = {
  id: string;
  mode: "clock" | "elapsed";
  activatedAt: number;
  previousAt: number;
  nextAt: number;
  interval: number;
  timezone: string;
  schedule: Schedule;
};
export type Checkpoint = {
  id: string;
  runId: string;
  start: number;
  end: number;
  status: "pending" | "logged" | "skipped";
  activity: string;
  category: string;
  mood: string;
  loggedAt?: number;
  photo?: string;
};
export type JournalEntry = {
  id: string;
  start: number;
  end: number;
  activity: string;
  category: string;
  mood: string;
  createdAt: number;
  photo?: string;
};
export type State = {
  version: 1;
  settings: Settings;
  timer: Timer | null;
  completedCycle: number;
  sessions: Session[];
  schedule: Schedule;
  interval: number;
  run: Run | null;
  checkpoints: Checkpoint[];
  journalEntries: JournalEntry[];
  rewards: Record<string, number>;
  revision: number;
};
export const defaults = (timezone = "Asia/Manila"): State => ({
  version: 1,
  settings: {
    focus: 25,
    short: 5,
    long: 15,
    cycles: 4,
    autoBreak: true,
    autoFocus: true,
    timezone,
    sound: false,
    ringtone: "classic",
    notifications: false,
    onboarded: false,
  },
  timer: null,
  completedCycle: 0,
  sessions: [],
  schedule: {
    start: "06:00",
    end: "22:00",
    interval: 60,
    days: [1, 2, 3, 4, 5],
    explicit: [],
  },
  interval: 10,
  run: null,
  checkpoints: [],
  journalEntries: [],
  rewards: {},
  revision: 0,
});
