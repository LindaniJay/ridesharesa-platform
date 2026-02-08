import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Fuel & mileage • Guides • RideShare",
};

export default function RenterFuelMileageGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Fuel & mileage policy</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          A practical overview of common marketplace rules. Always follow the listing details shown during booking.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Fuel level</CardTitle>
            <CardDescription>How returns are typically handled.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Record the fuel level at pickup and return.</li>
              <li>Return the car with the agreed fuel level (often “same as pickup”).</li>
              <li>Keep refuel receipts if you top up close to return time.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mileage limits</CardTitle>
            <CardDescription>Plan long trips properly.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Some listings may include mileage limits per day or per trip.</li>
              <li>Excess mileage may incur additional fees.</li>
              <li>If you’re unsure, message the host or contact support before the trip starts.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tolls, parking, and fines</CardTitle>
            <CardDescription>Responsibility basics.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Renters are typically responsible for tolls and parking fees during the trip.</li>
              <li>Traffic fines may be passed through if incurred during the booking period.</li>
              <li>Keep receipts for any dispute resolution.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Disputes</CardTitle>
            <CardDescription>What to do if there’s a mismatch.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                If the host disputes fuel or mileage, share pickup/return photos and receipts. For help, contact support with your
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
