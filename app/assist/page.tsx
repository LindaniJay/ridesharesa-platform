import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import AssistClient from "@/app/assist/AssistClient";

export const metadata = {
  title: "Assist • RideShare",
};

export const dynamic = "force-dynamic";

export default function AssistPage() {
  return (
    <main className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card/60 px-4 py-6 backdrop-blur supports-[backdrop-filter]:bg-card/40 sm:px-6 sm:py-8">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-foreground/10 blur-3xl" />
        </div>
        <div className="relative grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:items-end">
          <div className="space-y-3">
            <div className="inline-flex items-center rounded-full border border-border bg-background/60 px-3 py-1 text-xs text-foreground/70">
              Emergency support lane
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Assist center</h1>
            <p className="max-w-xl text-sm text-foreground/70 sm:text-base">
              Flat tyre, empty tank, or stranded at pickup? Drop your live location and request help in under a minute.
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
              <div className="text-xs text-foreground/60">Average acknowledgement</div>
              <div className="font-semibold">2-5 minutes</div>
            </div>
            <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
              <div className="text-xs text-foreground/60">Coverage</div>
              <div className="font-semibold">Major SA metros</div>
            </div>
            <div className="rounded-xl border border-border bg-background/45 px-3 py-2">
              <div className="text-xs text-foreground/60">Availability</div>
              <div className="font-semibold">24/7 intake</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          {
            title: "Pin your spot",
            desc: "Use GPS or tap the map to place your exact breakdown location.",
          },
          {
            title: "Share details",
            desc: "Choose incident type and add contact notes so support can call you fast.",
          },
          {
            title: "Track incident",
            desc: "Get an incident ID instantly and continue updates from your dashboard.",
          },
        ].map((item, idx) => (
          <Card key={item.title}>
            <CardHeader>
              <CardDescription>Step {idx + 1}</CardDescription>
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-foreground/70">{item.desc}</CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-amber-500/30 bg-amber-500/10">
        <CardHeader>
          <CardTitle className="text-base">Safety first</CardTitle>
          <CardDescription>
            If there is immediate danger, contact local emergency services first. Use Assist once you are in a safer position.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Request help now</CardTitle>
          <CardDescription>
            We use your current GPS location (with your permission) and attach it to the incident for faster dispatch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistClient />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Before you submit</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm text-foreground/70">
              <li>Pull over safely and turn on hazard lights.</li>
              <li>Share a landmark in notes if GPS accuracy is weak.</li>
              <li>Keep your phone line available for callback.</li>
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>What happens next</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-foreground/70">
            <p>Your request is logged as an incident and routed to operations.</p>
            <p>If your booking is active, support can coordinate with host and admin teams in one thread.</p>
            <p>You can keep checking status in your renter or host dashboard.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Common assist scenarios</CardTitle>
          <CardDescription>Examples of what to include in notes for quicker help.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground/70">
            <div className="font-medium text-foreground">Flat tyre</div>
            <div className="mt-1">Share whether the tyre is punctured or burst, and confirm if you are parked in a safe zone.</div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3 text-sm text-foreground/70">
            <div className="font-medium text-foreground">Out of petrol</div>
            <div className="mt-1">Add nearest landmark and whether the vehicle can be pushed safely to a shoulder.</div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
