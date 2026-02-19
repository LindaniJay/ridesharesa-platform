"use client";

import { useEffect, useState } from "react";

import Button from "@/app/components/ui/Button";

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
    <Button variant="secondary" onClick={onEnable} disabled={state === "loading" || state === "enabled"} title={title}>
      {label}
    </Button>
  );
}
