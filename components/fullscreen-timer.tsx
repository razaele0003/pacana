"use client";
import WanderingCapybara from "./wandering-capybara";
import { useEffect, useRef } from "react";
import { Leaf, Pause, Play, Square, X } from "lucide-react";
import type { State } from "../core/model";
import { nextPhase, remaining } from "../core/engine";

export default function FullscreenTimer({
  state,
  now,
  close,
  primary,
  stop,
  error,
}: {
  state: State;
  now: number;
  close: () => void;
  primary: () => void;
  stop: () => void;
  error: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const seconds = Math.ceil(remaining(state, now) / 1000);
  const groups =
    seconds >= 3600
      ? [
          Math.floor(seconds / 3600),
          Math.floor(seconds / 60) % 60,
          seconds % 60,
        ]
      : [Math.floor(seconds / 60), seconds % 60];
  const labels =
    groups.length === 3
      ? ["Hours", "Minutes", "Seconds"]
      : ["Minutes", "Seconds"];
  const timer = state.timer;
  const phaseNames = {
    focus: "Focus",
    short: "Short break",
    long: "Long break",
  };
  const action = !timer
    ? "Start focus"
    : timer.status === "running"
      ? "Pause"
      : timer.status === "paused"
        ? "Resume"
        : `Start ${phaseNames[nextPhase(state)].toLowerCase()}`;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
      element?.close();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="fullscreen-timer"
      aria-labelledby="fullscreen-title"
      onCancel={close}
    >
      <div className="fullscreen-inner">
        <header className="fullscreen-header">
          <span className="brand">
            <Leaf /> pacana
          </span>
          <div className="actions">
            <button
              autoFocus
              className="icon-button"
              aria-label="Close fullscreen timer"
              onClick={close}
            >
              <X />
            </button>
          </div>
        </header>
        <section className="fullscreen-center">
          <p className="eyebrow">
            <span className="status-dot" />
            {timer?.status === "complete"
              ? "SESSION COMPLETE"
              : timer?.status === "paused"
                ? "TAKE YOUR TIME"
                : "ONE LITTLE MOMENT AT A TIME"}
          </p>
          <h1 id="fullscreen-title">{phaseNames[timer?.phase || "focus"]}</h1>
          <div
            className={`digital-clock ${groups.length === 3 ? "with-hours" : ""}`}
            role="timer"
            aria-label={`${groups.map((n, i) => `${n} ${labels[i].toLowerCase()}`).join(", ")} remaining`}
          >
            {groups.map((value, i) => (
              <div className="clock-section" key={labels[i]}>
                {i > 0 && (
                  <span aria-hidden="true" className="clock-colon">
                    :
                  </span>
                )}
                <div className="clock-group" aria-hidden="true">
                  {String(value)
                    .padStart(2, "0")
                    .split("")
                    .map((digit, j) => (
                      <span className="clock-tile" key={j}>
                        <span className="clock-number" key={digit}>
                          {digit}
                        </span>
                      </span>
                    ))}
                </div>
                <span className="clock-unit" aria-hidden="true">
                  {labels[i]}
                </span>
              </div>
            ))}
          </div>
          <p className="fullscreen-task">
            {timer?.status === "complete"
              ? "A little progress, made. Take a breath."
              : timer?.task || "A little focus goes a long way."}
          </p>
          <div className="fullscreen-actions">
            <button className="primary" onClick={primary}>
              {timer?.status === "running" ? (
                <Pause size={20} />
              ) : (
                <Play size={20} />
              )}{" "}
              {action}
            </button>
            {timer && timer.status !== "complete" && (
              <button className="fullscreen-end" onClick={stop}>
                <Square size={17} /> End session
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className="fullscreen-error">
              {error}
            </p>
          )}
        </section>
        <WanderingCapybara />
        <footer className="fullscreen-footer">
          <span>
            <Leaf size={15} /> Just you and this moment.
          </span>
          <span>Esc to return · Your timer keeps its rhythm</span>
        </footer>
      </div>
    </dialog>
  );
}
