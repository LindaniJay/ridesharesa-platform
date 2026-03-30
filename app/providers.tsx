"use client";

import { ToastProvider } from "@/app/components/ui/ToastProvider.client";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
