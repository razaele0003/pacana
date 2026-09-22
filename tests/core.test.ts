import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  startPhase,
  pause,
  resume,
  end,
  reconcile,
  activate,
  logCheckpoint,
  totalXP,
  remaining,
  nextPhase,
  changeTimezone,
  clearDay,
  deleteCheckpoint,
  addJournalEntry,
  editJournalEntry,
  findJournalOverlap,
  deleteSession,
  resetProgress,
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
  setTodayGoal,
  recordTaskFocus,
} from "../core/engine";
import { nextClock, localInstant } from "../core/schedule";
import { parseBackup } from "../data/backup";
test("photo-only reflections restore completely and edits do not duplicate XP", () => {
  const s = defaults();
  s.checkpoints.push({
    id: "photo",
    runId: "run",
    start: 0,
    end: 60000,
    status: "pending",
    activity: "",
    category: "Study",
    mood: "",
  });
  const photo = "data:image/jpeg;base64,/9j/2Q==";
  logCheckpoint(s, "photo", "", "Study", "", 60001, false, photo);
  assert.equal(totalXP(s), 5);
  logCheckpoint(s, "photo", "Updated", "Study", "", 60002, false, photo);
  assert.equal(totalXP(s), 5);
  assert.equal(
    parseBackup(JSON.parse(JSON.stringify(s))).checkpoints[0].photo,
    photo,
  );
  s.checkpoints[0].photo = "data:image/svg+xml;base64,PHN2Zz4=";
  assert.throws(() => parseBackup(s));
});
test("ringtone preferences preserve old journals and round-trip through backup", () => {
  const old = JSON.parse(JSON.stringify(defaults()));
  delete old.settings.ringtone;
  delete old.journalEntries;
  assert.equal(parseBackup(old).settings.ringtone, "classic");
  assert.equal(parseBackup(old).settings.autoPromptCheckin, true);
  assert.deepEqual(parseBackup(old).journalEntries, []);
  const disabledPromptState = defaults();
  disabledPromptState.settings.autoPromptCheckin = false;
  assert.equal(
    parseBackup(JSON.parse(JSON.stringify(disabledPromptState))).settings.autoPromptCheckin,
    false,
  );
  for (const ringtone of [
    "classic",
    "woodland",
    "raindrop",
    "sunrise",
    "bright-bell",
    "morning-call",
    "focus-alarm",
    "ulah-oscar",
  ] as const) {
    const s = defaults();
    s.settings.ringtone = ringtone;
    assert.equal(
      parseBackup(JSON.parse(JSON.stringify(s))).settings.ringtone,
      ringtone,
    );
  }
  old.settings.ringtone = "invalid";
  assert.throws(() => parseBackup(old));
});
test("custom ringtones validate and preserve through backup", () => {
  const state = defaults();
  state.settings.ringtone = "custom";
  state.settings.customRingtone = "data:audio/mpeg;base64,AA==";
  assert.equal(parseBackup(structuredClone(state)).settings.ringtone, "custom");
  state.settings.customRingtone = "data:text/plain;base64,AA==";
  assert.throws(() => parseBackup(state));

  // Test multiple custom ringtones array and desktop pacana:// audio URL support
  const multiState = defaults();
  multiState.settings.ringtone = "custom-1";
  multiState.settings.customRingtones = [
    { id: "custom-1", name: "Chime 1", data: "data:audio/wav;base64,AA==" },
    { id: "custom-2", name: "Desktop Sound", data: "pacana://app/audio/ringtone-123.mp3" },
  ];
  const parsed = parseBackup(structuredClone(multiState));
  assert.equal(parsed.settings.ringtone, "custom-1");
  assert.equal(parsed.settings.customRingtones?.length, 2);
  assert.equal(parsed.settings.customRingtones?.[1].data, "pacana://app/audio/ringtone-123.mp3");
});
test("deleting records and clearing a journal day preserves focus progress", () => {
  const state = defaults("UTC");
  state.sessions.push({
    id: "session",
    startedAt: 0,
    endedAt: 60_000,
    duration: 60_000,
    status: "completed",
    task: "",
    category: "Study",
    note: "",
  });
  state.checkpoints.push({
    id: "checkpoint",
    runId: "run",
    start: 0,
    end: 60_000,
    status: "logged",
    activity: "Read",
    category: "Study",
    mood: "",
    loggedAt: 60_001,
  });
  state.rewards = { "focus:session": 1, "check:checkpoint": 5 };
  deleteSession(state, "session");
  assert.equal(totalXP(state), 5);
  deleteCheckpoint(state, "checkpoint");
  assert.equal(totalXP(state), 0);
  state.sessions.push({
    id: "today",
    startedAt: 0,
    endedAt: 60_000,
    duration: 60_000,
    status: "completed",
    task: "",
    category: "Study",
    note: "",
  });
  state.rewards["focus:today"] = 1;
  clearDay(state, "1970-01-01", "UTC");
  assert.equal(state.sessions.length, 1);
  assert.equal(totalXP(state), 1);
  resetProgress(state);
  assert.deepEqual(state.rewards, {});
});
test("manual journal entries occupy open time and require edits for overlaps", () => {
  const state = defaults("UTC");
  addJournalEntry(
    state,
    {
      start: 60_000,
      end: 120_000,
      activity: "Planned the day",
      category: "Work",
      mood: "Focused",
    },
    1,
  );
  assert.equal(state.journalEntries.length, 1);
  assert.deepEqual(findJournalOverlap(state, 90_000, 150_000), {
    kind: "journal",
    id: state.journalEntries[0].id,
  });
  assert.throws(
    () =>
      addJournalEntry(
        state,
        {
          start: 90_000,
          end: 150_000,
          activity: "Overlaps",
          category: "Work",
          mood: "",
        },
        2,
      ),
    /already recorded/,
  );
  state.checkpoints.push({
    id: "check-in",
    runId: "run",
    start: 180_000,
    end: 240_000,
    status: "pending",
    activity: "",
    category: "Study",
    mood: "",
  });
  assert.deepEqual(findJournalOverlap(state, 200_000, 210_000), {
    kind: "check-in",
    id: "check-in",
  });
  editJournalEntry(state, state.journalEntries[0].id, {
    start: 120_000,
    end: 180_000,
    activity: "Moved the plan",
    category: "Work",
    mood: "Good",
  });
  assert.equal(state.journalEntries[0].activity, "Moved the plan");
  assert.equal(Object.keys(state.rewards).length, 0);
  assert.equal(
    parseBackup(JSON.parse(JSON.stringify(state))).journalEntries[0].activity,
    "Moved the plan",
  );
});
import "fake-indexeddb/auto";
import { transact, restore } from "../data/store";
import {
  enableNotifications,
  alertUser,
  shouldPlayRingtone,
} from "../adapters/browser";
const t = (v: string) => Date.parse(v);
test("clock activation creates only a future checkpoint and exact logged periods", () => {
  const s = defaults();
  const start = t("2026-09-10T06:58:00+08:00");
  activate(s, start, "clock");
  assert.equal(s.run!.nextAt, t("2026-09-10T07:00:00+08:00"));
  reconcile(s, t("2026-09-10T09:00:00+08:00"));
  assert.deepEqual(
    s.checkpoints.map((c) => [c.start, c.end]),
    [
      [start, t("2026-09-10T07:00:00+08:00")],
      [t("2026-09-10T07:00:00+08:00"), t("2026-09-10T08:00:00+08:00")],
      [t("2026-09-10T08:00:00+08:00"), t("2026-09-10T09:00:00+08:00")],
    ],
  );
});
test("exact clock boundary is strictly future", () => {
  const s = defaults();
  activate(s, t("2026-09-10T07:00:00+08:00"), "clock");
  assert.equal(s.run!.nextAt, t("2026-09-10T08:00:00+08:00"));
});
test("Start Now preserves milliseconds and cadence after late logging", () => {
  const s = defaults();
  const start = t("2026-09-10T06:58:13.427+08:00");
  activate(s, start, "elapsed");
  reconcile(s, start + 31 * 60000);
  assert.deepEqual(
    s.checkpoints.map((c) => c.end),
    [10, 20, 30].map((m) => start + m * 60000),
  );
  logCheckpoint(
    s,
    s.checkpoints[0].id,
    "Read",
    "Study",
    "Good",
    start + 32 * 60000,
  );
  assert.equal(s.run!.nextAt, start + 40 * 60000);
});
test("paused time is excluded and deadline survives serialization", () => {
  let s = defaults();
  s.settings.focus = 2;
  startPhase(s, 100000, "focus");
  pause(s, 160000);
  assert.equal(remaining(s, 500000), 60000);
  s = parseBackup(JSON.parse(JSON.stringify(s)));
  resume(s, 500000);
  assert.equal(s.timer!.endAt, 560000);
  reconcile(s, 560000);
  assert.equal(s.sessions[0].duration, 120000);
  assert.equal(totalXP(s), 2);
});
test("abandoned sessions earn no XP", () => {
  const s = defaults();
  startPhase(s, 100000, "focus");
  end(s, 220000);
  assert.equal(s.sessions[0].status, "abandoned");
  assert.equal(totalXP(s), 0);
});
test("suspension completes one phase, never creates phantom sessions", () => {
  const s = defaults();
  s.settings.autoBreak = true;
  s.settings.autoFocus = true;
  startPhase(s, 100000, "focus");
  reconcile(s, 100000 + 86400000, false);
  assert.equal(s.sessions.length, 1);
  assert.equal(s.timer!.status, "complete");
  reconcile(s, 100000 + 2 * 86400000);
  assert.equal(s.sessions.length, 1);
  assert.equal(totalXP(s), 25);
});
test("continuous auto-start transitions and long break cycle", () => {
  const s = defaults();
  s.settings.focus = 1;
  s.settings.short = 1;
  s.settings.long = 1;
  s.settings.cycles = 1;
  s.settings.autoBreak = true;
  s.settings.autoFocus = true;
  startPhase(s, 100000, "focus");
  reconcile(s, 160000, true);
  assert.equal(s.timer!.phase, "short");
  assert.equal(s.timer!.status, "running");
  assert.equal(s.completedCycle, 0);
  reconcile(s, 220000, true);
  assert.equal(s.timer!.phase, "long");
  assert.equal(s.timer!.status, "running");
  assert.equal(s.completedCycle, 1);
  assert.equal(nextPhase(s), "focus");
});
test("1 session is 1 focus + 1 short break across a 4-session cycle", () => {
  const s = defaults();
  s.settings.focus = 25;
  s.settings.short = 5;
  s.settings.long = 15;
  s.settings.cycles = 4;
  s.settings.autoBreak = true;
  s.settings.autoFocus = true;

  let now = 1000;
  for (let session = 1; session <= 4; session++) {
    if (session === 1) {
      startPhase(s, now, "focus");
    }
    assert.equal(s.timer!.phase, "focus");
    assert.equal((s.completedCycle % s.settings.cycles) + 1, session);

    now += 25 * 60000;
    reconcile(s, now, true);

    assert.equal(s.timer!.phase, "short");
    assert.equal((s.completedCycle % s.settings.cycles) + 1, session);

    now += 5 * 60000;
    reconcile(s, now, true);

    if (session < 4) {
      assert.equal(s.timer!.phase, "focus");
      assert.equal((s.completedCycle % s.settings.cycles) + 1, session + 1);
    } else {
      assert.equal(s.timer!.phase, "long");
      assert.equal(s.completedCycle, 4);
      assert.equal(nextPhase(s), "focus");
    }
  }

  now += 15 * 60000;
  reconcile(s, now, true);
  assert.equal(s.timer!.phase, "focus");
  assert.equal((s.completedCycle % s.settings.cycles) + 1, 1);
});
test("reconciliation and checkpoint edits are idempotent", () => {
  const s = defaults();
  activate(s, 100000, "elapsed");
  reconcile(s, 700000);
  reconcile(s, 700000);
  assert.equal(s.checkpoints.length, 1);
  const c = s.checkpoints[0];
  logCheckpoint(s, c.id, "Work", "Work", "", 710000);
  logCheckpoint(s, c.id, "Edit", "Study", "", 720000);
  assert.equal(totalXP(s), 5);
  logCheckpoint(s, c.id, "", "Study", "", 730000, true);
  assert.equal(totalXP(s), 5);
  assert.doesNotThrow(() => parseBackup(s));
});
test("skip and self-reported time do not earn focus XP", () => {
  const s = defaults();
  activate(s, 100000, "elapsed");
  reconcile(s, 700000);
  logCheckpoint(s, s.checkpoints[0].id, "", "Study", "", 700001, true);
  assert.equal(totalXP(s), 0);
});
test("DST gap is skipped and fold emits once", () => {
  assert.equal(localInstant(2026, 3, 8, 2, 30, "America/New_York"), null);
  assert.equal(
    localInstant(2026, 11, 1, 1, 30, "America/New_York"),
    t("2026-11-01T05:30:00Z"),
  );
  const schedule = {
    start: "01:00",
    end: "03:00",
    interval: 30,
    days: [0],
    explicit: ["01:30"],
  };
  assert.equal(
    nextClock(t("2026-11-01T05:30:00Z"), schedule, "America/New_York"),
    t("2026-11-08T06:30:00Z"),
  );
});
test("weekdays, explicit times, midnight and timezone change preserve history", () => {
  const s = defaults();
  s.schedule = {
    start: "00:00",
    end: "23:59",
    interval: 60,
    days: [0, 1, 2, 3, 4, 5, 6],
    explicit: ["00:00", "09:30"],
  };
  activate(s, t("2026-09-10T23:59:00+08:00"), "clock");
  reconcile(s, t("2026-09-11T00:00:00+08:00"));
  const old = JSON.stringify(s.checkpoints);
  changeTimezone(s, "America/New_York", t("2026-09-11T00:00:00+08:00"));
  assert.equal(JSON.stringify(s.checkpoints), old);
  assert.ok(s.run!.nextAt > t("2026-09-11T00:00:00+08:00"));
});
test("focus and accountability coexist without interruption", () => {
  const s = defaults();
  startPhase(s, 100000, "focus");
  activate(s, 100000, "elapsed");
  reconcile(s, 700000);
  assert.equal(s.timer!.status, "running");
  assert.equal(s.checkpoints.length, 1);
});
test("backup rejects malformed versions, impossible periods, duplicate IDs and fabricated rewards", () => {
  assert.throws(() => parseBackup({ version: 2 }));
  const s = defaults();
  s.rewards["focus:fake"] = 100;
  assert.throws(() => parseBackup(s));
  delete s.rewards["focus:fake"];
  activate(s, 100000, "elapsed");
  reconcile(s, 700000);
  s.checkpoints.push({ ...s.checkpoints[0] });
  assert.throws(() => parseBackup(s));
});
test("focus rewards are rounded down from measured duration", () => {
  const s = defaults();
  startPhase(s, 100000, "focus");
  s.timer!.duration = 90500;
  s.timer!.endAt = 190500;
  s.timer!.remaining = 90500;
  reconcile(s, 200000);
  assert.equal(totalXP(s), 1);
});
test("IndexedDB serializes concurrent clients and persists exactly one event and reward", async () => {
  await restore(defaults());
  await transact((s) => {
    activate(s, 100000, "elapsed");
  });
  await Promise.all(
    Array.from({ length: 8 }, () => transact((s) => reconcile(s, 700000))),
  );
  let { state: s } = await transact(() => {});
  assert.equal(s.checkpoints.length, 1);
  await Promise.all(
    Array.from({ length: 8 }, () =>
      transact((state) =>
        logCheckpoint(state, s.checkpoints[0].id, "Read", "Study", "", 710000),
      ),
    ),
  );
  s = (await transact(() => {})).state;
  assert.equal(totalXP(s), 5);
  await assert.rejects(
    transact((state) => {
      state.interval = 0;
    }),
  );
  assert.equal((await transact(() => {})).state.interval, 10);
  const copy = JSON.parse(JSON.stringify(s));
  await restore(defaults());
  await restore(copy);
  assert.deepEqual((await transact(() => {})).state.checkpoints, s.checkpoints);
});
test("notification denial and unsupported browsers retain the in-app fallback", async () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldNotification = Object.getOwnPropertyDescriptor(
    globalThis,
    "Notification",
  );
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {},
    });
    await assert.rejects(enableNotifications(), /does not support/);
    const notification = {
      permission: "denied",
      requestPermission: async () => "denied",
    };
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: notification,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { Notification: notification },
    });
    await assert.rejects(enableNotifications(), /not enabled/);
    const settings = defaults().settings;
    settings.notifications = true;
    await assert.doesNotReject(alertUser(settings, "Check-in", "Ready"));
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (oldNotification)
      Object.defineProperty(globalThis, "Notification", oldNotification);
    else Reflect.deleteProperty(globalThis, "Notification");
  }
});
test("timer completion alarms do not depend on optional check-in sounds", () => {
  const settings = defaults().settings;
  assert.equal(shouldPlayRingtone(settings), false);
  assert.equal(shouldPlayRingtone(settings, { forceSound: true }), true);
  settings.sound = true;
  assert.equal(shouldPlayRingtone(settings), true);
});

