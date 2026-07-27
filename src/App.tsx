import { useState } from "react";
import { useAppState } from "./state/useAppState";
import { FINGERED_LEVELS, LEVELS } from "./levels/levels";
import type { Level } from "./levels/levels";
import { LEVEL_18_SONGS, LIGHTLY_ROW_SONG, SONGS } from "./songs/songs";
import type { Song } from "./songs/songs";
import { EAR_LEVELS } from "./ear/earLevels";
import type { EarLevel } from "./ear/earLevels";
import { SHEET_MUSIC_LEVELS } from "./sheet/sheetMusicLevels";
import { getSession } from "./auth/session";
import { hasActiveStudent } from "./auth/students";
import LoginScreen from "./components/LoginScreen";
import StudentSelectScreen from "./components/StudentSelectScreen";
import { logEvent } from "./logging/remoteLog";
import { getUserId } from "./progress/identity";
import StartScreen from "./components/StartScreen";
import SongSelect from "./components/SongSelect";
import LevelStage from "./components/LevelStage";
import FingerNumbersLevel from "./components/FingerNumbersLevel";
import EarTrainingLevel from "./components/EarTrainingLevel";
import SheetMusicLevel from "./components/SheetMusicLevel";
import FreePlayScreen from "./components/FreePlayScreen";
import "./components/Screen.css";

type Mode = "start" | "level" | "songSelect" | "song" | "freePlay";

const SONG_STAGE_INDEX = 8;
const LEVEL_18_SONG_STAGE_INDEX = LEVELS.length + 1;
const FINGER_NUMBERS_STAGE_INDEX = LEVELS.length + 2;
const SHEET_MUSIC_START_INDEX = FINGER_NUMBERS_STAGE_INDEX + 1;
const LIGHTLY_ROW_STAGE_INDEX =
  SHEET_MUSIC_START_INDEX + SHEET_MUSIC_LEVELS.length;
const EAR_TRAINING_START_INDEX =
  LIGHTLY_ROW_STAGE_INDEX + 1;
const FINGERED_LEVELS_START_INDEX =
  EAR_TRAINING_START_INDEX + EAR_LEVELS.length;
const TOTAL_STAGES = FINGERED_LEVELS_START_INDEX + FINGERED_LEVELS.length;

function earLevelForStage(stageIndex: number): EarLevel | null {
  const earIndex = stageIndex - EAR_TRAINING_START_INDEX;
  return earIndex >= 0 && earIndex < EAR_LEVELS.length
    ? EAR_LEVELS[earIndex]
    : null;
}

function isSongStageIndex(stageIndex: number): boolean {
  return (
    stageIndex === SONG_STAGE_INDEX ||
    stageIndex === LEVEL_18_SONG_STAGE_INDEX ||
    stageIndex === LIGHTLY_ROW_STAGE_INDEX
  );
}

function songsForStage(stageIndex: number): Song[] {
  if (stageIndex === LIGHTLY_ROW_STAGE_INDEX) return [LIGHTLY_ROW_SONG];
  return stageIndex === LEVEL_18_SONG_STAGE_INDEX ? LEVEL_18_SONGS : SONGS;
}

function sheetMusicLevelForStage(stageIndex: number) {
  const sheetIndex = stageIndex - SHEET_MUSIC_START_INDEX;
  return sheetIndex >= 0 && sheetIndex < SHEET_MUSIC_LEVELS.length
    ? SHEET_MUSIC_LEVELS[sheetIndex]
    : null;
}

function sourceLevelForStage(stageIndex: number): Level {
  if (stageIndex >= FINGERED_LEVELS_START_INDEX) {
    const level = FINGERED_LEVELS[stageIndex - FINGERED_LEVELS_START_INDEX];
    return {
      ...level,
      number: stageIndex + 1,
    };
  }

  const skippedSongStages =
    (stageIndex > SONG_STAGE_INDEX ? 1 : 0) +
    (stageIndex > LEVEL_18_SONG_STAGE_INDEX ? 1 : 0) +
    (stageIndex > LIGHTLY_ROW_STAGE_INDEX ? 1 : 0);
  const sourceIndex = stageIndex - skippedSongStages;
  const level = LEVELS[sourceIndex];
  return {
    ...level,
    number: stageIndex + 1,
  };
}

