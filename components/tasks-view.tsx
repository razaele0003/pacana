"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Check,
  CheckCircle2,
  Circle,
  Plus,
  Play,
  Pencil,
  Trash2,
  Clock,
  Flame,
  Calendar,
  Sparkles,
  BookOpen,
  ArrowRight,
  ChevronRight,
  GripVertical,
  X,
  Target,
  Sun,
  ListTodo,
  CheckSquare,
  Award,
  MoreVertical,
} from "lucide-react";
import type { State, Task, TaskPriority, TodayGoal } from "../core/model";
import {
  addTask,
  updateTask,
  toggleTask,
  deleteTask,
  setTodayGoal,
  totalXP,
  focusTotal,
} from "../core/engine";
import { playCompanionSound } from "../lib/companion-sound";
import TaskDialog from "./task-dialog";

interface TasksViewProps {
  state: State;
  update: (fn: (s: State) => void) => Promise<unknown>;
  onStartFocus: (task: Task) => void;
  now: number;
  onChooseTab: (tab: string) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  Study: "📖",
  Work: "💼",
  School: "🎓",
  Project: "</>",
  Personal: "🌱",
  Other: "✨",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Study: { bg: "#eef2ff", text: "#4338ca", border: "#c7d2fe" },
  Work: { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  School: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  Project: { bg: "#ecfeff", text: "#0e7490", border: "#a5f3fc" },
  Personal: { bg: "#fdf4ff", text: "#a21caf", border: "#f5d0fe" },
  Other: { bg: "#f4f4f5", text: "#52525b", border: "#e4e4e7" },
};

const PRIORITY_STYLES: Record<TaskPriority, { label: string; bg: string; text: string; icon: string }> = {
  high: { label: "High", bg: "#fef2f2", text: "#b91c1c", icon: "⚑" },
  medium: { label: "Medium", bg: "#fffbeb", text: "#b45309", icon: "⚑" },
  low: { label: "Low", bg: "#f0fdf4", text: "#15803d", icon: "⚑" },
};

export default function TasksView({
  state,
  update,
  onStartFocus,
  now,
  onChooseTab,
}: TasksViewProps) {
  const [filter, setFilter] = useState<"Today" | "Upcoming" | "Completed" | "All">("Today");
  const [sort, setSort] = useState<"priority" | "dueDate" | "focusTime" | "name">("priority");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Today's Goal Editing State
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalTitleInput, setGoalTitleInput] = useState(
    state.todayGoal?.title || "Finish my lab report"
  );
  const [goalSessionsInput, setGoalSessionsInput] = useState<number>(
    state.todayGoal?.targetSessions || 4
  );

