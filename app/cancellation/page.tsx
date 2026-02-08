import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Cancellation • RideShare",
};

export default function CancellationPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Cancellation policy</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          This is MVP policy content for development and demos. Replace with your final policy (fees, refunds, and timelines)
          before launch.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>For renters</CardTitle>
            <CardDescription>General cancellation guidance.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Cancel as early as possible to reduce fees and avoid host disruption.</li>
              <li>Refund eligibility depends on timing and trip status.</li>
              <li>Some processing fees may be non-refundable.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For hosts</CardTitle>
            <CardDescription>How cancellations affect earnings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Host payouts may be adjusted when a trip is cancelled or refunded.</li>
              <li>Repeated cancellations or disputes may trigger additional review.</li>
              <li>Keep listing details accurate to reduce misunderstandings.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disputes</CardTitle>
            <CardDescription>When you disagree with an outcome.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                If you believe a cancellation or refund outcome is incorrect, contact support with the booking ID and a brief
                explanation.
              </p>
              <p>
                Admins may request additional evidence (messages, photos, receipts) to resolve disputes.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
            <CardDescription>Contact support.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>You can create a support ticket from your renter dashboard.</p>
              <div className="text-sm">
                <Link className="underline" href="/renter#support">
                  Contact support
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Related</CardTitle>
          <CardDescription>More information.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="underline" href="/terms">
              Terms
            </Link>
            <Link className="underline" href="/privacy">
              Privacy
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
