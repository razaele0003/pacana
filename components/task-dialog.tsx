"use client";

import React, { useState, useRef, useEffect } from "react";
import { X, Trash2, Play } from "lucide-react";
import type { State, Task, TaskPriority } from "../core/model";
import { addTask, updateTask, deleteTask } from "../core/engine";
import { playCompanionSound } from "../lib/companion-sound";

export const CATEGORY_ICONS: Record<string, string> = {
  Study: "📖",
  Work: "💼",
  School: "🎓",
  Project: "</>",
  Personal: "🌱",
  Other: "✨",
};

export const PRIORITY_STYLES: Record<TaskPriority, { label: string; bg: string; text: string; icon: string }> = {
  high: { label: "High", bg: "#fef2f2", text: "#b91c1c", icon: "⚑" },
  medium: { label: "Medium", bg: "#fffbeb", text: "#b45309", icon: "⚑" },
  low: { label: "Low", bg: "#f0fdf4", text: "#15803d", icon: "⚑" },
};

interface TaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingTask?: Task | null;
  state: State;
  update: (fn: (s: State) => void) => Promise<unknown>;
  onStartFocus: (task: Task) => void;
}

export default function TaskDialog({
  isOpen,
  onClose,
  editingTask,
  state,
  update,
  onStartFocus,
}: TaskDialogProps) {
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCategory, setTaskCategory] = useState("Study");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("medium");
  const [taskSessions, setTaskSessions] = useState(2);
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskFocusDuration, setTaskFocusDuration] = useState<number | "">("");
  const [taskShortBreak, setTaskShortBreak] = useState<number | "">("");
  const [taskLongBreak, setTaskLongBreak] = useState<number | "">("");

  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (editingTask) {
      setTaskTitle(editingTask.title);
      setTaskCategory(editingTask.category || "Study");
      setTaskPriority(editingTask.priority || "medium");
      setTaskSessions(editingTask.estimatedSessions || 2);
      setTaskDueDate(editingTask.dueDate || "");
      setTaskFocusDuration(editingTask.focusDuration ?? state.settings?.focus ?? 25);
      setTaskShortBreak(editingTask.shortBreak ?? state.settings?.short ?? 5);
      setTaskLongBreak(editingTask.longBreak ?? state.settings?.long ?? 15);
    } else {
      setTaskTitle("");
      setTaskCategory("Study");
      setTaskPriority("medium");
      setTaskSessions(2);
      setTaskDueDate("");
      setTaskFocusDuration(state.settings?.focus ?? 25);
      setTaskShortBreak(state.settings?.short ?? 5);
      setTaskLongBreak(state.settings?.long ?? 15);
    }

    setTimeout(() => titleInputRef.current?.focus(), 80);
  }, [isOpen, editingTask, state.settings]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    const fDur = typeof taskFocusDuration === "number" && taskFocusDuration > 0 ? taskFocusDuration : undefined;
    const sBrk = typeof taskShortBreak === "number" && taskShortBreak > 0 ? taskShortBreak : undefined;
    const lBrk = typeof taskLongBreak === "number" && taskLongBreak > 0 ? taskLongBreak : undefined;

    await update((s) => {
      if (editingTask) {
        updateTask(s, editingTask.id, {
          title: taskTitle.trim(),
          category: taskCategory,
          priority: taskPriority,
          estimatedSessions: Math.max(1, taskSessions),
          dueDate: taskDueDate || undefined,
          focusDuration: fDur,
          shortBreak: sBrk,
          longBreak: lBrk,
        });
      } else {
        addTask(s, {
          title: taskTitle.trim(),
          category: taskCategory,
          priority: taskPriority,
          estimatedSessions: Math.max(1, taskSessions),
          dueDate: taskDueDate || undefined,
          focusDuration: fDur,
          shortBreak: sBrk,
          longBreak: lBrk,
        });
      }
    });

    playCompanionSound("pop");
    onClose();
  };

  const handleSaveAndStart = async () => {
    if (!taskTitle.trim()) return;

    const fDur = typeof taskFocusDuration === "number" && taskFocusDuration > 0 ? taskFocusDuration : undefined;
    const sBrk = typeof taskShortBreak === "number" && taskShortBreak > 0 ? taskShortBreak : undefined;
    const lBrk = typeof taskLongBreak === "number" && taskLongBreak > 0 ? taskLongBreak : undefined;

    let targetTask: Task | undefined;
    await update((s) => {
      if (editingTask) {
        updateTask(s, editingTask.id, {
          title: taskTitle.trim(),
          category: taskCategory,
          priority: taskPriority,
          estimatedSessions: Math.max(1, taskSessions),
          dueDate: taskDueDate || undefined,
          focusDuration: fDur,
          shortBreak: sBrk,
          longBreak: lBrk,
        });
        targetTask = s.tasks?.find((x) => x.id === editingTask.id);
      } else {
        targetTask = addTask(s, {
          title: taskTitle.trim(),
          category: taskCategory,
          priority: taskPriority,
          estimatedSessions: Math.max(1, taskSessions),
          dueDate: taskDueDate || undefined,
          focusDuration: fDur,
          shortBreak: sBrk,
          longBreak: lBrk,
        });
      }
    });

    playCompanionSound("pop");
    onClose();

    if (targetTask) {
      onStartFocus(targetTask);
    }
  };

  const handleDelete = async (id: string) => {
    await update((s) => {
      deleteTask(s, id);
    });
    playCompanionSound("pop");
    onClose();
  };

  return (
    <div className="task-dialog-backdrop" onClick={onClose}>
      <div
        className="task-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-dialog-header">
          <h3 id="task-dialog-title">
            {editingTask ? "Edit Task" : "New Task"}
          </h3>
          <button
            type="button"
            className="task-dialog-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="task-dialog-form">
          {/* Task Title */}
          <div className="task-form-group">
            <label htmlFor="task-title-input" className="task-form-label">
              Task name
            </label>
            <input
              id="task-title-input"
              ref={titleInputRef}
              type="text"
              required
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="What would you like to accomplish?"
              className="task-form-input"
            />
          </div>

          {/* Category selector */}
          <div className="task-form-group">
            <span className="task-form-label">Category (optional)</span>
            <div className="task-category-pills-selector">
              {Object.keys(CATEGORY_ICONS).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`task-cat-chip ${taskCategory === cat ? "is-selected" : ""}`}
                  onClick={() => setTaskCategory(cat)}
                >
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Priority selector */}
          <div className="task-form-group">
            <span className="task-form-label">Priority (optional)</span>
            <div className="task-priority-pills-selector">
              {(["low", "medium", "high"] as TaskPriority[]).map((p) => {
                const style = PRIORITY_STYLES[p];
                return (
                  <button
                    key={p}
                    type="button"
                    className={`task-pri-chip ${taskPriority === p ? "is-selected" : ""}`}
                    onClick={() => setTaskPriority(p)}
                  >
                    <span>{style.icon}</span>
                    <span>{style.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estimated sessions & Due date row */}
          <div className="task-form-row">
            <div className="task-form-group flex-1">
              <label htmlFor="task-sessions-input" className="task-form-label">
                Estimated sessions
              </label>
              <input
                id="task-sessions-input"
                type="number"
                min="1"
                max="20"
                value={taskSessions}
                onChange={(e) => setTaskSessions(parseInt(e.target.value) || 1)}
                className="task-form-input"
              />
            </div>

            <div className="task-form-group flex-1">
              <label htmlFor="task-due-date-input" className="task-form-label">
                Due date (optional)
              </label>
              <input
                id="task-due-date-input"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="task-form-input"
              />
            </div>
          </div>

          {/* Focus Settings for this task */}
          <div className="task-form-focus-section">
            <div className="task-form-focus-header">
              <span className="task-form-label">Focus settings for this task</span>
              <span className="task-form-sublabel">Custom timer duration</span>
            </div>
            <div className="task-form-row">
              <div className="task-form-group flex-1">
                <label htmlFor="task-focus-duration-input" className="task-form-sublabel-text">
                  Focus duration
                </label>
                <div className="task-input-with-unit">
                  <input
                    id="task-focus-duration-input"
                    type="number"
                    min="1"
                    max="180"
                    value={taskFocusDuration}
                    onChange={(e) =>
                      setTaskFocusDuration(e.target.value === "" ? "" : parseInt(e.target.value) || 1)
                    }
                    placeholder={`${state.settings?.focus ?? 25}`}
                    className="task-form-input"
                  />
                  <span className="task-input-unit">min</span>
                </div>
              </div>

              <div className="task-form-group flex-1">
                <label htmlFor="task-short-break-input" className="task-form-sublabel-text">
                  Short break
                </label>
                <div className="task-input-with-unit">
                  <input
                    id="task-short-break-input"
                    type="number"
                    min="1"
                    max="60"
                    value={taskShortBreak}
                    onChange={(e) =>
                      setTaskShortBreak(e.target.value === "" ? "" : parseInt(e.target.value) || 1)
                    }
                    placeholder={`${state.settings?.short ?? 5}`}
                    className="task-form-input"
                  />
                  <span className="task-input-unit">min</span>
                </div>
              </div>

              <div className="task-form-group flex-1">
                <label htmlFor="task-long-break-input" className="task-form-sublabel-text">
                  Long break
                </label>
                <div className="task-input-with-unit">
                  <input
                    id="task-long-break-input"
                    type="number"
                    min="1"
                    max="60"
                    value={taskLongBreak}
                    onChange={(e) =>
                      setTaskLongBreak(e.target.value === "" ? "" : parseInt(e.target.value) || 1)
                    }
                    placeholder={`${state.settings?.long ?? 15}`}
                    className="task-form-input"
                  />
                  <span className="task-input-unit">min</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="task-dialog-actions">
            {editingTask && (
              <button
                type="button"
                className="task-dialog-delete-btn"
                onClick={() => handleDelete(editingTask.id)}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            )}

            <div className="task-dialog-actions-right">
              <button
                type="button"
                className="task-dialog-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="task-dialog-start-btn"
                onClick={handleSaveAndStart}
                title="Save task and start focus session immediately"
              >
                <Play size={13} fill="currentColor" />
                <span>Start Focus</span>
              </button>
              <button type="submit" className="task-dialog-submit-btn primary">
                {editingTask ? "Save Changes" : "Create Task"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
