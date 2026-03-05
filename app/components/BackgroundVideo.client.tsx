"use client";

import { useEffect, useRef } from "react";

export default function BackgroundVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function freezeFrame() {
      video.pause();
      video.currentTime = 0;
    }

    video.addEventListener("loadeddata", freezeFrame);
    void video.play().then(freezeFrame).catch(() => {
      // Ignore autoplay restrictions; loadeddata handler still freezes when available.
    });

    return () => {
      video.removeEventListener("loadeddata", freezeFrame);
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