test("task lifecycle and persistence round-trip through backup", () => {
  const s = defaults();
  const initialTaskCount = s.tasks?.length ?? 0;

  // Add a task
  const newTask = addTask(s, {
    title: "Write design doc",
    category: "Work",
    priority: "high",
    estimatedSessions: 3,
    dueDate: "2026-09-30",
  });
  assert.equal(s.tasks?.length, initialTaskCount + 1);
  assert.equal(newTask.title, "Write design doc");
  assert.equal(newTask.completed, false);
  assert.equal(newTask.completedSessions, 0);

  // Update the task
  updateTask(s, newTask.id, { title: "Write technical design doc", priority: "medium" });
  assert.equal(s.tasks?.find((t) => t.id === newTask.id)?.title, "Write technical design doc");
  assert.equal(s.tasks?.find((t) => t.id === newTask.id)?.priority, "medium");

  // Record focus progress
  recordTaskFocus(s, "Write technical design doc", 1500);
  const updated = s.tasks?.find((t) => t.id === newTask.id);
  assert.equal(updated?.completedSessions, 1);
  assert.equal(updated?.totalFocusSeconds, 1500);

  // Toggle completion
  toggleTask(s, newTask.id);
  assert.equal(s.tasks?.find((t) => t.id === newTask.id)?.completed, true);
  assert.ok(s.tasks?.find((t) => t.id === newTask.id)?.completedAt);

  // Verify persistence round-trip via parseBackup
  const serialized = JSON.parse(JSON.stringify(s));
  const restored = parseBackup(serialized);
  assert.equal(restored.tasks?.length, s.tasks?.length);
  const restoredTask = restored.tasks?.find((t) => t.id === newTask.id);
  assert.equal(restoredTask?.title, "Write technical design doc");
  assert.equal(restoredTask?.completed, true);
  assert.equal(restoredTask?.completedSessions, 1);

  // Delete the task
  deleteTask(s, newTask.id);
  assert.equal(s.tasks?.length, initialTaskCount);
});

