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
  onClick,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={
        active
          ? "rounded-lg bg-muted px-3 py-2 text-sm font-medium text-foreground block"
          : "rounded-lg px-3 py-2 text-sm font-medium text-foreground/70 hover:bg-muted hover:text-foreground block"
      }
    >
      {children}
    </Link>
  );
}

function DoorOpenIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M4 3h10v18H4z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 4l6 3v10l-6 3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function DoorClosedIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="M5 3h12v18H5z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="13" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

export default function NavbarClient() {
  const pathname = usePathname();
  const router = useRouter();

  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<"ADMIN" | "HOST" | "RENTER" | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [carsLabel] = useState<"Find Cars" | "Discover Cars">(() => {
    if (typeof window === "undefined") return "Find Cars";

    try {
      const key = "rs_nav_cars_label_v1";
      const saved = window.localStorage.getItem(key);
      if (saved === "find") return "Find Cars";
      if (saved === "discover") return "Discover Cars";

      const assigned = Math.random() < 0.5 ? "find" : "discover";
      window.localStorage.setItem(key, assigned);
      return assigned === "discover" ? "Discover Cars" : "Find Cars";
    } catch {
      return "Find Cars";
    }
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = supabaseBrowser();

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

    // If the Supabase project/anon key changed, the browser can keep an old refresh token.
    // That produces noisy 400s in the console. Treat it as a sign-out.
    (async () => {
      try {
        const { error } = await supabase.auth.getSession();
        const message = (error as { message?: unknown } | null)?.message;
        if (typeof message === "string" && /invalid\s*refresh\s*token/i.test(message)) {
          await supabase.auth.signOut();
          if (!cancelled) {
            setEmail(null);
            setRole(null);
          }
        }
      } catch {
        // Ignore.
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function onSignOut() {
    await supabaseBrowser().auth.signOut();
    setMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40">
      {/* Pear-shaped nav container */}
      <div className="mx-auto w-full max-w-6xl px-2 sm:px-4 py-2 sm:py-3">
        <div className="relative rounded-[1.5rem_1.5rem_1rem_1rem] sm:rounded-[2rem_2rem_1.5rem_1.5rem] bg-gradient-to-br from-gray-300/40 via-gray-400/35 to-gray-500/30 backdrop-blur-lg border border-gray-400/30 px-2 sm:px-4 py-2 sm:py-4 shadow-lg mobile-tight">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <Logo />
            </div>

            <nav className="hidden items-center gap-0.5 sm:gap-1 sm:flex">
              <NavLink href="/how-it-works" active={isActivePath(pathname, "/how-it-works")}>
                How it works
              </NavLink>
              <NavLink href="/listings" active={isActivePath(pathname, "/listings")}>
                <span suppressHydrationWarning>{carsLabel}</span>
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

            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Hamburger menu for mobile */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden inline-flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>

          {email ? (
            <>
              <div className="hidden sm:block">
                <PushEnableButton />
              </div>
              <span className="hidden text-xs sm:text-sm text-foreground/60 sm:inline truncate max-w-[150px]">
                {email}
              </span>
              <Button variant="secondary" className="hidden sm:inline-flex text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2" onClick={onSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="hidden rounded-lg border border-border bg-card px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm shadow-sm hover:bg-muted sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="hidden rounded-lg bg-accent px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90 sm:inline-flex"
              >
                Sign up
              </Link>
            </>
          )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {mobileMenuOpen && (
        <div className="mx-auto w-full max-w-6xl px-2 sm:hidden">
          <div className="slide-in-panel rounded-lg bg-gradient-to-br from-gray-300/40 via-gray-400/35 to-gray-500/30 backdrop-blur-lg border border-gray-400/30 p-3 space-y-2 mb-3 mobile-tight">
            <NavLink href="/how-it-works" active={isActivePath(pathname, "/how-it-works")}>
              How it works
            </NavLink>
            <NavLink href="/listings" active={isActivePath(pathname, "/listings")}>
              <span suppressHydrationWarning>{carsLabel}</span>
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
              <div className="space-y-2 pt-1">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-link-secondary w-full justify-center"
                >
                  <span className="inline-flex items-center gap-2">
                    <DoorOpenIcon />
                    Sign in
                  </span>
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn-link-secondary w-full justify-center"
                >
                  <span className="inline-flex items-center gap-2">
                    <DoorOpenIcon />
                    Sign up
                  </span>
                </Link>
              </div>
            ) : (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onSignOut}
                  className="btn-link-secondary w-full justify-center"
                >
                  <span className="inline-flex items-center gap-2">
                    <DoorClosedIcon />
                    Sign out
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
