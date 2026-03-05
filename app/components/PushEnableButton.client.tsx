"use client";

import { useEffect, useState } from "react";

type State = "idle" | "loading" | "enabled" | "unsupported" | "denied" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function PushEnableButton() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    let cancelled = false;

    async function checkExisting() {
      if (!("serviceWorker" in navigator)) return;
      if (!("PushManager" in window)) return;
      if (!("Notification" in window)) return;

      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (cancelled) return;
        if (existing) setState("enabled");
      } catch {
        // Ignore.
      }
    }

    void checkExisting();

    return () => {
      cancelled = true;
    };
  }, []);

  const supported =
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window;

  if (!supported) return null;

  const label =
    state === "enabled"
      ? "Notifications on"
      : state === "loading"
        ? "Enabling…"
        : state === "denied"
          ? "Notifications blocked"
          : "Enable notifications";

  const title =
    state === "denied"
      ? "Notifications are blocked in your browser settings"
      : state === "error"
        ? "Could not enable notifications"
        : undefined;

  const toneClass =
    state === "enabled"
      ? "border-emerald-300/60 bg-emerald-500/25 text-white"
      : state === "denied" || state === "error"
        ? "border-red-300/60 bg-red-500/20 text-white"
        : "border-white/40 bg-slate-950/35 text-white hover:bg-slate-950/55";

  async function onEnable() {
    if (state === "loading" || state === "enabled") return;

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    setState("loading");

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
      if (!publicKey) {
        setState("error");
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      let subscription = await reg.pushManager.getSubscription();

      if (!subscription) {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });

      if (!res.ok) {
        setState("error");
        return;
      }

      setState("enabled");
    } catch (error) {
      console.warn("Enable notifications failed", error);
      setState("error");
    }
  }

  return (
    <button
      type="button"
      onClick={onEnable}
      disabled={state === "loading" || state === "enabled"}
      title={title}
      aria-label={label}
      className={`group relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border shadow-sm transition ${toneClass} disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
      >
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
        <path d="M9 17a3 3 0 0 0 6 0" />
      </svg>
      <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        Enable notification
      </span>
    </button>
  );
}
