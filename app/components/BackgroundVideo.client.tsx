"use client";

export default function BackgroundVideo() {
  return (
    <div
      className="fixed inset-0 z-0 bg-cover bg-center"
      style={{ backgroundImage: "url('/bg-platform.png')" }}
      aria-hidden
    />
  );
}
