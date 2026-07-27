import "./ProgressDots.css";

interface ProgressDotsProps {
  total: number;
  /** Number of steps already completed. */
  completed: number;
}

export default function ProgressDots({ total, completed }: ProgressDotsProps) {
  return (
    <div
      className="progress-dots"
      role="img"
      aria-label={`Step ${Math.min(completed + 1, total)} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={[
            "progress-dot",
            i < completed ? "is-done" : "",
            i === completed ? "is-current" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}
