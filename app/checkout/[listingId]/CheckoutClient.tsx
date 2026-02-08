"use client";

import { useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : 0;
}

export default function CheckoutClient(props: {
  listingId: string;
  dailyRateCents: number;
  currency: string;
  initialStartDate?: string;
  initialEndDate?: string;
}) {
  const [startDate, setStartDate] = useState(props.initialStartDate ?? "");
  const [endDate, setEndDate] = useState(props.initialEndDate ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "eft">("card");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pricing = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = daysBetween(start, end);
    if (days <= 0 || days > 30) return { days, totalCents: 0 };
    return { days, totalCents: days * props.dailyRateCents };
  }, [startDate, endDate, props.dailyRateCents]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select valid dates.");
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Please select valid dates.");
      return;
    }
    const days = daysBetween(start, end);
    if (days <= 0) {
      setError("End date must be after start date.");
      return;
    }
    if (days > 30) {
      setError("Bookings are limited to 30 days per checkout.");
      return;
    }

    setLoading(true);
    const endpoint = paymentMethod === "eft" ? "/api/checkout/manual" : "/api/checkout/session";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ listingId: props.listingId, startDate, endDate }),
    }).catch(() => null);

    if (!res || !res.ok) {
      const payload = res ? await res.json().catch(() => null) : null;
      setError(payload?.error ?? "Could not start checkout.");
      setLoading(false);
      return;
    }

    const payload = await res.json().catch(() => null);
    const url = payload?.url as string | undefined;
    if (!url) {
      setError(paymentMethod === "eft" ? "Could not start EFT checkout." : "Stripe checkout URL was missing.");
      setLoading(false);
      return;
    }

    window.location.assign(url);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="text-sm font-medium text-foreground/80">Dates</div>

      <label className="block">
        <div className="mb-1 text-sm">Start date</div>
        <Input
          name="startDate"
          type="date"
          required
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>

      <label className="block">
        <div className="mb-1 text-sm">End date</div>
        <Input
          name="endDate"
          type="date"
          required
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <div className="mt-1 text-xs text-foreground/50">End date must be after start date.</div>
      </label>

      <div className="pt-2 text-sm font-medium text-foreground/80">Price</div>
      <div className="rounded-lg border border-border bg-card p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Daily rate</span>
          <span>
            {(props.dailyRateCents / 100).toFixed(0)} {props.currency}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-foreground/60">Days</span>
          <span>{pricing?.days && pricing.days > 0 ? pricing.days : "—"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between font-medium">
          <span>Total</span>
          <span>
            {pricing && pricing.days > 0
              ? `${(pricing.totalCents / 100).toFixed(0)} ${props.currency}`
              : "Select dates"}
          </span>
        </div>
        <div className="mt-2 text-xs text-foreground/50">Final amount is confirmed on Stripe.</div>
      </div>

      <div className="pt-2 text-sm font-medium text-foreground/80">Payment</div>
      <div className="space-y-2 rounded-lg border border-border bg-card p-3 text-sm">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="paymentMethod"
            value="card"
            checked={paymentMethod === "card"}
            onChange={() => setPaymentMethod("card")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Card (Stripe)</span>
            <div className="text-xs text-foreground/60">You’ll be redirected to Stripe to complete payment securely.</div>
          </span>
        </label>

        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="paymentMethod"
            value="eft"
            checked={paymentMethod === "eft"}
            onChange={() => setPaymentMethod("eft")}
            className="mt-1"
          />
          <span>
            <span className="font-medium">Instant EFT (manual)</span>
            <div className="text-xs text-foreground/60">Create a booking and pay via EFT using the reference provided.</div>
          </span>
        </label>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Button className="w-full" disabled={loading} type="submit">
        {loading ? "Redirecting…" : paymentMethod === "eft" ? "Confirm & Get EFT details" : "Confirm & Pay"}
      </Button>
    </form>
  );
}
