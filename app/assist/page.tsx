import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";
import AssistClient from "@/app/assist/AssistClient";

export const metadata = {
  title: "Assist • RideShare",
};

export const dynamic = "force-dynamic";

export default function AssistPage() {
  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Roadside assist</h1>
        <p className="text-sm text-foreground/60">
          Flat tyre or out of petrol? Share your location and we’ll open a support incident.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Request help</CardTitle>
          <CardDescription>
            We use your current GPS location (with your permission) and attach it to the incident.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssistClient />
        </CardContent>
      </Card>
    </main>
  );
}
