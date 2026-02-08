import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Listing prep • Guides • RideShare",
};

export default function HostListingPrepGuidePage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Listing prep</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          How to create a high-converting listing that gets approved quickly.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
            <CardDescription>Make the listing easy to trust.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Take photos in daylight and keep the car clean.</li>
              <li>Capture front, rear, both sides, interior, and odometer.</li>
              <li>Include a clear shot of the number plate if allowed in your region.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
            <CardDescription>Answer common questions upfront.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Explain pickup process, timing, and location clarity.</li>
              <li>List key features and any important restrictions.</li>
              <li>Be transparent about any existing cosmetic damage.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Location & logistics</CardTitle>
            <CardDescription>Reduce confusion at pickup.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Choose an easy-to-find pickup point with safe parking.</li>
              <li>Write clear instructions and add a landmark.</li>
              <li>Keep messaging fast for first-time renters.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Approval readiness</CardTitle>
            <CardDescription>What admins look for.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Accurate title/city, clear description, and realistic pricing.</li>
              <li>No prohibited content or misleading photos.</li>
              <li>Consistent details that match the vehicle on pickup.</li>
            </ul>
            <div className="mt-3 text-sm">
              <Link className="underline" href="/host">
                Create or edit a listing
              </Link>
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
