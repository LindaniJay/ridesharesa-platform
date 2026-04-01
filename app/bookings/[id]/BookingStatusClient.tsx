"use client";

import Button from "@/app/components/ui/Button";
import type { BookingStatus } from "@prisma/client";

export default function BookingStatusClient(props: { status: BookingStatus }) {
  const { status } = props;
  const isPendingPayment = status === "PENDING_PAYMENT";
  const isPendingApproval = status === "PENDING_APPROVAL";

  if (!isPendingPayment && !isPendingApproval) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 text-sm">
      <div className="text-foreground/70">
        {isPendingApproval
          ? "Payment received. Waiting for admin approval."
          : "Waiting for admin confirmation after EFT payment."}
      </div>
      <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
        Refresh
      </Button>
    </div>
  );
}
