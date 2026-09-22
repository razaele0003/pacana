import type { Ringtone } from "./ringtones";
export type Phase = "focus" | "short" | "long";
export type CustomRingtone = {
  id: string;
  name: string;
  data: string;
  duration?: number;
};
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
  customRingtones?: CustomRingtone[];
  ringtoneFavorites?: string[];
  recentRingtones?: string[];
  autoPromptCheckin?: boolean;
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
export type TaskPriority = "low" | "medium" | "high";
export type Task = {
  id: string;
  title: string;
  category?: string;
  priority?: TaskPriority;
  dueDate?: string;
  estimatedSessions?: number;
  completedSessions: number;
  totalFocusSeconds: number;
  completed: boolean;
  completedAt?: number;
  createdAt: number;
  order: number;
  focusDuration?: number;
  shortBreak?: number;
  longBreak?: number;
};
export type TodayGoal = {
  title: string;
  completed: boolean;
  targetSessions?: number;
  quote?: string;
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
  tasks?: Task[];
  todayGoal?: TodayGoal;
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
    customRingtones: [],
    ringtoneFavorites: [],
    recentRingtones: [],
    autoPromptCheckin: true,
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
  tasks: [
    {
      id: "default-task-1",
      title: "Finish my lab report",
      category: "Study",
      priority: "high",
      estimatedSessions: 4,
      completedSessions: 0,
      totalFocusSeconds: 0,
      completed: false,
      createdAt: 1774200000000,
      order: 0,
    },
    {
      id: "default-task-2",
      title: "Review MOSFET notes",
      category: "Study",
      priority: "medium",
      estimatedSessions: 2,
      completedSessions: 0,
      totalFocusSeconds: 0,
      completed: false,
      createdAt: 1774200000001,
      order: 1,
    },
    {
      id: "default-task-3",
      title: "Fix Pacana animation",
      category: "Project",
      priority: "medium",
      estimatedSessions: 3,
      completedSessions: 1,
      totalFocusSeconds: 1500,
      completed: false,
      createdAt: 1774200000002,
      order: 2,
    },
    {
      id: "default-task-4",
      title: "Do OJT liquidation",
      category: "Work",
      priority: "low",
      estimatedSessions: 2,
      completedSessions: 0,
      totalFocusSeconds: 0,
      completed: false,
      createdAt: 1774200000003,
      order: 3,
    },
  ],
  todayGoal: {
    title: "Finish my lab report",
    completed: false,
    targetSessions: 4,
    quote: "Discipline today, results tomorrow.",
  },
  revision: 0,
});
