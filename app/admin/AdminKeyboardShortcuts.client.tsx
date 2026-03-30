"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Registers keyboard shortcuts for admin section navigation.
 * Uses "g" then a letter pattern (like GitHub):
 *   g o → Overview
 *   g u → Users
 *   g v → Vehicles
 *   g b → Bookings
 *   g p → Payments
 *   g a → Analytics
 *   g r → Risk
 *   g s → Support
 *   g m → Messages
 */
export default function AdminKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout> | null = null;

    const shortcuts: Record<string, string> = {
      o: "/admin",
      u: "/admin?section=users",
      v: "/admin?section=vehicles",
      b: "/admin?section=bookings",
      p: "/admin?section=payments",
      a: "/admin?section=analytics",
      r: "/admin?section=risk",
      s: "/admin?section=support",
      m: "/admin?section=messages",
      t: "/admin?section=settings",
    };

    function onKey(e: KeyboardEvent) {
      // Don't fire when typing in inputs/textareas/selects
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }
      // Skip if modifier keys
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "g") {
        gPressed = true;
        if (gTimer) clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1500);
        return;
      }

      if (gPressed && shortcuts[e.key]) {
        e.preventDefault();
        gPressed = false;
        if (gTimer) clearTimeout(gTimer);
        router.push(shortcuts[e.key]);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [router]);

  return null;
}
