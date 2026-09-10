"use client";
import { useState } from "react";

export default function SidebarCompanion({ pose }: { pose: string }) {
  const [resting, setResting] = useState(false);
  const [hop, setHop] = useState(0);
  return (
    <div className={`sidebar-companion ${resting ? "is-resting" : ""}`}>
      <button
        type="button"
        className="companion-greet"
        aria-label="Say hello to your capybara"
        onClick={() => setHop(hop + 1)}
      >
        <span key={hop} className={hop ? "companion-hop" : "companion-wrap"}>
          <span
            role="img"
            aria-label="Your capybara companion"
            className={`companion ${pose}`}
          />
        </span>
      </button>
      <button
        type="button"
        className="companion-rest"
        aria-pressed={resting}
        onClick={() => setResting(!resting)}
      >
        {resting ? "Wake capy" : "Let capy rest"}
      </button>
    </div>
  );
}
