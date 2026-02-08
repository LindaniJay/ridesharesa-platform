"use client";

import { useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

const CHAUFFEUR_RATE_CENTS_PER_KM = 10 * 100;

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
  initialChauffeurEnabled?: boolean;
  initialChauffeurKm?: number;
}) {
  const [startDate, setStartDate] = useState(props.initialStartDate ?? "");
  const [endDate, setEndDate] = useState(props.initialEndDate ?? "");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "eft">("card");
  const [chauffeurEnabled, setChauffeurEnabled] = useState(Boolean(props.initialChauffeurEnabled));
  const [chauffeurKm, setChauffeurKm] = useState<number>(props.initialChauffeurKm ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pricing = useMemo(() => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const days = daysBetween(start, end);
    if (days <= 0 || days > 30) return { days, baseCents: 0, chauffeurCents: 0, totalCents: 0, chauffeurKm: 0 };

    const baseCents = days * props.dailyRateCents;
    const km = Number.isFinite(chauffeurKm) ? Math.max(0, Math.floor(chauffeurKm)) : 0;
    const chauffeurCents = chauffeurEnabled && km > 0 ? km * CHAUFFEUR_RATE_CENTS_PER_KM : 0;
    return { days, baseCents, chauffeurCents, totalCents: baseCents + chauffeurCents, chauffeurKm: km };
  }, [startDate, endDate, props.dailyRateCents, chauffeurEnabled, chauffeurKm]);

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

    const km = Number.isFinite(chauffeurKm) ? Math.max(0, Math.floor(chauffeurKm)) : 0;
    if (chauffeurEnabled && km <= 0) {
      setError("Please enter an estimated distance (km) for Chauffeur.");
      return;
    }

    setLoading(true);
    const endpoint = paymentMethod === "eft" ? "/api/checkout/manual" : "/api/checkout/session";

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listingId: props.listingId,
        startDate,
        endDate,
        chauffeur: { enabled: chauffeurEnabled, kilometers: km },
      }),
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

        <div className="mt-2 flex items-center justify-between">
          <span className="text-foreground/60">Rental total</span>
          <span>
            {pricing && pricing.days > 0
              ? `${(pricing.baseCents / 100).toFixed(0)} ${props.currency}`
              : "—"}
          </span>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={chauffeurEnabled}
              onChange={(e) => setChauffeurEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Chauffeur</span>
              <div className="text-xs text-foreground/60">Adds 10 {props.currency}/km (estimated distance).</div>
            </span>
          </label>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <div className="mb-1 text-xs text-foreground/60">Estimated distance (km)</div>
              <Input
                type="number"
                min={0}
                step={1}
                value={Number.isFinite(chauffeurKm) ? chauffeurKm : 0}
                onChange={(e) => setChauffeurKm(e.target.value === "" ? 0 : Number(e.target.value))}
                disabled={!chauffeurEnabled}
              />
            </label>

            <div className="rounded-lg border border-border bg-card p-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-foreground/60">Chauffeur total</span>
                <span>
                  {pricing && pricing.days > 0 && chauffeurEnabled
                    ? `${(pricing.chauffeurCents / 100).toFixed(0)} ${props.currency}`
                    : "—"}
                </span>
              </div>
              <div className="mt-1 text-foreground/50">Calculated as km × 10.</div>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between font-medium">
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
