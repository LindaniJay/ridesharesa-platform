"use client";

import { useEffect } from "react";

import { ToastProvider } from "@/app/components/ui/ToastProvider.client";
import { clearInvalidRefreshTokenSession } from "@/app/lib/supabase/browser";

export default function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void clearInvalidRefreshTokenSession();
  }, []);

  return <ToastProvider>{children}</ToastProvider>;
}
