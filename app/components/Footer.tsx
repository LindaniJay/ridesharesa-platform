import Link from "next/link";
import Logo from "@/app/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border/80 bg-background/95 py-12 text-sm backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="mb-8 grid gap-3 rounded-[1.75rem] border border-border bg-card/50 p-4 backdrop-blur supports-[backdrop-filter]:bg-card/35 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Verified hosts", value: "Identity and document review" },
            { label: "Secure checkout", value: "Protected booking flow" },
            { label: "Roadside assist", value: "Support linked to active trips" },
            { label: "Major city coverage", value: "Cape Town to Durban" },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">{item.label}</div>
              <div className="mt-2 text-sm font-medium text-foreground/82">{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-10 lg:grid-cols-[1.3fr,0.7fr,0.7fr,0.9fr]">
          <div className="space-y-4 rounded-[1.75rem] border border-border bg-card/45 p-6 backdrop-blur supports-[backdrop-filter]:bg-card/30">
            <Logo variant="full" />
            <div className="max-w-md text-foreground/70">
              Rent cars from local owners in minutes. Built for flexible pickups, transparent pricing, and support that stays connected to the full trip.
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">For renters</div>
                <div className="mt-2 text-sm text-foreground/76">Find approved cars, compare rates, and manage every booking in one dashboard.</div>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">For hosts</div>
                <div className="mt-2 text-sm text-foreground/76">List vehicles, track approvals, and keep trip operations structured.</div>
              </div>
            </div>
            <div className="text-foreground/60">© {new Date().getFullYear()} RideShare</div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">Product</div>
            <div className="flex flex-col gap-2">
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/how-it-works">
                How it works
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/listings">
                Listings
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/cities">
                Cities
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">Support</div>
            <div className="flex flex-col gap-2">
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/guides">
                Help center
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/assist">
                Roadside assist
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/guides/renters/documents">
                Safety
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/guides/renters/documents">
                Insurance
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/guides">
                Contact
              </Link>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.5rem] border border-border bg-card/45 p-5 backdrop-blur supports-[backdrop-filter]:bg-card/30">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/70">Contact and legal</div>
              <div className="mt-2 text-sm text-foreground/66">Use the guides and assist flows for fastest response, especially during an active trip.</div>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/35 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Response rhythm</div>
              <div className="mt-2 text-sm font-medium text-foreground/82">Booking support, incident routing, and roadside assist from the same platform flow.</div>
            </div>
            <div className="flex flex-col gap-2">
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/terms">
                Terms
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/privacy">
                Privacy
              </Link>
              <Link className="text-foreground/80 hover:text-accent hover:underline underline-offset-4" href="/cancellation">
                Cancellation
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
