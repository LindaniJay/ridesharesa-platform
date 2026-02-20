"use client";

import { useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import Input from "@/app/components/ui/Input";

function formatRands(amountCents: number) {
  return new Intl.NumberFormat("en-ZA", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(
    amountCents / 100,
  );
}

export default function AdminPayoutCalculator() {
  const [bookingTotal, setBookingTotal] = useState<number>(0);
  const [platformFeePct, setPlatformFeePct] = useState<number>(0);

  const calc = useMemo(() => {
    const totalCents = Number.isFinite(bookingTotal) ? Math.max(0, Math.round(bookingTotal * 100)) : 0;
    const pct = Number.isFinite(platformFeePct) ? Math.min(100, Math.max(0, platformFeePct)) : 0;
    const feeCents = Math.round((totalCents * pct) / 100);
    const hostPayoutCents = Math.max(0, totalCents - feeCents);
    return { totalCents, pct, feeCents, hostPayoutCents };
  }, [bookingTotal, platformFeePct]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payout calculator</CardTitle>
        <CardDescription>Estimate host payout from a booking total.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <label className="block">
          <div className="text-sm font-medium">Booking total (ZAR)</div>
          <Input
            className="mt-1"
            type="number"
            min={0}
            step="0.01"
            value={Number.isFinite(bookingTotal) ? bookingTotal : 0}
            onChange={(e) => setBookingTotal(e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </label>

        <label className="block">
          <div className="text-sm font-medium">Platform fee (%)</div>
          <Input
            className="mt-1"
            type="number"
            min={0}
            max={100}
            step="0.1"
            value={Number.isFinite(platformFeePct) ? platformFeePct : 0}
            onChange={(e) => setPlatformFeePct(e.target.value === "" ? 0 : Number(e.target.value))}
          />
        </label>

        <div className="rounded-xl border border-border bg-card p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-foreground/60">Platform fee</span>
            <span className="tabular-nums">{formatRands(calc.feeCents)} ZAR</span>
          </div>
          <div className="mt-2 flex items-center justify-between font-medium">
            <span>Host payout</span>
            <span className="tabular-nums">{formatRands(calc.hostPayoutCents)} ZAR</span>
          </div>
          <div className="mt-1 text-xs text-foreground/60">Total: {formatRands(calc.totalCents)} ZAR</div>
        </div>
      </CardContent>
    </Card>
  );
}
