import { createContext, useContext, useRef, useState, useEffect, useCallback, type ReactNode } from "react";

export const MUSIC_TRACKS = [
  { name: "Epic Adventure", src: "/music.mp3" },
  ...Array.from({ length: 48 }, (_, i) => ({
    name: `Legends of Valor (Part ${i + 1})`,
    src: `/game-music-part${i.toString().padStart(2, "0")}.mp3`,
  })),
];

interface AudioContextValue {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  currentTrack: number;
  isLoading: boolean;
  hasError: boolean;
  togglePlay: () => void;
  toggleMute: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  setVolume: (v: number) => void;
  selectTrack: (index: number) => void;
}

const AudioCtx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const next = (currentTrack + 1) % MUSIC_TRACKS.length;
      setCurrentTrack(next);
      setTimeout(() => {
        if (audio) {
          audio.src = MUSIC_TRACKS[next].src;
          audio.play().catch(console.error);
        }
      }, 100);
    };
    const handlePlay = () => { setIsPlaying(true); setIsLoading(false); setHasError(false); };
    const handlePause = () => setIsPlaying(false);
    const handleError = () => { setIsLoading(false); setHasError(true); setIsPlaying(false); };
    const handleStalled = () => { setIsLoading(true); };
    const handleCanPlay = () => { setIsLoading(false); setHasError(false); };
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);
    audio.addEventListener("stalled", handleStalled);
    audio.addEventListener("canplay", handleCanPlay);
    audio.addEventListener("waiting", handleWaiting);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
      audio.removeEventListener("stalled", handleStalled);
      audio.removeEventListener("canplay", handleCanPlay);
      audio.removeEventListener("waiting", handleWaiting);
    };
  }, [currentTrack]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => setIsMuted(m => !m), []);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    if (v > 0) setIsMuted(false);
  }, []);

  const changeTrack = useCallback((index: number) => {
    const audio = audioRef.current;
    const wasPlaying = isPlaying;
    if (audio) audio.pause();
    setCurrentTrack(index);
    setTimeout(() => {
      if (audio) {
        audio.src = MUSIC_TRACKS[index].src;
        if (wasPlaying) audio.play().catch(console.error);
      }
    }, 80);
  }, [isPlaying]);

  const nextTrack = useCallback(() => {
    changeTrack((currentTrack + 1) % MUSIC_TRACKS.length);
  }, [currentTrack, changeTrack]);

  const prevTrack = useCallback(() => {
    changeTrack((currentTrack - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length);
  }, [currentTrack, changeTrack]);

  const selectTrack = useCallback((index: number) => {
    changeTrack(index);
  }, [changeTrack]);

  return (
    <AudioCtx.Provider value={{
      audioRef, isPlaying, volume, isMuted, currentTrack, isLoading, hasError,
      togglePlay, toggleMute, nextTrack, prevTrack, setVolume, selectTrack,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
