import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "How it works • RideShare",
};

export default function HowItWorksPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">How it works</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          RideShare is a peer-to-peer car rental marketplace. Hosts list cars, renters book them, and admins keep the marketplace safe and high-quality.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>For renters</CardTitle>
            <CardDescription>Find a car and book in minutes.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Browse approved listings on the map.</li>
              <li>Open a listing to review price and details.</li>
              <li>Choose dates and complete checkout.</li>
              <li>View your booking confirmation and details.</li>
            </ol>
            <div className="mt-4">
              <Link className="text-sm font-medium underline" href="/listings">
                Browse listings
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For hosts</CardTitle>
            <CardDescription>List your car and earn income.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Create a listing with title, description, and pricing.</li>
              <li>Pick a location on the map.</li>
              <li>Submit the listing for approval.</li>
              <li>Once approved, your listing appears in search.</li>
            </ol>
            <div className="mt-4">
              <Link className="text-sm font-medium underline" href="/host">
                Go to host dashboard
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For admins</CardTitle>
            <CardDescription>Control marketplace quality and safety.</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>Review and approve new listings.</li>
              <li>Pause or set listing status when needed.</li>
              <li>Manage user roles (renter/host/admin).</li>
              <li>Monitor bookings for issues and disputes.</li>
            </ol>
            <div className="mt-4">
              <Link className="text-sm font-medium underline" href="/admin">
                Open admin dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Next: enterprise features</CardTitle>
          <CardDescription>Payments, identity verification, audit logs, and operational tooling.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-black/70 dark:text-white/70">
            To implement the full enterprise set (real payments, emails, uploads, audit logs, monitoring, tests, Postgres), we’ll pick providers and configure environments.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
