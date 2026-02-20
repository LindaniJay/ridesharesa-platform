"use client";

import { useEffect, useState } from "react";

import Button from "@/app/components/ui/Button";
import type { BookingStatus } from "@prisma/client";

export default function BookingStatusClient(props: { status: BookingStatus; method: "stripe" | "manual" }) {
  const { status, method } = props;
  const isPendingPayment = status === "PENDING_PAYMENT";
  const isPendingApproval = status === "PENDING_APPROVAL";
  const [seconds, setSeconds] = useState(10);

  useEffect(() => {
    if (!isPendingPayment) return;
    if (method !== "stripe") return;

    const interval = window.setInterval(() => {
      setSeconds((s) => (s <= 1 ? 10 : s - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isPendingPayment, method]);

  useEffect(() => {
    if (!isPendingPayment) return;
    if (method !== "stripe") return;
    if (seconds !== 1) return;
    window.location.reload();
  }, [isPendingPayment, method, seconds]);

  if (!isPendingPayment && !isPendingApproval) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="text-foreground/70">
        {isPendingApproval
          ? "Payment received. Waiting for admin approval."
          : method === "stripe"
            ? `Checking payment status… refreshing in ${seconds}s`
            : "Waiting for admin confirmation after EFT payment."}
      </div>
      {method === "stripe" && isPendingPayment ? (
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          Refresh now
        </Button>
      ) : isPendingApproval ? (
        <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      ) : null}
    </div>
  );
}
