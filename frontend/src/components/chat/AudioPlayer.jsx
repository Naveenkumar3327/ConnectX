import React, { useState, useEffect, useRef } from 'react';
import { FaPlay, FaPause } from 'react-icons/fa';

export default function AudioPlayer({ src }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(err => console.log('Playback error:', err));
    }
    setIsPlaying(!isPlaying);
  };

  const handleSpeedToggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    let nextSpeed = 1;
    if (playbackSpeed === 1) nextSpeed = 1.5;
    else if (playbackSpeed === 1.5) nextSpeed = 2;
    else nextSpeed = 1;

    audio.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const handleProgressChange = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-dark-incoming/40 border border-white/5 rounded-xl p-3 max-w-[280px] w-full shadow-inner">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Play/Pause Action */}
      <button
        type="button"
        onClick={togglePlay}
        className="h-8 w-8 rounded-full bg-whatsapp-teal text-white flex items-center justify-center hover:scale-105 active:scale-95 transition focus:outline-none"
      >
        {isPlaying ? <FaPause className="text-xs" /> : <FaPlay className="text-xs ml-0.5" />}
      </button>

      {/* Progress Slider and Waveform mockup */}
      <div className="flex-1 flex flex-col gap-1">
        {/* Simple Waveform layout */}
        <div className="flex items-end gap-[2px] h-6 px-1">
          {Array.from({ length: 24 }).map((_, idx) => {
            const h = 10 + Math.sin(idx * 0.4) * 12 + Math.random() * 4;
            const isPlayed = (idx / 24) * duration <= currentTime;
            return (
              <div
                key={idx}
                style={{ height: `${h}px` }}
                className={`flex-1 rounded-full ${
                  isPlaying && isPlayed
                    ? 'bg-whatsapp-light'
                    : isPlayed
                    ? 'bg-whatsapp-teal'
                    : 'bg-slate-600'
                } ${isPlaying && isPlayed ? 'wave-bar' : ''}`}
              />
            );
          })}
        </div>

        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleProgressChange}
          className="w-full accent-whatsapp-teal h-1 cursor-pointer bg-slate-700 rounded-lg outline-none"
        />

        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Speed Tag */}
      <button
        type="button"
        onClick={handleSpeedToggle}
        className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-white tracking-wide hover:bg-white/10 transition"
      >
        {playbackSpeed}x
      </button>
    </div>
  );
}
