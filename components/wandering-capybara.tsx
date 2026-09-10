"use client";
import { useState } from "react";
/** A small vector sprite: separate feet let the companion actually walk. */
export default function WanderingCapybara() {
  const [resting, setResting] = useState(false);
  return (
    <div className={`capy-companion ${resting ? "is-resting" : ""}`}>
      <div className="capy-trail" aria-hidden="true">
        <div className="capy-wander">
          <div className="capy-facing">
            <svg className="capy-sprite" viewBox="0 0 120 90" fill="none">
              <ellipse
                cx="58"
                cy="81"
                rx="43"
                ry="5"
                fill="#0d211b"
                opacity=".25"
              />
              <g className="capy-foot capy-foot-back">
                <path d="M28 60h15v17q-7 6-15 0Z" fill="#986a45" />
                <path d="M72 60h14v17q-7 6-14 0Z" fill="#986a45" />
              </g>
              <g className="capy-body">
                <path
                  d="M15 53c0-21 14-29 34-29h24c21 0 30 14 29 31-1 14-13 19-37 19H39c-17 0-24-7-24-21Z"
                  fill="#bc8b59"
                  stroke="#775537"
                  strokeWidth="2"
                />
                <path
                  d="M62 31c-2-17 7-23 22-21 13 1 16 9 17 20l9 8c6 5 6 15 0 19-9 6-29 6-40-2"
                  fill="#cfa16c"
                  stroke="#775537"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <ellipse
                  cx="73"
                  cy="15"
                  rx="7"
                  ry="9"
                  fill="#bc8b59"
                  stroke="#775537"
                  strokeWidth="2"
                />
                <ellipse cx="74" cy="16" rx="3" ry="4" fill="#e6b48c" />
                <circle cx="94" cy="32" r="3" fill="#3c3026" />
                <circle cx="95" cy="31" r=".8" fill="#fff8dc" />
                <ellipse cx="109" cy="42" rx="3" ry="2" fill="#684b35" />
                <path
                  d="M103 50q-4 3-7 0"
                  stroke="#775537"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <ellipse
                  cx="89"
                  cy="43"
                  rx="5"
                  ry="3"
                  fill="#dc9e7d"
                  opacity=".65"
                />
                <path
                  d="M30 37q10-5 19-3"
                  stroke="#d6ac78"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                <path d="M78 8q-5-10-12-5 3 8 12 5Z" fill="#9dad72" />
              </g>
              <g className="capy-foot capy-foot-front">
                <path d="M39 62h15v16q-7 6-15 0Z" fill="#bc8b59" />
                <path d="M82 61h14v17q-7 6-14 0Z" fill="#cfa16c" />
              </g>
            </svg>
          </div>
        </div>
      </div>
      <button
        className="capy-rest"
        type="button"
        aria-pressed={resting}
        onClick={() => setResting(!resting)}
      >
        {resting ? "Let capy wander" : "Let capy rest"}
      </button>
    </div>
  );
}
