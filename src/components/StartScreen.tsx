import { useState } from "react";
import { ensureAudioReady } from "../audio/piano";
import { ensureSpeechReady } from "../audio/speech";
import { lockLandscape } from "../platform/orientation";
import { posthog } from "../analytics/posthog";
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
    posthog.capture("learning_started", { has_progress: hasProgress });
    // Lock to landscape on phones/tablets while we still have the tap gesture.
    void lockLandscape();
    // Unlock audio inside this user gesture and wait for samples to load.
    try {
      await ensureAudioReady();
    } catch (err) {
      posthog.captureException(err);
    }
    // Unlock speech in the same gesture so spoken prompts can play later.
    ensureSpeechReady();
    onPlay();
  }

  async function handleFreePlay() {
    if (loading) return;
    setLoading(true);
    posthog.capture("free_play_started");
    void lockLandscape();
    try {
      await ensureAudioReady();
    } catch (err) {
      posthog.captureException(err);
    }
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
        {"⚙"}
      </button>
      <main className="start-menu" aria-label="Main menu">
        <div className="game-logo" aria-label="Piano Friend">
          <span className="game-logo__sparkle game-logo__sparkle--left">
            {"✦"}
          </span>
          <span className="game-logo__note">{"♫"}</span>
          <h1>
            <span>Piano</span>
            <span>Friend</span>
          </h1>
          <span className="game-logo__sparkle game-logo__sparkle--right">
            {"✦"}
          </span>
        </div>

        <div className="main-menu-buttons">
          <button
            className="level-button level-button--primary"
            type="button"
            onClick={handlePlay}
            disabled={loading}
          >
            <span className="level-button__icon">{"▶"}</span>
            <span className="level-button__content">
              <span className="level-button__label">
                {loading ? "Loading…" : "Start Learning"}
              </span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: hasProgress ? "54%" : "12%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"›"}</span>
          </button>
          <button
            className="level-button"
            type="button"
            onClick={handleFreePlay}
            disabled={loading}
          >
            <span className="level-button__icon">{"♪"}</span>
            <span className="level-button__content">
              <span className="level-button__label">Free Play</span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: "28%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"›"}</span>
          </button>
          <button
            className="level-button"
            type="button"
            onClick={() => {
              posthog.capture("settings_opened");
              setShowSettings(true);
            }}
          >
            <span className="level-button__icon">{"⚙"}</span>
            <span className="level-button__content">
              <span className="level-button__label">Settings</span>
              <span className="level-button__progress" aria-hidden="true">
                <span style={{ width: "72%" }} />
              </span>
            </span>
            <span className="level-button__arrow">{"›"}</span>
          </button>
          {hasProgress && (
            <button
              className="start-over-button"
              type="button"
              onClick={() => {
                posthog.capture("progress_reset");
                onStartOver();
              }}
            >
              Start over
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
