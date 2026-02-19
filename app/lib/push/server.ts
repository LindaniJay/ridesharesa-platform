import "server-only";

import webpush, { type PushSubscription } from "web-push";

let configured = false;

function configureWebPush() {
  if (configured) return;

  const subject = process.env.WEB_PUSH_SUBJECT;
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;

  if (!subject) {
    throw new Error("Missing WEB_PUSH_SUBJECT (e.g. mailto:admin@example.com)");
  }
  if (!publicKey) {
    throw new Error("Missing WEB_PUSH_PUBLIC_KEY or NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY");
  }
  if (!privateKey) {
    throw new Error("Missing WEB_PUSH_PRIVATE_KEY");
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export async function sendPush(subscription: PushSubscription, payload: unknown) {
  configureWebPush();
  await webpush.sendNotification(subscription, JSON.stringify(payload));
}
