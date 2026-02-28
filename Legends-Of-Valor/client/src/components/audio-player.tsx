import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Pause, SkipForward, Music, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const MUSIC_TRACKS = [
  { name: "Epic Adventure", src: "/music.mp3" },
  ...Array.from({ length: 48 }, (_, i) => ({
    name: `Legends of Valor (Part ${i + 1})`,
    src: `/game-music-part${i.toString().padStart(2, '0')}.mp3`,
  })),
];

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      const nextIndex = (currentTrack + 1) % MUSIC_TRACKS.length;
      setCurrentTrack(nextIndex);
      setTimeout(() => {
        if (audio) {
          audio.src = MUSIC_TRACKS[nextIndex].src;
          audio.play().catch(console.error);
        }
      }, 100);
    };
    const handlePlay = () => { setIsPlaying(true); setIsLoading(false); setHasError(false); };
    const handlePause = () => setIsPlaying(false);
    const handleError = () => { setIsLoading(false); setHasError(true); setIsPlaying(false); };
    const handleCanPlay = () => { setIsLoading(false); setHasError(false); };
    const handleWaiting = () => setIsLoading(true);

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [isPlaying, currentTrack]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(err => { console.error("Audio play failed:", err); setIsPlaying(false); });
    }
  };

  const nextTrack = () => {
    const wasPlaying = isPlaying;
    if (audioRef.current) audioRef.current.pause();
    setCurrentTrack((prev) => (prev + 1) % MUSIC_TRACKS.length);
    setTimeout(() => { if (wasPlaying && audioRef.current) audioRef.current.play().catch(console.error); }, 100);
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
      <audio ref={audioRef} src={MUSIC_TRACKS[currentTrack].src} preload="auto" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <Music className="h-4 w-4 text-amber-400 flex-shrink-0" />
          <span className="text-xs text-zinc-300 truncate font-medium">
            {hasError ? 'Error loading track' : isLoading ? 'Loading...' : MUSIC_TRACKS[currentTrack].name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={togglePlay} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={nextTrack}>
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white" onClick={() => setIsMuted(!isMuted)}>
          {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
        <input 
          type="range" min="0" max="100" 
          value={isMuted ? 0 : volume * 100} 
          onChange={(e) => { const val = parseInt(e.target.value); setVolume(val / 100); if (val > 0) setIsMuted(false); }}
          className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500" 
        />
      </div>
    </div>
  );
}
