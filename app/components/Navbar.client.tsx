"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import Logo from "@/app/components/Logo";
import PushEnableButton from "@/app/components/PushEnableButton.client";
import Button from "@/app/components/ui/Button";
import { clearInvalidRefreshTokenSession, supabaseBrowser } from "@/app/lib/supabase/browser";

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
          ? "block rounded-2xl border border-white/15 bg-slate-950/20 px-3 py-2 text-sm font-medium text-foreground shadow-sm"
          : "block rounded-2xl px-3 py-2 text-sm font-medium text-foreground/72 transition-colors hover:bg-white/8 hover:text-foreground"
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
  const navItems = useMemo(() => {
    const items = [
      { href: "/how-it-works", label: "How it works" },
      { href: "/listings", label: "Find cars" },
      { href: "/assist", label: "Assist" },
    ];

    if (role === "RENTER") items.push({ href: "/renter", label: "Bookings" });
    if (role === "HOST") items.push({ href: "/host", label: "Host" });
    if (role === "ADMIN") items.push({ href: "/admin", label: "Admin" });

    return items;
  }, [role]);

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

    void clearInvalidRefreshTokenSession()
      .catch(() => {
        // Ignore stale-session cleanup failures.
      })
      .then(() => {
        if (!cancelled) {
          void load();
        }
      });

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
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-4 py-2 sm:py-3">
        <div className="relative overflow-hidden rounded-[1.75rem_1.75rem_1.15rem_1.15rem] border border-white/12 bg-gradient-to-br from-slate-300/35 via-slate-400/30 to-slate-600/24 px-2.5 py-2.5 shadow-[0_18px_45px_-28px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:rounded-[2rem_2rem_1.4rem_1.4rem] sm:px-4 sm:py-4 mobile-tight">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-24 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-accent/12 blur-3xl" />
          </div>

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3 flex-shrink-0">
              <Logo />
            </div>

            <nav className="hidden items-center gap-1 rounded-full border border-white/10 bg-slate-950/12 px-2 py-1 sm:flex">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} active={isActivePath(pathname, item.href)}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex flex-shrink-0 items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/15 px-3 text-sm font-medium text-foreground hover:bg-slate-950/25 sm:hidden"
                aria-label="Toggle menu"
              >
                <span>Menu</span>
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
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-slate-950/15 px-2 py-1 sm:flex">
                  <div className="hidden sm:block">
                    <PushEnableButton />
                  </div>
                  <span className="max-w-[180px] truncate px-2 text-sm text-foreground/68">{email}</span>
                  <Button variant="secondary" className="h-9 rounded-full px-4 text-sm" onClick={onSignOut}>
                    Sign out
                  </Button>
                </div>
              ) : (
                <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-slate-950/15 px-2 py-1 sm:flex">
                  <Link
                    href="/sign-in"
                    className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-foreground/78 transition-colors hover:bg-white/8 hover:text-foreground"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="inline-flex h-9 items-center rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
                  >
                    Create account
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="mx-auto w-full max-w-6xl px-3 sm:hidden">
          <div className="slide-in-panel mb-3 overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-slate-300/35 via-slate-400/28 to-slate-600/22 p-4 shadow-[0_16px_44px_-28px_rgba(0,0,0,0.72)] backdrop-blur-xl">
            <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/12 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/55">Ride ready</div>
              <div className="mt-1 text-base font-semibold">Search, book, and manage your trip from one place.</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/65">
                <span className="rounded-full border border-white/10 bg-background/25 px-2.5 py-1">Verified hosts</span>
                <span className="rounded-full border border-white/10 bg-background/25 px-2.5 py-1">Secure checkout</span>
                <span className="rounded-full border border-white/10 bg-background/25 px-2.5 py-1">Roadside assist</span>
              </div>
            </div>

            <div className="space-y-1">
              {navItems.map((item) => (
                <NavLink key={item.href} href={item.href} active={isActivePath(pathname, item.href)} onClick={() => setMobileMenuOpen(false)}>
                  {item.label}
                </NavLink>
              ))}
            </div>

            {!email ? (
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-950/12 p-2">
                <Link
                  href="/sign-in"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-white/10 bg-background/35 px-3 text-sm font-medium text-foreground/80"
                >
                  <span className="inline-flex items-center gap-2">
                    <DoorOpenIcon />
                    Sign in
                  </span>
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-accent px-3 text-sm font-semibold text-accent-foreground shadow-sm"
                >
                  <span className="inline-flex items-center gap-2">
                    <DoorOpenIcon />
                    Create account
                  </span>
                </Link>
              </div>
            ) : (
              <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-slate-950/12 p-3">
                <div className="text-xs uppercase tracking-[0.18em] text-foreground/55">Signed in</div>
                <div className="truncate text-sm text-foreground/72">{email}</div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-white/10 bg-background/35 px-3 text-sm font-medium text-foreground/80"
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