function stageLabel(stageIndex: number): string {
  if (isSongStageIndex(stageIndex)) {
    return stageIndex === LIGHTLY_ROW_STAGE_INDEX
      ? `Level ${stageIndex + 1} - Lightly Row`
      : `Level ${stageIndex + 1} - Song select`;
  }

  if (stageIndex === FINGER_NUMBERS_STAGE_INDEX) {
    return `Level ${stageIndex + 1} - Finger numbers`;
  }

  const sheetMusicLevel = sheetMusicLevelForStage(stageIndex);
  if (sheetMusicLevel) {
    return `Level ${stageIndex + 1} - ${sheetMusicLevel.title}`;
  }

  const earLevel = earLevelForStage(stageIndex);
  if (earLevel) {
    return `Level ${stageIndex + 1} - ${earLevel.title}`;
  }

  const level = sourceLevelForStage(stageIndex);
  return `Level ${level.number} - ${level.title}`;
}

const DEV_STAGE_OPTIONS = [
  { value: "start", label: "Start screen" },
  ...Array.from({ length: TOTAL_STAGES }, (_, stageIndex) => ({
    value: String(stageIndex),
    label: stageLabel(stageIndex),
  })),
];

export default function App() {
  const { highestLevel, completeLevel, resetProgress, reloadForLearner } =
    useAppState();

  const [authed, setAuthed] = useState(() => getSession() !== null);
  const [studentReady, setStudentReady] = useState(() => hasActiveStudent());
  const [mode, setMode] = useState<Mode>("start");
  const [levelIndex, setLevelIndex] = useState(0);
  const [song, setSong] = useState<Song | null>(null);
  const [songReturnIndex, setSongReturnIndex] = useState<number | null>(null);
  const [songStageCleared, setSongStageCleared] = useState(false);
  const [showDevStages, setShowDevStages] = useState(false);

  const lastIndex = TOTAL_STAGES - 1;
  const allLevelsDone = highestLevel >= TOTAL_STAGES;
  const resumeIndex = Math.min(highestLevel, lastIndex);

  function goToStage(stageIndex: number) {
    setLevelIndex(stageIndex);
    if (isSongStageIndex(stageIndex)) {
      setSongReturnIndex(stageIndex + 1);
      setSongStageCleared(false);
      setMode("songSelect");
      return;
    }

    setSongReturnIndex(null);
    setMode("level");
  }

  function handlePlay() {
    logEvent("practice.session_started");
    if (allLevelsDone) {
      setLevelIndex(LEVEL_18_SONG_STAGE_INDEX);
      setSongReturnIndex(null);
      setMode("songSelect");
    } else {
      goToStage(resumeIndex);
    }
  }

  function handleFreePlay() {
    logEvent("free_play.started");
    setSong(null);
    setSongReturnIndex(null);
    setMode("freePlay");
  }

  function handleLoggedOut() {
    setMode("start");
    setSong(null);
    setSongReturnIndex(null);
    setSongStageCleared(false);
    setStudentReady(false);
    setAuthed(false);
  }

  function handleStudentSelected() {
    setStudentReady(true);
    reloadForLearner();
    setMode("start");
    setLevelIndex(0);
    setSong(null);
    setSongReturnIndex(null);
    setSongStageCleared(false);
  }

  function handleStudentChanged() {
    reloadForLearner();
    setMode("start");
    setLevelIndex(0);
    setSong(null);
    setSongReturnIndex(null);
    setSongStageCleared(false);
  }

  function handleStartOver() {
    resetProgress();
    goToStage(0);
  }

  function handleLevelComplete() {
    completeLevel(levelIndex);

    if (levelIndex < lastIndex) {
      goToStage(levelIndex + 1);
    } else {
      setSongReturnIndex(null);
      setMode("songSelect");
    }
  }

  function handlePickSong(picked: Song) {
    setSong(picked);
    setMode("song");
  }

  function handleSongComplete() {
    setSong(null);
    if (songReturnIndex !== null) {
      // Mark the gate cleared (unlocks the next level) but stay on the song
      // picker so the child can replay, pick another song, or move on.
      completeLevel(levelIndex);
      setSongStageCleared(true);
    }

    setMode("songSelect");
  }

  function handleNextLevel() {
    if (songReturnIndex !== null) {
      goToStage(songReturnIndex);
    }
  }

  function handleDevStageChange(stage: string) {
    setShowDevStages(false);
    setSong(null);
    setSongReturnIndex(null);

    if (stage === "start") {
      setMode("start");
      return;
    }

    if (stage === "songSelect") {
      setLevelIndex(SONG_STAGE_INDEX);
      setMode("songSelect");
      return;
    }

    goToStage(Number(stage));
  }

  const devStageValue = mode === "start" ? mode : String(levelIndex);

  const devStagePicker = (
    <aside className="dev-stage-picker" aria-label="Level jump menu">
      <button
        type="button"
        className="dev-stage-picker__button"
        aria-label="Open level jump menu"
        aria-expanded={showDevStages}
        onClick={() => setShowDevStages((open) => !open)}
      >
        {"\u2302"}
      </button>
      {showDevStages ? (
        <div className="dev-stage-picker__panel" role="menu">
          {DEV_STAGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[
                "dev-stage-picker__item",
                option.value === devStageValue ? "is-current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              role="menuitem"
              onClick={() => handleDevStageChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  );

  if (!authed) {
    return <LoginScreen onLoggedIn={() => setAuthed(true)} />;
  }

  if (!studentReady) {
    return <StudentSelectScreen onSelected={handleStudentSelected} />;
  }

  const learnerKey = getUserId();

  if (mode === "start") {
    return (
      <div key={learnerKey}>
        {devStagePicker}
        <StartScreen
          onPlay={handlePlay}
          onFreePlay={handleFreePlay}
          hasProgress={highestLevel > 0}
          onStartOver={handleStartOver}
          onLoggedOut={handleLoggedOut}
          onStudentChanged={handleStudentChanged}
        />
      </div>
    );
  }

  if (mode === "freePlay") {
    return (
      <div key={learnerKey}>
        {devStagePicker}
        <FreePlayScreen onBack={() => setMode("start")} />
      </div>
    );
  }

  if (mode === "songSelect") {
    return (
      <div key={learnerKey}>
        {devStagePicker}
        <SongSelect
          levelNumber={songReturnIndex !== null ? levelIndex + 1 : undefined}
          title={
            levelIndex === LIGHTLY_ROW_STAGE_INDEX
              ? "Lightly Row"
              : levelIndex === LEVEL_18_SONG_STAGE_INDEX
              ? "Play a new song!"
              : undefined
          }
          subtitle={
            songStageCleared
              ? "Great job! Play another song, replay, or move on."
              : levelIndex === LIGHTLY_ROW_STAGE_INDEX
              ? "Play this song."
              : undefined
          }
          songs={songsForStage(levelIndex)}
          onPick={handlePickSong}
          onNext={
            songReturnIndex !== null && songStageCleared
              ? handleNextLevel
              : undefined
          }
        />
      </div>
    );
  }

  if (mode === "song" && song) {
    const songLevel: Level = {
      number: 0,
      notes: [],
      title: song.title,
      tasks: song.tasks,
    };
    return (
      <div key={learnerKey}>
        {devStagePicker}
        <LevelStage
          key={`song-${song.id}`}
          level={songLevel}
          headerText={
            songReturnIndex !== null
              ? `Level ${levelIndex + 1} - ${song.title}`
              : `\u266B ${song.title}`
          }
          continuous
          onLevelComplete={handleSongComplete}
        />
      </div>
    );
  }

  const earLevel = earLevelForStage(levelIndex);
  const sheetMusicLevel = sheetMusicLevelForStage(levelIndex);

  return (
    <div key={learnerKey}>
      {devStagePicker}
      {levelIndex === FINGER_NUMBERS_STAGE_INDEX ? (
        <FingerNumbersLevel
          key="finger-numbers"
          levelNumber={FINGER_NUMBERS_STAGE_INDEX + 1}
          onLevelComplete={handleLevelComplete}
        />
      ) : sheetMusicLevel ? (
        <SheetMusicLevel
          key={sheetMusicLevel.id}
          level={sheetMusicLevel}
          levelNumber={levelIndex + 1}
          onLevelComplete={handleLevelComplete}
        />
      ) : earLevel ? (
        <EarTrainingLevel
          key={`ear-${levelIndex}`}
          earLevel={earLevel}
          levelNumber={levelIndex + 1}
          onLevelComplete={handleLevelComplete}
        />
      ) : (
        <LevelStage
          key={levelIndex}
          level={sourceLevelForStage(levelIndex)}
          onLevelComplete={handleLevelComplete}
        />
      )}
    </div>
  );
}