test("today goal is completely separate from tasks", () => {
  const s = defaults();
  const taskCountBefore = s.tasks?.length ?? 0;

  // Set today's goal
  setTodayGoal(s, {
    title: "Master Quantum Physics",
    targetSessions: 6,
    quote: "Focus is a muscle.",
  });

  assert.equal(s.todayGoal?.title, "Master Quantum Physics");
  assert.equal(s.todayGoal?.targetSessions, 6);
  assert.equal(s.todayGoal?.quote, "Focus is a muscle.");

  // Ensure setting today's goal does NOT add or modify any task
  assert.equal(s.tasks?.length, taskCountBefore);
  assert.equal(s.tasks?.some((t) => t.title === "Master Quantum Physics"), false);

  // Verify today's goal survives backup parsing
  const restored = parseBackup(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.todayGoal?.title, "Master Quantum Physics");
  assert.equal(restored.todayGoal?.targetSessions, 6);
});

test("task completion is decoupled from companion and persists regardless of Cappy state", () => {
  const s = defaults();
  const task = addTask(s, {
    title: "Finish my lab report",
    category: "School",
    priority: "high",
    estimatedSessions: 3,
  });

  assert.equal(task.completed, false);

  // Complete task
  toggleTask(s, task.id);
  assert.equal(task.completed, true);
  assert.ok(task.completedAt);

  // Verify backup/restore keeps completed state
  const restored = parseBackup(JSON.parse(JSON.stringify(s)));
  const restoredTask = restored.tasks?.find((t) => t.id === task.id);
  assert.equal(restoredTask?.completed, true);

  // Uncomplete task
  toggleTask(s, task.id);
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, undefined);
});

test("task with custom focus and break settings persists and starts immediately with custom duration", () => {
  const s = defaults();
  const task = addTask(s, {
    title: "Deep research paper",
    category: "Study",
    priority: "high",
    estimatedSessions: 4,
    focusDuration: 45,
    shortBreak: 10,
    longBreak: 20,
  });

  assert.equal(task.focusDuration, 45);
  assert.equal(task.shortBreak, 10);
  assert.equal(task.longBreak, 20);

  // Verify backup/restore keeps focus and break settings
  const restored = parseBackup(JSON.parse(JSON.stringify(s)));
  const restoredTask = restored.tasks?.find((t) => t.id === task.id);
  assert.equal(restoredTask?.focusDuration, 45);
  assert.equal(restoredTask?.shortBreak, 10);
  assert.equal(restoredTask?.longBreak, 20);

  // Test startPhase uses task's custom focus duration
  const now = 1000000;
  startPhase(s, now, "focus", task.title, task.category);
  assert.ok(s.timer);
  assert.equal(s.timer.status, "running");
  assert.equal(s.timer.duration, 45 * 60000);
  assert.equal(s.timer.endAt, now + 45 * 60000);
  assert.equal(s.timer.task, "Deep research paper");
});


