import { Suspense } from "react";

import SignInClient from "@/app/sign-in/SignInClient";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md rounded-xl border border-foreground/10 p-4 text-sm text-foreground/70 shadow-sm">
          Loading…
        </div>
      }
    >
      <SignInClient />
    </Suspense>
  );
}
