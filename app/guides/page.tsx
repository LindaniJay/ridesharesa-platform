import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Guides • RideShare",
};

export default function GuidesIndexPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Guides</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          Practical guides for renters and hosts. This content is designed for clarity and onboarding.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Renter guides</CardTitle>
            <CardDescription>Book confidently and avoid surprises.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <Link className="underline" href="/guides/renters/pickup">
                Pickup checklist
              </Link>
              <div className="text-black/60 dark:text-white/60">What to bring, how to verify the car, what to document.</div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Link className="underline" href="/guides/renters/documents">
                Required documents
              </Link>
              <div className="text-black/60 dark:text-white/60">License and ID basics for a smooth trip.</div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Link className="underline" href="/guides/renters/fuel-mileage">
                Fuel & mileage policy
              </Link>
              <div className="text-black/60 dark:text-white/60">Common rules and how to avoid fees.</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Host guides</CardTitle>
            <CardDescription>List better and earn more.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <Link className="underline" href="/guides/hosts/earnings">
                How earnings work
              </Link>
              <div className="text-black/60 dark:text-white/60">What gets paid out, what affects payout timing.</div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Link className="underline" href="/guides/hosts/pricing">
                Pricing guide
              </Link>
              <div className="text-black/60 dark:text-white/60">Set a competitive rate and reduce cancellations.</div>
            </div>
            <div className="mt-3 space-y-2 text-sm">
              <Link className="underline" href="/guides/hosts/listing-prep">
                Listing prep
              </Link>
              <div className="text-black/60 dark:text-white/60">Photos, description, location, and approval readiness.</div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Related</CardTitle>
          <CardDescription>More marketplace info.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link className="underline" href="/how-it-works">
              How it works
            </Link>
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
