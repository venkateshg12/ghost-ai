import { cn } from "@/lib/utils";

const RADIUS = 26;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const toneFor = (score: number) =>
  score >= 75
    ? "text-state-success"
    : score >= 50
      ? "text-state-warning"
      : "text-state-error";

// A score ring: the arc is the score out of 100, the centre the grade. Drawn in SVG with currentColor, so
// the colour follows the score through one text class.
const HealthRing = ({ score, grade }: { score: number; grade: string }) => (
  <div
    className={cn("relative h-[4.75rem] w-[4.75rem] shrink-0", toneFor(score))}
    role="img"
    aria-label={`Architecture health ${score} out of 100, grade ${grade}`}
  >
    <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        strokeWidth="5"
        className="stroke-surface-border"
      />
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        fill="none"
        strokeWidth="5"
        strokeLinecap="round"
        stroke="currentColor"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
    <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
      <span className="font-mono text-xl font-bold tabular-nums">{score}</span>
      <span className="mt-0.5 font-mono text-[9px] font-semibold text-copy-muted">
        GRADE {grade}
      </span>
    </div>
  </div>
);

export default HealthRing;
