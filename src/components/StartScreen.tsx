import { useState } from "react";
import { ensureAudioReady } from "../audio/piano";
import { ensureSpeechReady } from "../audio/speech";
import { lockLandscape } from "../platform/orientation";
import MusicDecor from "./MusicDecor";
import Settings from "./Settings";
import "./Screen.css";
import "./StartScreen.css";

interface StartScreenProps {
  onPlay: () => void;
  onFreePlay: () => void;
  /** Show a "Start over" option only when there is saved progress. */
  hasProgress: boolean;
  onStartOver: () => void;
}

export default function StartScreen({
  onPlay,
  onFreePlay,
  hasProgress,
  onStartOver,
}: StartScreenProps) {
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  async function handlePlay() {
    if (loading) return;
    setLoading(true);
    // Lock to landscape on phones/tablets while we still have the tap gesture.
    void lockLandscape();
    // Unlock audio inside this user gesture and wait for samples to load.
    await ensureAudioReady();
    // Unlock speech in the same gesture so spoken prompts can play later.
    ensureSpeechReady();
    onPlay();
  }

  async function handleFreePlay() {
    if (loading) return;
    setLoading(true);
    void lockLandscape();
    await ensureAudioReady();
    ensureSpeechReady();
    onFreePlay();
  }

  if (showSettings) {
    return <Settings onClose={() => setShowSettings(false)} />;
  }

  return (
    <div className="screen">
      <MusicDecor />
      <button
        type="button"
        className="settings-fab game-icon-button"
        aria-label="Settings"
        onClick={() => setShowSettings(true)}
      >
        {"\u2699"}
      </button>
      <main className="start-menu" aria-label="Main menu">
        <div className="game-logo" aria-label="Piano Friend">
          <span className="game-logo__sparkle game-logo__sparkle--left">
            {"\u2726"}
          </span>
          <span className="game-logo__note">{"\u266B"}</span>
          <h1>
            <span>Piano</span>
            <span>Friend</span>
          </h1>
          <span className="game-logo__sparkle game-logo__sparkle--right">
            {"\u2726"}
          </span>
        </div>

        <div className="main-menu-buttons">
          <button
            className="level-button level-button--primary"
            type="button"
            onClick={handlePlay}
            disabled={loading}
          >
            <span className="level-button__icon">{"\u25B6"}</span>
            <span className="level-button__content">
              <span className="level-button__label">
                {loading ? "Loading\u2026" : "Start Learning"}
              </span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: hasProgress ? "54%" : "12%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"\u203A"}</span>
          </button>
          <button
            className="level-button"
            type="button"
            onClick={handleFreePlay}
            disabled={loading}
          >
            <span className="level-button__icon">{"\u266A"}</span>
            <span className="level-button__content">
              <span className="level-button__label">Free Play</span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: "28%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"\u203A"}</span>
          </button>
          <button
            className="level-button"
            type="button"
            onClick={() => setShowSettings(true)}
          >
            <span className="level-button__icon">{"\u2699"}</span>
            <span className="level-button__content">
              <span className="level-button__label">Settings</span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: "72%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"\u203A"}</span>
          </button>
          {hasProgress && (
            <button
              className="start-over-button"
              type="button"
              onClick={onStartOver}
            >
              Start over
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
