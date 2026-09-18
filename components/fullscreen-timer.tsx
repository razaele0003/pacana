"use client";
import WanderingCapybara from "./wandering-capybara";
import { useEffect, useRef, useState } from "react";
import { Leaf, Pause, Play, Square, X } from "lucide-react";
import type { State } from "../core/model";
import { nextPhase, remaining } from "../core/engine";

function ScoreboardTile({ digit }: { digit: string }) {
  const [current, setCurrent] = useState(digit);
  const [previous, setPrevious] = useState(digit);
  const [flipping, setFlipping] = useState(false);
  const [flipKey, setFlipKey] = useState(0);

  useEffect(() => {
    if (digit !== current) {
      setPrevious(current);
      setCurrent(digit);
      setFlipping(true);
      setFlipKey((k) => k + 1);

      const timer = setTimeout(() => {
        setFlipping(false);
      }, 550);

      return () => clearTimeout(timer);
    }
  }, [digit, current]);

  return (
    <div className="scoreboard-tile" aria-hidden="true">
      {/* Physical scoreboard rings at the top */}
      <div className="scoreboard-rings">
        <div className="scoreboard-ring left">
          <div className="scoreboard-loop" />
          <div className="scoreboard-hole" />
        </div>
        <div className="scoreboard-ring right">
          <div className="scoreboard-loop" />
          <div className="scoreboard-hole" />
        </div>
      </div>

      <div className="scoreboard-card">
        {/* Top half static: shows current digit */}
        <div className="scoreboard-half scoreboard-half-top">
          <span className="scoreboard-digit-val">{current}</span>
        </div>

        {/* Bottom half static: shows previous digit during flip, or current once settled */}
        <div className="scoreboard-half scoreboard-half-bottom">
          <span className="scoreboard-digit-val">
            {flipping ? previous : current}
          </span>
          {flipping && <div className="scoreboard-shadow-bottom" />}
        </div>

        {/* 3D Flipping flaps */}
        {flipping && (
          <div className="scoreboard-flip-layer" key={flipKey}>
            {/* Top flap: rotates down from 0 to -90 deg, showing previous digit */}
            <div className="scoreboard-flap scoreboard-flap-top">
              <span className="scoreboard-digit-val">{previous}</span>
              <div className="scoreboard-shadow-top" />
            </div>

            {/* Bottom flap: rotates down from 90 to 0 deg with bounce, showing current digit */}
            <div className="scoreboard-flap scoreboard-flap-bottom">
              <span className="scoreboard-digit-val">{current}</span>
              <div className="scoreboard-shadow-bottom-flap" />
            </div>
          </div>
        )}

        {/* Center horizontal split seam & notch accents */}
        <div className="scoreboard-divider" />
        <div className="scoreboard-notch left" />
        <div className="scoreboard-notch right" />
      </div>
    </div>
  );
}

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
                      <ScoreboardTile digit={digit} key={j} />
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
