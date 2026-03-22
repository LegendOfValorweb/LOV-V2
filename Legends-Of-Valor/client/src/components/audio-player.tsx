import { useAudio, MUSIC_TRACKS } from "@/lib/audio-context";

export default function AudioPlayer() {
  const { audioRef, currentTrack } = useAudio();
  return (
    <audio
      ref={audioRef}
      src={MUSIC_TRACKS[currentTrack].src}
      preload="auto"
    />
  );
}
