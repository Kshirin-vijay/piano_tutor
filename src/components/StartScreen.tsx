import { useEffect, useState } from "react";
import { ensureAudioReady } from "../audio/piano";
import { ensureSpeechReady } from "../audio/speech";
import { lockLandscape } from "../platform/orientation";
import { isAuthenticated } from "../progress/identity";
import Settings from "./Settings";
import "./Screen.css";
import "./StartScreen.css";

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT as string | undefined;

interface StartScreenProps {
  onPlay: () => void;
  onFreePlay: () => void;
  onSettings: () => void;
  /** Show a "Start over" option only when there is saved progress. */
  hasProgress: boolean;
  onStartOver: () => void;
  onSwitchStudent: () => void;
  onChangeClass: () => void;
}

export default function StartScreen({
  onPlay,
  onFreePlay,
  onSettings,
  hasProgress,
  onStartOver,
  onSwitchStudent,
  onChangeClass,
}: StartScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [totalPlays, setTotalPlays] = useState<number | null>(null);

  useEffect(() => {
    if (!API_ENDPOINT) return;
    fetch(`${API_ENDPOINT}/counter`)
      .then((r) => r.json())
      .then((d: { totalPlays: number }) => setTotalPlays(d.totalPlays))
      .catch(() => {});
  }, []);

  function incrementCounter() {
    if (!API_ENDPOINT) return;
    fetch(`${API_ENDPOINT}/counter`, { method: "POST" })
      .then((r) => r.json())
      .then((d: { totalPlays: number }) => setTotalPlays(d.totalPlays))
      .catch(() => {});
  }

  async function handlePlay() {
    if (loading) return;
    setLoading(true);
    incrementCounter();
    void lockLandscape();
    await ensureAudioReady();
    ensureSpeechReady();
    onPlay();
  }

  async function handleFreePlay() {
    if (loading) return;
    setLoading(true);
    incrementCounter();
    void lockLandscape();
    await ensureAudioReady();
    ensureSpeechReady();
    onFreePlay();
  }

  function handleSettingsClick() {
    if (isAuthenticated()) {
      setShowSettings(true);
    } else {
      onSettings();
    }
  }

  if (showSettings) {
    return (
      <Settings
        onClose={() => setShowSettings(false)}
        onSwitchStudent={onSwitchStudent}
        onChangeClass={onChangeClass}
      />
    );
  }

  return (
    <div className="screen">
      <div className="start-card">
        <div className="start-logo-icon">{"\uD83C\uDFB5"}</div>
        <div className="start-logo-title">
          Piano<br /><span>Friend</span>
        </div>

        <button
          className="btn btn-primary"
          type="button"
          onClick={handlePlay}
          disabled={loading}
        >
          <span className="btn-icon">{"\u25B6"}</span>
          {loading ? "Loading\u2026" : "Start Learning"}
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={handleFreePlay}
          disabled={loading}
        >
          <span className="btn-icon">{"\u266A"}</span>
          Free Play
        </button>

        <div className="start-divider" />

        <button
          className="btn btn-tertiary"
          type="button"
          onClick={handleSettingsClick}
        >
          {"\u2699"} Settings
        </button>

        {hasProgress && (
          <button
            className="btn btn-tertiary"
            type="button"
            onClick={onStartOver}
          >
            Start over
          </button>
        )}

        {totalPlays !== null && totalPlays > 0 && (
          <p className="play-counter">
            {"\u266B"} {totalPlays.toLocaleString()} play{totalPlays === 1 ? "" : "s"} and counting!
          </p>
        )}
      </div>
    </div>
  );
}
