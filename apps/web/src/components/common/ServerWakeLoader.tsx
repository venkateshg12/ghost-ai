"use client";

import { useEffect, useState } from "react";

/*
  The splash shown while the session is resolved, which on a sleeping free-tier API can take up to a
  minute. Instead of a spinner it draws a tiny system diagram, the thing Ghost AI is for: the browser
  and the database appear, the API node pulses until it answers, a packet keeps knocking on its door, and
  the link to the database stays muted until the server is up. Motion lives in globals.css (wake-*) and is
  switched off for prefers-reduced-motion, which leaves the finished diagram.
 */

// Seconds of waiting at which the message changes.
const WAKING_AFTER = 6;
const COLD_START_AFTER = 25;

const messageFor = (seconds: number) => {
  if (seconds < WAKING_AFTER) return "Opening your workspace";
  if (seconds < COLD_START_AFTER) return "Waking the API server";
  return "Still starting. A cold start on the free tier can take up to a minute.";
};

const formatElapsed = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const ServerWakeLoader = () => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-base p-6 text-center select-none"
      // The same dot grid the canvas uses, so the splash feels like the empty editor.
      style={{
        backgroundImage: "radial-gradient(var(--canvas-dot) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <svg
        viewBox="0 0 360 130"
        className="mb-8 w-[min(22rem,86vw)] overflow-visible"
        aria-hidden="true"
      >
        {/* Links. The second one stays muted: nothing flows to the database until the API answers. */}
        <line
          x1="86" y1="62" x2="140" y2="62"
          pathLength={1}
          className="wake-draw edge-flow stroke-brand fill-none"
          strokeWidth="1.5"
          style={{ "--wake-delay": "900ms" } as React.CSSProperties}
        />
        <line
          x1="220" y1="62" x2="278" y2="62"
          className="wake-fade stroke-surface-border-subtle fill-none"
          strokeWidth="1.5"
          strokeDasharray="3 5"
          style={{ "--wake-delay": "1100ms" } as React.CSSProperties}
        />
        {/* Hidden until the motion starts, otherwise it sits at the SVG origin for the first moments. */}
        <circle
          r="3"
          className="wake-packet wake-fade fill-brand"
          style={{ "--wake-delay": "1400ms" } as React.CSSProperties}
        >
          <animateMotion begin="1.4s" dur="1.6s" repeatCount="indefinite" path="M86 62 L140 62" />
        </circle>

        {/* Browser */}
        <rect
          x="8" y="38" width="76" height="48" rx="10"
          pathLength={1}
          className="wake-draw fill-surface stroke-surface-border-subtle"
          strokeWidth="1.5"
          style={{ "--wake-delay": "0ms" } as React.CSSProperties}
        />
        <text
          x="46" y="66" textAnchor="middle" fontSize="10"
          className="wake-fade fill-copy-muted font-mono"
          style={{ "--wake-delay": "500ms" } as React.CSSProperties}
        >
          Browser
        </text>

        {/* API: the node that is asleep. The halo pulses until the page replaces this screen. */}
        <rect
          x="142" y="38" width="76" height="48" rx="10"
          className="wake-pulse fill-none stroke-brand"
          strokeWidth="1"
        />
        <rect
          x="142" y="38" width="76" height="48" rx="10"
          pathLength={1}
          className="wake-draw fill-surface stroke-brand"
          strokeWidth="1.5"
          style={{ "--wake-delay": "300ms" } as React.CSSProperties}
        />
        <text
          x="180" y="66" textAnchor="middle" fontSize="10"
          className="wake-fade fill-copy-secondary font-mono"
          style={{ "--wake-delay": "800ms" } as React.CSSProperties}
        >
          API
        </text>

        {/* Database */}
        <path
          d="M280 46 V78 A34 8 0 0 0 348 78 V46"
          pathLength={1}
          className="wake-draw fill-surface stroke-surface-border-subtle"
          strokeWidth="1.5"
          style={{ "--wake-delay": "600ms" } as React.CSSProperties}
        />
        <ellipse
          cx="314" cy="46" rx="34" ry="8"
          pathLength={1}
          className="wake-draw fill-elevated stroke-surface-border-subtle"
          strokeWidth="1.5"
          style={{ "--wake-delay": "600ms" } as React.CSSProperties}
        />
        <text
          x="314" y="72" textAnchor="middle" fontSize="10"
          className="wake-fade fill-copy-muted font-mono"
          style={{ "--wake-delay": "1000ms" } as React.CSSProperties}
        >
          DB
        </text>

        {/* Ghost AI's cursor, drifting beside the node it is waiting on (same look as a collaborator's). */}
        <g className="wake-cursor">
          <path d="M0 0 L0 14 L4 10.5 L7.5 17 L10 16 L6.8 9.6 L12 9.2 Z" className="fill-ai" />
          <rect x="10" y="14" width="50" height="15" rx="7.5" className="fill-ai" />
          <text
            x="35" y="24.5" textAnchor="middle" fontSize="8.5"
            className="fill-copy-primary font-mono"
          >
            Ghost AI
          </text>
        </g>
      </svg>

      <p className="font-mono text-[11px] uppercase tracking-[0.4em] text-copy-faint">
        Ghost AI
      </p>
      <p
        className="mt-2 max-w-xs text-sm leading-relaxed text-copy-muted"
        role="status"
        aria-live="polite"
      >
        {messageFor(seconds)}
      </p>
      {/* Visual only; announcing it every second would drown the status above. */}
      <p
        className="mt-3 font-mono text-[11px] tabular-nums text-copy-faint"
        aria-hidden="true"
      >
        {formatElapsed(seconds)}
      </p>
    </div>
  );
};

export default ServerWakeLoader;
