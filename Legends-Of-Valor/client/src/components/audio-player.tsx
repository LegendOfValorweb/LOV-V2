import React from "react";
import { useAudio, MUSIC_TRACKS } from "@/lib/audio-context";

export default function AudioPlayer() {
  const { audioRef, currentTrack } = useAudio();
  return (
    <audio
      ref={audioRef as React.RefObject<HTMLAudioElement>}
      src={MUSIC_TRACKS[currentTrack].src}
      preload="auto"
    />
  );
}
