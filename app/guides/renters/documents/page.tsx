import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Required documents • Guides • RideShare",
};

export default function RenterDocumentsGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Required documents</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          What renters typically need to provide for identity and eligibility. Requirements may vary by location.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Minimum requirements</CardTitle>
            <CardDescription>Common eligibility basics.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>A valid driver’s license.</li>
              <li>A government-issued ID.</li>
              <li>A verified email address and a working phone number.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verification status</CardTitle>
            <CardDescription>Where to check it.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                You can view verification status in your renter dashboard. Completing verification reduces friction when booking.
              </p>
              <div className="text-sm">
                <Link className="underline" href="/renter">
                  Open renter dashboard
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tips</CardTitle>
            <CardDescription>Avoid delays.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Ensure your license details match your profile information.</li>
              <li>Keep photos readable (no glare, full document visible).</li>
              <li>If you are traveling, check local driving rules before pickup.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need help?</CardTitle>
            <CardDescription>Support channels.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>If you have verification issues, contact support with your account email.</p>
              <div className="text-sm">
                <Link className="underline" href="/renter#support">
                  Contact support
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
