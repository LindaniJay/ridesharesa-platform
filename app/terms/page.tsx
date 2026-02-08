import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Terms • RideShare",
};

export default function TermsPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          This is MVP terms content to support development and demos. Replace with legal-reviewed Terms before launch.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What RideShare is</CardTitle>
            <CardDescription>Marketplace role definitions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                RideShare is a peer-to-peer car rental marketplace. Hosts list vehicles and renters book vehicles for specific
                dates. Admins operate and moderate the platform.
              </p>
              <p>
                RideShare is not an insurance company, not a taxi service, and not a delivery carrier. Availability and pricing
                may change.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eligibility & accounts</CardTitle>
            <CardDescription>Basic account rules.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>You must provide accurate account details and maintain account security.</li>
              <li>Renters must hold a valid driver’s license and comply with local laws.</li>
              <li>Hosts must only list vehicles they are authorized to rent out.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookings & payments</CardTitle>
            <CardDescription>Key marketplace mechanics.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Bookings are made for a defined start and end date.</li>
              <li>Payments are processed by our payment provider (e.g., Stripe).</li>
              <li>Fees, taxes, and deposits may apply and are shown during checkout.</li>
            </ul>
            <div className="mt-3 text-sm">
              <Link className="underline" href="/cancellation">
                View cancellation policy
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Support & safety</CardTitle>
            <CardDescription>How to get help.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                If you experience an issue during a trip, contact support from your renter dashboard. Admins may request
                additional details or evidence to resolve disputes.
              </p>
              <p>
                Platform access may be limited or suspended for fraud, abuse, or violations of these terms.
              </p>
            </div>
            <div className="mt-3 text-sm">
              <Link className="underline" href="/renter#support">
                Contact support
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Important</CardTitle>
          <CardDescription>Production readiness.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-black/70 dark:text-white/70">
            These Terms are placeholder content. Before launch, replace this page with legally reviewed Terms and ensure you
            comply with applicable regulations.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
