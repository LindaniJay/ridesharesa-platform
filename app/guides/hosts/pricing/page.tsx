import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Pricing guide • Guides • RideShare",
};

export default function HostPricingGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing guide</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          Practical guidance for setting a competitive daily rate and improving conversion.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Start with the market</CardTitle>
            <CardDescription>Competitive positioning.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Check similar listings in your city and adjust accordingly.</li>
              <li>Price slightly lower when new to build early bookings and reviews.</li>
              <li>Keep your listing approved and active to stay discoverable.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reduce friction</CardTitle>
            <CardDescription>Make booking feel safe.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Use clear photos and an accurate description.</li>
              <li>Set a clear pickup location and expectations.</li>
              <li>Respond quickly to questions and support requests.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operational tips</CardTitle>
            <CardDescription>Improve reliability.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Keep a consistent maintenance schedule.</li>
              <li>Make sure pickup instructions are clear and repeatable.</li>
              <li>Mark your listing unavailable during maintenance periods.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Link to product</CardTitle>
            <CardDescription>Where to manage pricing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>Update daily rate from your host dashboard listing editor.</p>
              <div className="text-sm">
                <Link className="underline" href="/host">
                  Go to host dashboard
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
