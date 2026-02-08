import { Resend } from "resend";

let resendSingleton: Resend | null = null;

export function resend() {
  if (resendSingleton) return resendSingleton;

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    throw new Error("Missing env var: RESEND_API_KEY");
  }

  resendSingleton = new Resend(key);
  return resendSingleton;
}
