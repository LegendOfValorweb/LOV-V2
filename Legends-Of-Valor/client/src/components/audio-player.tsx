import { useState, useRef, useEffect } from "react";
import { Volume2, VolumeX, Play, Pause, SkipForward, Music } from "lucide-react";
import { Button } from "@/components/ui/button";

const MUSIC_TRACKS = [
  { name: "Epic Adventure", src: "/music.mp3" },
];

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.3);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      console.error("Audio element error:", audio.error);
      setIsPlaying(false);
    };

    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.error("Audio play failed:", err);
            setIsPlaying(false);
          });
        }
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const nextTrack = () => {
    const wasPlaying = isPlaying;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setCurrentTrack((prev) => (prev + 1) % MUSIC_TRACKS.length);
    setTimeout(() => {
      if (wasPlaying && audioRef.current) {
        audioRef.current.play().catch(console.error);
      }
    }, 100);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-1">
      <div className="bg-card/80 backdrop-blur p-2 rounded-full border border-border shadow-lg flex items-center gap-2">
        <audio
          ref={audioRef}
          src={MUSIC_TRACKS[currentTrack].src}
          loop
          preload="auto"
        />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={togglePlay}
          title={isPlaying ? "Pause Music" : "Play Music"}
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full"
          onClick={nextTrack}
          title="Next Track"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 px-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min="0"
            max="100"
            value={isMuted ? 0 : volume * 100}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setVolume(val / 100);
              if (val > 0) setIsMuted(false);
            }}
            className="w-20 h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 ml-2">
        <Music className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          {MUSIC_TRACKS[currentTrack].name}
        </span>
      </div>
    </div>
  );
}
