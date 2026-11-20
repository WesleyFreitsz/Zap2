import React, { useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export default function AudioPlayer({ src, inverted }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    const onPlaying = () => setLoading(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("durationchange", onMeta);
    audio.addEventListener("ended", onEnd);
    audio.addEventListener("playing", onPlaying);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("durationchange", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("playing", onPlaying);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    setLoading(true);
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setLoading(false));
  };

  const seek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(event.target.value);
    setCurrent(audio.currentTime);
  };

  const max = duration || 0;
  const progress = max ? (current / max) * 100 : 0;
  const Icon = loading ? Loader2 : playing ? Pause : Play;

  return (
    <div className="flex w-64 max-w-full items-center gap-3 py-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pausar áudio" : "Tocar áudio"}
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          inverted ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <Icon className={cn("h-4 w-4", loading && "animate-spin", !playing && !loading && "translate-x-px")} aria-hidden="true" />
      </button>
      <div className={cn("min-w-0 flex-1", inverted ? "text-primary-foreground" : "text-primary")}>
        <input
          type="range"
          min={0}
          max={max}
          step="0.1"
          value={Math.min(current, max)}
          onChange={seek}
          aria-label="Posição do áudio"
          className="h-1 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-current [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-current"
          style={{
            background: `linear-gradient(to right, currentColor ${progress}%, color-mix(in srgb, currentColor 25%, transparent) ${progress}%)`,
          }}
        />
        <span className={cn("mt-1 block text-[11px] tabular-nums", inverted ? "opacity-75" : "text-muted-foreground")}>
          {formatTime(playing || current ? current : duration)}
        </span>
      </div>
    </div>
  );
}
