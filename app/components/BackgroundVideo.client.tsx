"use client";

import { useState } from "react";

export default function BackgroundVideo() {
  const [videoUnavailable, setVideoUnavailable] = useState(false);

  if (videoUnavailable) {
    return (
      <div
        className="fixed inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/bg-platform.png')" }}
        aria-hidden
      />
    );
  }

  return (
    <video
      className="fixed inset-0 z-0 h-full w-full object-cover"
      preload="metadata"
      autoPlay
      loop
      muted
      playsInline
      onError={() => setVideoUnavailable(true)}
      aria-hidden
    >
      <source src="/bg-video.mp4" type="video/mp4" />
    </video>
  );
}
