"use client";

import { useEffect, useRef } from "react";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const stableVideo: HTMLVideoElement = videoEl;

    function freezeFrame() {
      stableVideo.pause();
      stableVideo.currentTime = 0;
    }

    stableVideo.addEventListener("loadeddata", freezeFrame);
    void stableVideo.play().then(freezeFrame).catch(() => {
      // Ignore autoplay restrictions; loadeddata handler still freezes when available.
    });

    return () => {
      stableVideo.removeEventListener("loadeddata", freezeFrame);
    };
  }, []);

  return (
    <video
      ref={videoRef}
      className="fixed inset-0 z-0 h-full w-full object-cover"
      preload="auto"
      muted
      playsInline
      aria-hidden
    >
      <source src="/bg-video.mp4" type="video/mp4" />
    </video>
  );
}
