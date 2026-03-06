"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import DocumentsUploadForm from "@/app/components/DocumentsUploadForm.client";

export default function ProfileCreatePage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-4 sm:px-6">
      <section className="rounded-2xl border border-border bg-gradient-to-br from-card via-card to-muted/40 p-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Complete your professional profile</h1>
          <p className="text-sm text-foreground/70">
            Upload your verification documents to activate your account features. This protects renters, hosts, and your bookings.
          </p>
        </div>
        <div className="mt-4 grid gap-2 text-xs text-foreground/70 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-background px-3 py-2">Identity and driver&apos;s license checks</div>
          <div className="rounded-md border border-border bg-background px-3 py-2">Proof of residence issued within 3 months</div>
          <div className="rounded-md border border-border bg-background px-3 py-2">Private secure storage with signed access</div>
          <div className="rounded-md border border-border bg-background px-3 py-2">Review target: within 24 hours</div>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Verification documents</CardTitle>
          <CardDescription>
            Required: profile photo, ID document, driver&apos;s license, and proof of residence (not older than 3 months).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentsUploadForm successHref="/renter" nextHref="/profile/create" autoRedirectByRole />
        </CardContent>
      </Card>
    </main>
  );
}
