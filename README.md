# RideShare Platform

Full-stack Next.js marketplace demo with roles (ADMIN/HOST/RENTER), listings + map, and checkout via Stripe.

## Local setup

1) Install deps

```bash
npm install
```

2) Configure env

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` (Supabase Postgres connection string for Prisma; pooled is fine)
- `DIRECT_URL` (Supabase direct connection string; recommended for migrations)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_FROM`
- `SENTRY_DSN` (optional)

3) Supabase

- Create a Supabase project
- Create a Storage bucket named `listing-images`
	- Easiest dev setup: make it public

4) Prisma

After pointing `DATABASE_URL` to your Supabase Postgres database:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

5) Stripe webhook (local)

Use the Stripe CLI to forward webhooks to your dev server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.

6) Run

```bash
npm run dev
```

## Mobile app (quickest): PWA + Web Push

This repo can be shipped as an **installable PWA** (Add to Home Screen) that works on both Android and iOS.

### Install / “app” behavior

- Android: open the site in Chrome → **Install app**
- iOS: open the site in Safari → **Share** → **Add to Home Screen**

### Push notifications (Web Push)

This project includes endpoints:

- `POST /api/push/subscribe` (store the current user's push subscription)
- `POST /api/push/send` (send a test notification to the current user)

1) Install dependency (already done if you pulled latest):

```bash
npm install
```

2) Generate VAPID keys:

```bash
npx web-push generate-vapid-keys --json
```

3) Add these to `.env`:

- `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` (from generated `publicKey`)
- `WEB_PUSH_PRIVATE_KEY` (from generated `privateKey`)
- `WEB_PUSH_SUBJECT` (e.g. `mailto:admin@yourdomain.com`)

4) Apply the DB change:

```bash
npm run db:migrate
```

### iOS caveats

- iOS only supports Web Push for **installed** PWAs (Add to Home Screen) on modern iOS versions.
- Permission prompts generally must be triggered by a **user gesture** (button click), not automatically on page load.

## Fixing `SELF_SIGNED_CERT_IN_CHAIN` (Windows / corporate proxy)

If you see Supabase errors like `fetch failed` / `SELF_SIGNED_CERT_IN_CHAIN`, your network is likely doing SSL inspection (MITM) and Node.js doesn't trust your corporate root CA by default.

The correct fix is to export your corporate root CA to a PEM file and point Node at it via `NODE_EXTRA_CA_CERTS`.

### Option A (recommended): helper script

1) In PowerShell, from the repo root, list likely root CAs:

```powershell
.\scripts\setup-node-extra-ca.ps1
```

2) Re-run with the thumbprint you want to trust:

```powershell
.\scripts\setup-node-extra-ca.ps1 -Thumbprint "<PASTE_THUMBPRINT_HERE>"
```

If you can't find the right corporate CA (or your environment uses multiple intermediates), you can generate a dev-only bundle of **all** Windows trusted CAs instead:

```powershell
.\scripts\setup-node-extra-ca.ps1 -BundleAll
```

3) (Optional) Persist it for your Windows user (requires restarting terminals / VS Code):

```powershell
.\scripts\setup-node-extra-ca.ps1 -Thumbprint "<PASTE_THUMBPRINT_HERE>" -Persist
```

4) Start dev from the same PowerShell window:

```powershell
npm run dev
```

### Option B: manual

- Export your corporate/proxy root CA from Windows Certificate Manager as Base-64 X.509 (PEM-like)
- Set `NODE_EXTRA_CA_CERTS` to the absolute path of the exported `.pem`
- Restart terminals / VS Code and run `npm run dev`

Do **not** use `NODE_TLS_REJECT_UNAUTHORIZED=0`—that disables TLS verification entirely.

## Notes

- Booking confirmation happens via Stripe webhook; the booking page can show `PENDING_PAYMENT` until the webhook arrives.
- Manual / Instant EFT (temporary, South Africa):
	- Checkout can create a booking without Stripe (still `PENDING_PAYMENT`).
	- The booking page shows a payment reference like `RS-<bookingId>`.
	- Admins can confirm payment in `/admin` via **Mark paid** (sets `paidAt` and moves the booking to `CONFIRMED`).
	- Set these server-side env vars to display bank details: `EFT_BANK_NAME`, `EFT_ACCOUNT_NAME`, `EFT_ACCOUNT_NUMBER`, `EFT_BRANCH_CODE`.
- Sentry is initialized via `sentry.*.config.ts` if `SENTRY_DSN` is set.
