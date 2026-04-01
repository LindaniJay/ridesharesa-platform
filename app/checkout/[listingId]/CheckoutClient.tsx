"use client";

import { useMemo, useState } from "react";

import Button from "@/app/components/ui/Button";
import Input from "@/app/components/ui/Input";

const CHAUFFEUR_RATE_CENTS_PER_KM = 10 * 100;

function formatMoney(amountCents: number, currency: string) {
  const c = currency || "ZAR";
  try {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 0,
    }).format(amountCents / 100);
  } catch {
    return `${(amountCents / 100).toFixed(0)} ${c}`;
  }
}

function daysBetween(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) ? days : 0;
}

export default function CheckoutClient(props: {
  listingId: string;
  dailyRateCents: number;
  currency: string;
  eftDetails: {
    bankName: string;
    accountName: string;
    accountNumber: string;
    branchCode: string;
  };
  hasEftDetails: boolean;
  initialStartDate?: string;
  initialEndDate?: string;
  initialChauffeurEnabled?: boolean;
  initialChauffeurKm?: number;
}) {
  const [startDate, setStartDate] = useState(props.initialStartDate ?? "");
  const [endDate, setEndDate] = useState(props.initialEndDate ?? "");
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

    const res = await fetch("/api/checkout/manual", {
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
      setError(payload?.error ?? "Could not create booking. Please try again.");
      setLoading(false);
      return;
    }

    const payload = await res.json().catch(() => null);
    const url = payload?.url as string | undefined;
    if (!url) {
      setError("Could not create booking. Please try again.");
      setLoading(false);
      return;
    }

    window.location.assign(url);
  }

  const hasDates = Boolean(pricing && pricing.days > 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Step 1: Dates */}
      <div className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground/85">1. Trip dates</div>
          <div className="text-xs text-foreground/55">Max 30 days</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>
      </div>

      {/* Step 2: Fare summary */}
      <div className="rounded-xl border border-border bg-card/70 p-4 text-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-foreground/85">2. Fare summary</div>
          <div className="text-xs text-foreground/55">Live calculator</div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-foreground/60">Daily rate</span>
          <span>{formatMoney(props.dailyRateCents, props.currency)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-foreground/60">Days</span>
          <span>{hasDates ? pricing!.days : "-"}</span>
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-foreground/60">Rental total</span>
          <span>{hasDates ? formatMoney(pricing!.baseCents, props.currency) : "-"}</span>
        </div>

        {/* Chauffeur add-on */}
        <div className="mt-3 rounded-lg border border-border bg-background/40 p-3">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              checked={chauffeurEnabled}
              onChange={(e) => setChauffeurEnabled(e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Add chauffeur</span>
              <div className="text-xs text-foreground/60">Adds 10 {props.currency}/km based on estimated distance.</div>
            </span>
          </label>

          {chauffeurEnabled ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1 text-xs text-foreground/60">Estimated distance (km)</div>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={Number.isFinite(chauffeurKm) ? chauffeurKm : 0}
                  onChange={(e) => setChauffeurKm(e.target.value === "" ? 0 : Number(e.target.value))}
                />
              </label>
              <div className="rounded-lg border border-border bg-card p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground/60">Chauffeur total</span>
                  <span>{hasDates ? formatMoney(pricing!.chauffeurCents, props.currency) : "-"}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg border border-border bg-background/45 px-3 py-2 font-medium">
          <span>Total</span>
          <span>{hasDates ? formatMoney(pricing!.totalCents, props.currency) : "Select dates"}</span>
        </div>
      </div>

      {/* Step 3: Confirm & pay via EFT */}
      <div className="rounded-xl border border-border bg-card/70 p-4 text-sm">
        <div className="text-sm font-semibold text-foreground/85">3. Confirm & pay via EFT</div>
        <p className="mt-1 text-xs text-foreground/60">
          Your booking will be created immediately. You&apos;ll get a unique payment reference to use for your EFT bank transfer.
        </p>

        {props.hasEftDetails ? (
          <div className="mt-3 rounded-lg border border-border bg-background/40 p-3 text-xs">
            <div className="font-medium text-foreground/80">Bank details (for your EFT transfer)</div>
            <div className="mt-2 grid gap-1.5 text-foreground/70">
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground/60">Bank</span>
                <span>{props.eftDetails.bankName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground/60">Account name</span>
                <span>{props.eftDetails.accountName}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground/60">Account number</span>
                <span>{props.eftDetails.accountNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-foreground/60">Branch code</span>
                <span>{props.eftDetails.branchCode}</span>
              </div>
            </div>
          </div>
        ) : null}

        <ul className="mt-3 list-disc pl-5 text-xs text-foreground/60 space-y-1">
          <li>I have my driver license and ID ready for pickup verification.</li>
          <li>I understand cancellation, payment, and return responsibilities.</li>
        </ul>
      </div>

      {error ? <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600">{error}</div> : null}

      <Button className="h-11 w-full text-base" disabled={loading || !hasDates} type="submit">
        {loading ? "Creating booking..." : "Confirm booking & get EFT reference"}
      </Button>
      <div className="text-center text-xs text-foreground/55">
        After confirmation you&apos;ll see your payment reference and can upload proof of payment.
      </div>
    </form>
  );
}
