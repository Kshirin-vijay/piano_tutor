import { SONGS } from "../songs/songs";
import type { Song } from "../songs/songs";
import MusicDecor from "./MusicDecor";
import "./Screen.css";
import "./SongSelect.css";

interface SongSelectProps {
  levelNumber?: number;
  title?: string;
  subtitle?: string;
  songs?: Song[];
  onPick: (song: Song) => void;
  onNext?: () => void;
}

export default function SongSelect({
  levelNumber,
  title = "Play your first song!",
  subtitle = "Pick a song to play.",
  songs = SONGS,
  onPick,
  onNext,
}: SongSelectProps) {
  return (
    <div className="screen">
      <MusicDecor />
      <div className="card">
        {levelNumber ? (
          <div className="song-select__level">Level {levelNumber}</div>
        ) : null}
        <div style={{ fontSize: "3rem", lineHeight: 1 }}>{"\uD83C\uDFB5"}</div>
        <h1 className="card__title">{title}</h1>
        <p className="card__subtitle">{subtitle}</p>
        <div className="song-list">
          {songs.map((song) => (
            <button
              key={song.id}
              type="button"
              className={`song-item ${song.available ? "" : "is-soon"}`}
              disabled={!song.available}
              onClick={() => song.available && onPick(song)}
            >
              <span className="song-item__note">{"\u266B"}</span>
              <span className="song-item__title">{song.title}</span>
            </button>
          ))}
        </div>
        {onNext ? (
          <button
            type="button"
            className="song-select__next"
            onClick={onNext}
          >
            Go to next level {"\u2192"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
