"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface SearchResult {
  kind: "user" | "listing" | "booking" | "ticket";
  id: string;
  label: string;
  sub: string;
  href: string;
}

export default function AdminCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  // Open on ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query.trim())}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = (await res.json()) as { results: SearchResult[] };
          setResults(json.results ?? []);
          setSelected(0);
        }
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      navigate(results[selected].href);
    }
  }

  const kindColor: Record<SearchResult["kind"], string> = {
    user: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    listing: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    booking: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    ticket: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-lg border border-border bg-muted/60 px-3 py-1.5 text-sm text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Open command palette"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <span>Search</span>
        <kbd className="ml-1 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[10vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Search"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search users, listings, bookings, tickets..."
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-foreground/40"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          ) : (
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground/50">ESC</kbd>
          )}
        </div>

        {results.length > 0 ? (
          <ul className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <li key={r.id + r.kind}>
                <button
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                    i === selected ? "bg-accent/10 text-foreground" : "text-foreground/80 hover:bg-muted hover:text-foreground"
                  }`}
                  onClick={() => navigate(r.href)}
                  onMouseEnter={() => setSelected(i)}
                >
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${kindColor[r.kind]}`}>
                    {r.kind}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.label}</span>
                    <span className="block truncate text-xs text-foreground/50">{r.sub}</span>
                  </span>
                  <svg className="h-3.5 w-3.5 shrink-0 text-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() && !loading ? (
          <div className="px-4 py-8 text-center text-sm text-foreground/50">No results for &ldquo;{query}&rdquo;</div>
        ) : !query.trim() ? (
          <div className="px-4 py-6">
            <div className="mb-3 text-xs font-medium text-foreground/40 uppercase tracking-wide">Quick navigate</div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: "Overview", href: "/admin" },
                { label: "Users", href: "/admin?section=users" },
                { label: "Vehicles", href: "/admin?section=vehicles" },
                { label: "Bookings", href: "/admin?section=bookings" },
                { label: "Payments", href: "/admin?section=payments" },
                { label: "Analytics", href: "/admin?section=analytics" },
                { label: "Risk & Safety", href: "/admin?section=risk" },
                { label: "Support", href: "/admin?section=support" },
              ].map((item) => (
                <button
                  key={item.href}
                  onClick={() => navigate(item.href)}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/70 hover:bg-muted hover:text-foreground transition-colors text-left"
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-foreground/40">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span><kbd className="font-mono">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
