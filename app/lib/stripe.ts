import Stripe from "stripe";

let stripeSingleton: Stripe | null = null;

export function stripe() {
  if (stripeSingleton) return stripeSingleton;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("Missing env var: STRIPE_SECRET_KEY");
  }

  stripeSingleton = new Stripe(key, {
    apiVersion: "2026-01-28.clover",
    typescript: true,
  });

  return stripeSingleton;
}
