"use client";

import { useEffect, useState } from "react";

import Button from "@/app/components/ui/Button";

export default function BookingStatusClient(props: { pending: boolean; method: "stripe" | "manual" }) {
  const { pending, method } = props;
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    if (!pending) return;
    if (method !== "stripe") return;

    const interval = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 10 : s - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [pending, method]);

  useEffect(() => {
    if (!pending) return;
    if (method !== "stripe") return;
    if (seconds !== 1) return;
    window.location.reload();
  }, [pending, method, seconds]);

  if (!pending) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="text-foreground/70">
        {method === "stripe"
          ? `Checking payment status… refreshing in ${seconds}s`
          : "Waiting for admin confirmation after EFT payment."}
      </div>
      {method === "stripe" ? (
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          Refresh now
        </Button>
      ) : null}
    </div>
  );
}
