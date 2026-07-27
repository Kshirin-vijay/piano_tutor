import "./Celebration.css";

interface CelebrationProps {
  visible: boolean;
  /** Use a larger, warmer treatment for a finished level. */
  big?: boolean;
  title: string;
  subtitle?: string;
  /** Changes whenever a new celebration starts, to retrigger the animation. */
  animationKey: number;
}

export default function Celebration({
  visible,
  big = false,
  title,
  subtitle,
  animationKey,
}: CelebrationProps) {
  if (!visible) return null;
  return (
    <div className={`celebration ${big ? "is-big" : ""}`}>
      <div className="celebration__card" key={animationKey}>
        <div className="celebration__star" aria-hidden="true">
          {big ? "🌟" : "⭐"}
        </div>
        <p className="celebration__title">{title}</p>
        {subtitle && <p className="celebration__subtitle">{subtitle}</p>}
      </div>
    </div>
  );
}