  // Celebration state
  const [celebratingTaskId, setCelebratingTaskId] = useState<string | null>(null);
  const [celebrationToast, setCelebrationToast] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenCreateEvent = () => {
      handleOpenCreate();
    };
    window.addEventListener("pacana:open-create-task", handleOpenCreateEvent);
    return () => {
      window.removeEventListener("pacana:open-create-task", handleOpenCreateEvent);
    };
  }, []);

  // Formatted date string for hero banner: "Mon, Sep 22, 2026"
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(now || Date.now());
      const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
      const month = d.toLocaleDateString("en-US", { month: "short" });
      const day = d.getDate();
      const year = d.getFullYear();
      return `${weekday}, ${month} ${day}, ${year}`;
    } catch {
      return "Today";
    }
  }, [now]);

  // Today's date in YYYY-MM-DD format for due date comparisons
  const todayDateStr = useMemo(() => {
    try {
      const d = new Date(now || Date.now());
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    } catch {
      return "";
    }
  }, [now]);

  // Tasks list
  const tasks = state.tasks || [];

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (filter === "Today") {
      list = list.filter(
        (t) => !t.completed && (!t.dueDate || t.dueDate <= todayDateStr)
      );
    } else if (filter === "Upcoming") {
      list = list.filter(
        (t) => !t.completed && Boolean(t.dueDate && t.dueDate > todayDateStr)
      );
    } else if (filter === "Completed") {
      list = list.filter((t) => t.completed);
    }
    // "All" keeps all

    // Sorting
    list.sort((a, b) => {
      if (sort === "priority") {
        const pOrder: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        const pa = a.priority ? pOrder[a.priority] : 1;
        const pb = b.priority ? pOrder[b.priority] : 1;
        if (pa !== pb) return pa - pb;
      } else if (sort === "dueDate") {
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
      } else if (sort === "focusTime") {
        if (b.totalFocusSeconds !== a.totalFocusSeconds) {
          return b.totalFocusSeconds - a.totalFocusSeconds;
        }
      } else if (sort === "name") {
        return a.title.localeCompare(b.title);
      }
      return a.order - b.order;
    });

    return list;
  }, [tasks, filter, sort, todayDateStr]);

  // Summary Metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.completed).length;

  // Total focus time for today in minutes
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const todayEnd = new Date(now).setHours(23, 59, 59, 999);
  const todayFocusSec = Math.round(focusTotal(state, todayStart, todayEnd) / 1000);
  const todayFocusMin = Math.round(todayFocusSec / 60);

  const xpEarned = totalXP(state);

  // Goal Progress (strictly independent from tasks)
  const todayGoal = state.todayGoal || {
    title: "Finish my lab report",
    completed: false,
    targetSessions: 4,
    quote: "Discipline today, results tomorrow.",
  };

  // Completed sessions toward goal: today's completed focus sessions
  const goalCompletedSessions = useMemo(() => {
    return state.sessions.filter(
      (s) => s.status === "completed" && s.endedAt >= todayStart
    ).length;
  }, [state.sessions, todayStart]);

  const targetSessions = todayGoal.targetSessions || 4;
  const goalProgressPct = Math.min(
    100,
    Math.round((goalCompletedSessions / Math.max(1, targetSessions)) * 100)
  );

  // Cappy Encouragement Cheers
  const CAPPY_CHEERS = [
    "One task at a time. You got this! ♡",
    "Small steps every day lead to big progress! 🌱",
    "Proud of you for showing up today. ✨",
    "Take a breath. You're doing wonderful. 🍃",
    "Focus on the next little thing. ♡",
  ];
  const [cheerIndex, setCheerIndex] = useState(0);

  const handleCappyCheer = () => {
    setCheerIndex((prev) => (prev + 1) % CAPPY_CHEERS.length);
    playCompanionSound("pop");
    window.dispatchEvent(
      new CustomEvent("pacana:trigger-emote", { detail: { type: "happy" } })
    );
  };

  // Handlers
  const handleToggleTask = async (task: Task) => {
    const isNowCompleted = !task.completed;

    if (isNowCompleted) {
      playCompanionSound("snack");
      setCelebratingTaskId(task.id);
      setCelebrationToast(`Task complete 🌱 "${task.title}"`);

      // Dispatch task-completed event: triggers Cappy breakdance celebration strictly if Cappy is visible
      window.dispatchEvent(
        new CustomEvent("pacana:task-completed", {
          detail: {
            taskId: task.id,
            title: task.title,
            soundEnabled: state.settings?.sound ?? true,
          },
        })
      );

      setTimeout(() => {
        setCelebratingTaskId(null);
      }, 1200);

      setTimeout(() => {
        setCelebrationToast(null);
      }, 3000);
    } else {
      playCompanionSound("pop");
    }

    await update((s) => {
      toggleTask(s, task.id, Date.now());
    });
  };

  const handleSaveGoal = async () => {
    await update((s) => {
      setTodayGoal(s, {
        title: goalTitleInput.trim() || "Finish my lab report",
        targetSessions: Math.max(1, goalSessionsInput),
      });
    });
    setIsEditingGoal(false);
    playCompanionSound("pop");
  };

  const handleOpenCreate = () => {
    setEditingTask(null);
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setIsCreateOpen(true);
  };

  return (
    <div className="tasks-layout">
      {/* ============================================================
          MAIN TASKS AREA
          ============================================================ */}
      <section className="tasks-main">
        {/* Celebration Toast */}
        {celebrationToast && (
          <div className="tasks-celebration-toast" role="status">
            <Sparkles size={16} className="toast-sparkle" />
            <span>{celebrationToast}</span>
          </div>
        )}

        {/* 1. Header / Hero Banner */}
        <header className="tasks-hero-card" data-capybara-obstacle>
          <img
            src="/art/tasks-hero-clean.png"
            alt="Woodland scenery with mountains, lake and cute capybara"
            className="tasks-hero-bg"
          />
          <div className="tasks-hero-content">
            <div className="tasks-hero-titles">
              <h1 className="tasks-hero-title">Tasks</h1>
              <p className="tasks-hero-subtitle">Turn your plans into progress.</p>
            </div>
            <div className="tasks-date-pill" aria-label="Today's date">
              <Calendar size={14} />
              <span>{formattedDate}</span>
            </div>
          </div>
        </header>

        {/* 2. Task Filter Navigation & Actions */}
        <nav className="tasks-filter-bar" aria-label="Task filters" data-capybara-obstacle>
          <div className="tasks-filter-pills" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={filter === "Today"}
              className={`tasks-filter-btn ${filter === "Today" ? "is-active" : ""}`}
              onClick={() => setFilter("Today")}
            >
              <Sun size={15} />
              <span>Today</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "Upcoming"}
              className={`tasks-filter-btn ${filter === "Upcoming" ? "is-active" : ""}`}
              onClick={() => setFilter("Upcoming")}
            >
              <Calendar size={15} />
              <span>Upcoming</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "Completed"}
              className={`tasks-filter-btn ${filter === "Completed" ? "is-active" : ""}`}
              onClick={() => setFilter("Completed")}
            >
              <Check size={15} />
              <span>Completed</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "All"}
              className={`tasks-filter-btn ${filter === "All" ? "is-active" : ""}`}
              onClick={() => setFilter("All")}
            >
              <ListTodo size={15} />
              <span>All Tasks</span>
            </button>
          </div>

          <button
            type="button"
            className="tasks-new-btn primary"
            onClick={handleOpenCreate}
            data-capybara-target="new-task"
          >
            <Plus size={17} />
            <span>New Task</span>
          </button>
        </nav>

        {/* 3. Today's Goal Card */}
        <section className="today-goal-card" data-capybara-obstacle>
          <div className="today-goal-left">
            <div className="today-goal-icon-badge" aria-hidden="true">
              <Target size={22} />
            </div>
            <div className="today-goal-info">
              <div className="today-goal-header">
                <span className="today-goal-label">Today's Goal</span>
                <button
                  type="button"
                  className="today-goal-edit-btn"
                  title="Edit today's goal"
                  onClick={() => setIsEditingGoal(!isEditingGoal)}
                >
                  <Pencil size={12} />
                  <span>{isEditingGoal ? "Cancel" : "Edit"}</span>
                </button>
              </div>

              {isEditingGoal ? (
                <div className="today-goal-edit-form">
                  <input
                    type="text"
                    value={goalTitleInput}
                    onChange={(e) => setGoalTitleInput(e.target.value)}
                    placeholder="What is your main goal today?"
                    className="today-goal-input"
                    autoFocus
                  />
                  <div className="today-goal-edit-row">
                    <label className="today-goal-session-label">
                      <span>Sessions:</span>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={goalSessionsInput}
                        onChange={(e) => setGoalSessionsInput(parseInt(e.target.value) || 1)}
                        className="today-goal-sessions-input"
                      />
                    </label>
                    <button
                      type="button"
                      className="today-goal-save-btn"
                      onClick={handleSaveGoal}
                    >
                      Save Goal
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="today-goal-title">{todayGoal.title}</h2>
                  <p className="today-goal-quote">
                    "{todayGoal.quote || "Discipline today, results tomorrow."}"
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="today-goal-right">
            <div className="today-goal-meter">
              <span className="today-goal-fraction">
                {goalCompletedSessions} / {targetSessions}
              </span>
              <div className="today-goal-bar-track" aria-hidden="true">
                <div
                  className="today-goal-bar-fill"
                  style={{ width: `${goalProgressPct}%` }}
                />
              </div>
            </div>
            <img
              src="/art/goal-cappy.png"
              alt="Sleeping capybara with sprout"
              className="today-goal-cappy"
            />
          </div>
        </section>

        {/* 4. Task List */}
        <section className="tasks-list-card" data-capybara-obstacle>
          <div className="tasks-list-header">
            <div className="tasks-list-title-group">
              <h2 className="tasks-list-title">
                {filter === "Today"
                  ? "Tasks for Today"
                  : filter === "Upcoming"
                    ? "Upcoming Tasks"
                    : filter === "Completed"
                      ? "Completed Tasks"
                      : "All Tasks"}
              </h2>
              <span className="tasks-count-badge">{filteredTasks.length}</span>
            </div>

            <div className="tasks-sort-wrapper">
              <label htmlFor="tasks-sort-select" className="tasks-sort-label">
                Sort:
              </label>
              <select
                id="tasks-sort-select"
                value={sort}
                onChange={(e) =>
                  setSort(e.target.value as "priority" | "dueDate" | "focusTime" | "name")
                }
                className="tasks-sort-select"
              >
                <option value="priority">Priority</option>
                <option value="dueDate">Due Date</option>
                <option value="focusTime">Focus Time</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* Task Rows */}
          <div className="tasks-rows-container">
            {filteredTasks.length === 0 ? (
              <div className="tasks-empty-state">
                <span className="tasks-empty-icon" aria-hidden="true">🌱</span>
                <h3 className="tasks-empty-title">
                  {filter === "Today"
                    ? "No tasks for today"
                    : filter === "Upcoming"
                      ? "No upcoming tasks"
                      : filter === "Completed"
                        ? "No completed tasks yet"
                        : "No tasks found"}
                </h3>
                <p className="tasks-empty-subtitle">
                  {filter === "Today"
                    ? "Add a task to start building your gentle rhythm."
                    : filter === "Upcoming"
                      ? "Tasks with a future due date will appear here."
                      : filter === "Completed"
                        ? "One little step at a time. Keep moving forward!"
                        : "Plan your day with small, intentional steps."}
                </p>
                {filter === "Today" && (
                  <p className="tasks-empty-hint">
                    Use <strong>+ New Task</strong> above to add your first task.
                  </p>
                )}
              </div>
            ) : (
              <>
                {filteredTasks.map((task) => {
                  const priority = task.priority || "medium";
                  const pStyle = PRIORITY_STYLES[priority];
                  const category = task.category || "Study";
                  const cStyle = CATEGORY_COLORS[category] || CATEGORY_COLORS.Study;
                  const cIcon = CATEGORY_ICONS[category] || "🌱";

                  const estSessions = task.estimatedSessions || 2;
                  const compSessions = task.completedSessions || 0;
                  const sessionProgressPct = Math.min(
                    100,
                    Math.round((compSessions / Math.max(1, estSessions)) * 100)
                  );
                  const focusMin = Math.round(task.totalFocusSeconds / 60);

                  const isCelebrating = celebratingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`task-row ${task.completed ? "is-completed" : ""} ${
                        isCelebrating ? "is-celebrating" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <button
                        type="button"
                        className={`task-checkbox ${task.completed ? "is-checked" : ""}`}
                        onClick={() => handleToggleTask(task)}
                        aria-label={
                          task.completed
                            ? `Mark "${task.title}" as incomplete`
                            : `Mark "${task.title}" as complete`
                        }
                      >
                        {task.completed ? (
                          <Check size={14} strokeWidth={2.8} />
                        ) : (
                          <span className="task-checkbox-inner" />
                        )}
                      </button>

                      {/* Task Title */}
                      <div className="task-main-info" onClick={() => handleOpenEdit(task)}>
                        <span className="task-title" title={task.title}>
                          {task.title}
                        </span>
                      </div>

                      {/* Badges: Category & Priority */}
                      <div className="task-badges">
                        {task.category && (
                          <span
                            className="task-category-pill"
                            style={{
                              backgroundColor: cStyle.bg,
                              color: cStyle.text,
                              borderColor: cStyle.border,
                            }}
                          >
                            <span className="cat-icon">{cIcon}</span>
                            <span>{task.category}</span>
                          </span>
                        )}

                        {task.priority && (
                          <span
                            className="task-priority-pill"
                            style={{
                              backgroundColor: pStyle.bg,
                              color: pStyle.text,
                            }}
                          >
                            <span className="pri-icon">{pStyle.icon}</span>
                            <span>{pStyle.label}</span>
                          </span>
                        )}
                      </div>

                      {/* Progress Bar & Sessions Count */}
                      <div className="task-progress-col">
                        <div className="task-progress-bar-track" aria-hidden="true">
                          <div
                            className="task-progress-bar-fill"
                            style={{ width: `${sessionProgressPct}%` }}
                          />
                        </div>
                        <span className="task-progress-text">
                          {compSessions} / {estSessions}
                        </span>
                      </div>

                      {/* Focus Time */}
                      <div className="task-time-col">
                        <Clock size={13} />
                        <span>{focusMin}m</span>
                      </div>

                      {/* Actions: Start Focus & Details */}
                      <div className="task-actions-col">
                        {!task.completed && (
                          <button
                            type="button"
                            className="task-start-focus-btn"
                            title={`Start focus on "${task.title}"`}
                            onClick={() => onStartFocus(task)}
                          >
                            <Play size={13} fill="currentColor" />
                            <span>Start Focus</span>
                          </button>
                        )}

                        <button
                          type="button"
                          className="task-more-btn"
                          title="Edit task details"
                          onClick={() => handleOpenEdit(task)}
                        >
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </section>
      </section>

      {/* ============================================================
          RIGHT SIDEBAR: CAPPY COMPANION & STATS
          ============================================================ */}
      <aside className="tasks-aside">
        {/* 1. Cappy Buddy Card */}
        <div className="tasks-cappy-card" data-capybara-obstacle>
          <div className="tasks-cappy-header">
            <div className="tasks-cappy-title-group">
              <span className="tasks-cappy-status-dot" aria-hidden="true" />
              <div>
                <strong>Cappy</strong>
                <span className="tasks-cappy-role">Your focus buddy</span>
              </div>
            </div>
            <button
              type="button"
              className="tasks-cappy-menu-btn"
              title="Get cheer from Cappy"
              onClick={handleCappyCheer}
            >
              <Sparkles size={16} />
            </button>
          </div>

          <div className="tasks-cappy-body">
            <div
              className="tasks-speech-bubble is-clickable"
              onClick={handleCappyCheer}
              title="Click for a cheer from Cappy"
            >
              <p>{CAPPY_CHEERS[cheerIndex]}</p>
            </div>
            <div
              className="tasks-cappy-img-container is-clickable"
              onClick={handleCappyCheer}
              title="Click Cappy for encouragement"
            >
              <img
                src="/art/cappy-tasks-buddy.png"
                alt="Cappy the focus companion"
                className="tasks-cappy-img"
              />
            </div>
          </div>
        </div>

        {/* 2. Today's Progress Card */}
        <div className="tasks-progress-card" data-capybara-obstacle>
          <div className="tasks-progress-header">
            <Sun size={16} className="progress-icon" />
            <span className="progress-title">Today's Progress</span>
          </div>

          {/* Circular Progress Meter */}
          <div className="tasks-circle-meter-wrapper">
            <div className="tasks-circle-meter">
              <svg viewBox="0 0 100 100" className="tasks-circle-svg">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="tasks-circle-bg"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="tasks-circle-fill"
                  style={{
                    strokeDasharray: 251.2,
                    strokeDashoffset:
                      251.2 -
                      (251.2 * Math.min(1, totalTasks > 0 ? completedTasks / totalTasks : 0)),
                  }}
                />
              </svg>
              <div className="tasks-circle-inner">
                <strong>
                  {completedTasks}/{totalTasks}
                </strong>
                <span>tasks done</span>
                <span className="tasks-circle-sprout">🌱</span>
              </div>
            </div>
          </div>

          {/* Metrics summary: Focus time & XP */}
          <div className="tasks-metrics-row">
            <div className="tasks-metric-item">
              <Clock size={16} className="metric-icon" />
              <div>
                <strong>{todayFocusMin}m</strong>
                <span>focus time</span>
              </div>
            </div>
            <div className="tasks-metric-item">
              <Award size={16} className="metric-icon xp" />
              <div>
                <strong>{xpEarned}</strong>
                <span>XP earned</span>
              </div>
            </div>
          </div>

          <div className="tasks-progress-quote">
            <span className="quote-leaf">🌱</span>
            <p>"Progress, not perfection."</p>
          </div>
        </div>

        {/* 3. Quick Actions Card */}
        <div className="tasks-quick-actions-card" data-capybara-obstacle>
          <div className="quick-actions-header">
            <Sparkles size={15} />
            <span>Quick Actions</span>
          </div>
          <div className="quick-actions-vertical">
            <button
              type="button"
              className="quick-action-btn primary full-width"
              onClick={() => onChooseTab("Focus")}
            >
              <Play size={14} fill="currentColor" />
              <span>Start Focus</span>
            </button>
            <button
              type="button"
              className="quick-action-btn full-width"
              onClick={() => onChooseTab("Journal")}
            >
              <BookOpen size={14} />
              <span>View Journal</span>
            </button>
          </div>
        </div>

        {/* 4. Woodland Footer Banner */}
        <div className="tasks-footer-card" data-capybara-obstacle>
          <img
            src="/art/tasks-footer.png"
            alt="Pine trees illustration"
            className="tasks-footer-bg"
          />
          <p className="tasks-footer-quote">
            A more productive you
            <br />
            is a happier you. ♡
          </p>
        </div>
      </aside>

      {/* ============================================================
          TASK CREATION & EDIT MODAL
          ============================================================ */}
      <TaskDialog
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingTask(null);
        }}
        editingTask={editingTask}
        state={state}
        update={update}
        onStartFocus={onStartFocus}
      />
    </div>
  );
}
