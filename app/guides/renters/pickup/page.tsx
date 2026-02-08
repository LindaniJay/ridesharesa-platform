import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Pickup checklist • Guides • RideShare",
};

export default function RenterPickupGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Pickup checklist</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          A simple checklist to help renters reduce disputes and have a smooth start to the trip.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Before you arrive</CardTitle>
            <CardDescription>Set yourself up for success.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Confirm the pickup location and time window.</li>
              <li>Bring your driver’s license and a valid ID document.</li>
              <li>Have your booking confirmation available on your phone.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vehicle walkthrough</CardTitle>
            <CardDescription>Document condition at pickup.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Take clear photos of all sides of the car (include the number plate).</li>
              <li>Capture close-ups of any existing scratches or dents.</li>
              <li>Check tire condition and note warning lights on the dash.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fuel & mileage</CardTitle>
            <CardDescription>Avoid unexpected fees.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Record the fuel level at pickup.</li>
              <li>Confirm any mileage limits or rules for tolls and parking.</li>
              <li>Keep receipts for refuels if required by the host.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need help during the trip?</CardTitle>
            <CardDescription>Support and incident reporting.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                If anything goes wrong (damage, breakdown, or disputes), contact support as soon as possible and include your
                booking ID.
              </p>
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
