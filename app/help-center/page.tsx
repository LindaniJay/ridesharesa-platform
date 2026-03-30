import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";

export default function HelpCenterPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Help Center & FAQ</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Frequently Asked Questions</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>How do I book a car?</li>
              <li>How does insurance work?</li>
              <li>How do I become a host?</li>
              <li>What is instant booking?</li>
              <li>How do promo codes work?</li>
              <li>How do I contact support?</li>
            </ul>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Contact Support</h2>
            <p>Email: <a href="mailto:support@ridesharesa.com" className="underline">support@ridesharesa.com</a></p>
          </div>
          <div>
            <Link href="/terms" className="underline">Terms & Conditions</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
