import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

export const metadata = {
  title: "Privacy • RideShare",
};

export default function PrivacyPage() {
  return (
    <main className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="max-w-2xl text-sm text-black/60 dark:text-white/60">
          This is MVP privacy content to support development and demos. Replace with legal-reviewed policy before launch.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Data we collect</CardTitle>
            <CardDescription>Typical marketplace data.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Account details (email, name) and authentication identifiers.</li>
              <li>Trip data (booking dates, listing references, payment status).</li>
              <li>Support messages and incident reports submitted through the platform.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How we use data</CardTitle>
            <CardDescription>Operate and improve the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-black/70 dark:text-white/70">
              <li>Provide marketplace features (listings, bookings, payments).</li>
              <li>Prevent fraud, handle disputes, and enforce safety standards.</li>
              <li>Monitor reliability and debug issues (e.g., error monitoring).</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sharing</CardTitle>
            <CardDescription>Limited to what’s needed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                We share information only as needed to operate the marketplace (for example, with payment processors to
                complete transactions) and to comply with law.
              </p>
              <p>
                Hosts and renters may see limited booking-related details necessary to complete a trip.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data retention</CardTitle>
            <CardDescription>Keep data as required.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-black/70 dark:text-white/70">
              <p>
                We retain data for as long as needed to provide services, comply with legal obligations, resolve disputes, and
                enforce agreements.
              </p>
              <p>
                Deletion requests may be limited when retention is required for compliance or safety.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
          <CardDescription>Privacy requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-black/70 dark:text-white/70">
            For privacy requests, contact support via your renter dashboard.
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
