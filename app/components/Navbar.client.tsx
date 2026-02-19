"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Logo from "@/app/components/Logo";
import PushEnableButton from "@/app/components/PushEnableButton.client";
import Button from "@/app/components/ui/Button";
import { supabaseBrowser } from "@/app/lib/supabase/browser";

type MeResponse =
  | { user: null }
  | {
      user: {
        email: string;
        role: "ADMIN" | "HOST" | "RENTER";
      };
    };

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground"
          : "rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

export default function NavbarClient() {
  const pathname = usePathname();
  const router = useRouter();

  const waitlistHref = "mailto:rideshare.sasup@gmail.com?subject=RideShare%20SA%20%E2%80%94%20Waitlist%20signup&body=Hi%20RideShare%20SA%2C%0A%0APlease%20add%20me%20to%20the%20waitlist.%0A%0AName%3A%20%0AEmail%3A%20%0AInterest%20(Renter%2FHost)%3A%20%0A%0AThanks%2C%0A";

  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<"ADMIN" | "HOST" | "RENTER" | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        const json = (await res.json()) as MeResponse;
        if (cancelled) return;
        if (json.user) {
          setEmail(json.user.email);
          setRole(json.user.role);
        } else {
          setEmail(null);
          setRole(null);
        }
      } catch {
        // Ignore.
      }
    }

    void load();

    const { data: sub } = supabaseBrowser().auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSignOut() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <Logo />
        </div>

        <nav className="hidden items-center gap-1 sm:flex">
          <NavLink href="/how-it-works" active={isActivePath(pathname, "/how-it-works")}>
            How it works
          </NavLink>
          <NavLink href="/listings" active={isActivePath(pathname, "/listings")}>
            Listings
          </NavLink>
          <NavLink href="/assist" active={isActivePath(pathname, "/assist")}>
            Assist
          </NavLink>
          {role === "RENTER" && (
            <NavLink href="/renter" active={isActivePath(pathname, "/renter")}>
              Bookings
            </NavLink>
          )}
          {role === "HOST" && (
            <NavLink href="/host" active={isActivePath(pathname, "/host")}>
              Host
            </NavLink>
          )}
          {role === "ADMIN" && (
            <NavLink href="/admin" active={isActivePath(pathname, "/admin")}>
              Admin
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-2">
          {email ? (
            <>
              <PushEnableButton />
              <span className="hidden text-sm text-foreground/60 sm:inline">
                {email}
              </span>
              <Button variant="secondary" onClick={onSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm hover:bg-muted sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-muted/40">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <div className="text-xs text-foreground/70">
            The platform is in early access: you can create your profile now. We’ll announce when bookings and full operations go live.
          </div>

          <a
            href={waitlistHref}
            className="shrink-0 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-muted"
          >
            Join waitlist
          </a>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-6xl items-center gap-1 px-4 pb-3 sm:hidden">
        <NavLink href="/how-it-works" active={isActivePath(pathname, "/how-it-works")}>
          How it works
        </NavLink>
        <NavLink href="/listings" active={isActivePath(pathname, "/listings")}>
          Listings
        </NavLink>
        <NavLink href="/assist" active={isActivePath(pathname, "/assist")}>
          Assist
        </NavLink>
        {role === "RENTER" && (
          <NavLink href="/renter" active={isActivePath(pathname, "/renter")}>
            Bookings
          </NavLink>
        )}
        {role === "HOST" && (
          <NavLink href="/host" active={isActivePath(pathname, "/host")}>
            Host
          </NavLink>
        )}
        {role === "ADMIN" && (
          <NavLink href="/admin" active={isActivePath(pathname, "/admin")}>
            Admin
          </NavLink>
        )}
        {!email ? (
          <NavLink href="/sign-in" active={isActivePath(pathname, "/sign-in")}>
            Sign in
          </NavLink>
        ) : null}
      </div>
    </header>
  );
}
