import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "How earnings work • Guides • RideShare",
};

export default function HostEarningsGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">How earnings work</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          A simple overview of host earnings and payouts. Exact fees and payout timelines should be finalized for production.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What you earn</CardTitle>
            <CardDescription>Per booking revenue.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Your listing’s daily rate is used to calculate the booking total.</li>
              <li>Platform and payment processing fees may be deducted.</li>
              <li>Disputes, cancellations, or refunds can adjust the final amount.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
            <CardDescription>How payouts show up.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                Payouts are tracked in your host dashboard. Admins can create payout records and mark them as paid once funds are
                transferred.
              </p>
              <div className="text-sm">
                <Link className="underline" href="/host">
                  Open host dashboard
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reduce cancellations</CardTitle>
            <CardDescription>Protect your earnings.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Keep your listing description accurate and specific.</li>
              <li>Respond to questions quickly to build confidence.</li>
              <li>Ensure vehicle photos match the current condition.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support</CardTitle>
            <CardDescription>When something goes wrong.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                If a booking results in damage or a dispute, record evidence early and contact support with the booking ID.
              </p>
              <div className="text-sm">
                <Link className="underline" href="/host">
                  Host support tools
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="text-sm">
        <Link className="underline" href="/guides">
          Back to guides
        </Link>
      </div>
    </main>
  );
}
