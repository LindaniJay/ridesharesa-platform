import Link from "next/link";
import Logo from "@/app/components/Logo";

export default function Footer() {
  return (
    <footer className="border-t border-border/80 bg-background/95 py-12 text-sm backdrop-blur-md">
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <Logo variant="full" />
            <div className="max-w-xs text-foreground/70">
                Rent cars from local owners in minutes. Safe, affordable, and convenient peer-to-peer car rentals.
            </div>
            <div className="text-foreground/60">© {new Date().getFullYear()} RideShare</div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Product</div>
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
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Support</div>
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

          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">Legal</div>
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
