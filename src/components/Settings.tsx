import { useState } from "react";
import { ensureSpeechReady, speak } from "../audio/speech";
import { getByPath } from "../config/appConfig";
import { resetConfig, setConfigValue } from "../config/actions";
import { getSchema } from "../config/schema";
import type { Setting } from "../config/schema";
import { useConfig } from "../config/useConfig";
import MusicDecor from "./MusicDecor";
import ProgressDashboard from "./ProgressDashboard";
import "./Screen.css";
import "./Settings.css";

interface SettingsProps {
  onClose: () => void;
}

/** Friendlier group headings; falls back to the namespace name. */
const GROUP_LABELS: Record<string, string> = {
  speech: "Voice",
  tempo: "Timing",
};

function groupOf(path: string): string {
  return path.split(".")[0];
}

export default function Settings({ onClose }: SettingsProps) {
  const [showProgress, setShowProgress] = useState(false);
  const config = useConfig();
  const schema = getSchema();
  const entries = Object.entries(schema) as [string, Setting][];

  if (showProgress) {
    return <ProgressDashboard onClose={() => setShowProgress(false)} />;
  }

  // Preserve schema order while grouping by namespace.
  const groups: { name: string; items: [string, Setting][] }[] = [];
  for (const entry of entries) {
    const name = groupOf(entry[0]);
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, items: [] };
      groups.push(group);
    }
    group.items.push(entry);
  }

  function renderControl(path: string, setting: Setting) {
    const value = getByPath(config, path);

    if (setting.type === "boolean") {
      const checked = value === true;
      return (
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          className={`settings-switch ${checked ? "is-on" : ""}`}
          onClick={() => setConfigValue(path, !checked)}
        >
          <span className="settings-switch__track">
            <span className="settings-switch__thumb" />
          </span>
          <span className="settings-switch__state">{checked ? "On" : "Off"}</span>
        </button>
      );
    }

    if (setting.type === "number") {
      const num = typeof value === "number" ? value : setting.default;
      return (
        <div className="settings-range">
          <input
            type="range"
            min={setting.min}
            max={setting.max}
            step={setting.step ?? 1}
            value={num}
            onChange={(event) =>
              setConfigValue(path, Number(event.target.value))
            }
          />
          <output className="settings-range__value">{num}</output>
        </div>
      );
    }

    // enum
    const current = typeof value === "string" ? value : setting.default;
    return (
      <select
        className="settings-select"
        value={current}
        onChange={(event) => setConfigValue(path, event.target.value)}
      >
        {setting.values.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  function testVoice() {
    ensureSpeechReady();
    speak("Tap C");
  }

  return (
    <div className="screen">
      <MusicDecor />
      <div className="card settings-card">
        <h1 className="card__title">Settings</h1>
        <p className="card__subtitle">For grown-ups</p>

        {groups.map((group) => (
          <section key={group.name} className="settings-group">
            <h2 className="settings-group__title">
              {GROUP_LABELS[group.name] ?? group.name}
            </h2>
            {group.items.map(([path, setting]) => (
              <div key={path} className="settings-row">
                <label className="settings-row__label">
                  {setting.description}
                </label>
                {renderControl(path, setting)}
              </div>
            ))}
            {group.name === "speech" ? (
              <button
                type="button"
                className="text-button"
                onClick={testVoice}
              >
                Test voice
              </button>
            ) : null}
          </section>
        ))}

        <section className="settings-group">
          <h2 className="settings-group__title">Progress</h2>
          <button
            type="button"
            className="text-button"
            onClick={() => setShowProgress(true)}
          >
            View practice progress
          </button>
        </section>

        <button className="big-button" type="button" onClick={onClose}>
          Done
        </button>
        <button
          className="text-button"
          type="button"
          onClick={() => resetConfig()}
        >
          Reset to defaults
        </button>
      </div>
    </div>
  );
}
