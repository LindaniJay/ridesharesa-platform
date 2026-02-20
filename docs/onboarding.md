# Onboarding (Host & Renter)

This document describes how onboarding works *as implemented in this repo* (Next.js App Router + Supabase Auth + Prisma).

## Roles at a glance

- **RENTER**: can browse approved listings and create bookings.
- **HOST**: can create listings (vehicles) and manage bookings for their listings.
- **ADMIN**: can approve listings, view uploaded docs, and update verification / payment states.

## Shared building blocks

### Authentication (Supabase Auth)

- Email/password authentication is handled by **Supabase Auth**.
- At signup, the UI stores profile hints in **Supabase Auth `user_metadata`**:
  - `name` (optional)
  - `role` (`RENTER` or `HOST`)

Code:
- Sign up UI: `app/sign-up/page.tsx`
- Sign in UI: `app/sign-in/SignInClient.tsx`

### Application user record (Prisma `User`)

Most pages use a Prisma `User` row for role and verification status.

- The server ensures the Prisma user exists via either:
  - `POST /api/account/bootstrap` (called after signup + after signin), or
  - `requireUser()` / `requireRole()` in server components.

Defaults when a user is created:
- `role`: `RENTER` (unless explicitly requested / inferred)
- `status`: `ACTIVE`
- `idVerificationStatus`: `UNVERIFIED`
- `driversLicenseStatus`: `UNVERIFIED`

Code:
- Bootstrap endpoint: `app/api/account/bootstrap/route.ts`
- Auth guards: `app/lib/require.ts`
- Prisma models: `prisma/schema.prisma`

### Role assignment rules (important)

- **ADMIN** can only come from Supabase Auth **`app_metadata.role`** (service role controlled). It is never granted from client-controlled metadata.
- `HOST` / `RENTER` can come from **`user_metadata.role`**.
- `POST /api/account/bootstrap` does **not** generally allow role changes, except:
  - a one-way promotion `RENTER → HOST` when the DB row is `RENTER`, the request asks for `HOST`, and Supabase Auth metadata also says `HOST`.

Code:
- `app/api/account/bootstrap/route.ts`
- `app/lib/require.ts`
- `app/api/me/route.ts`

## Renter onboarding

### 1) Create account

1. Go to `/sign-up`.
2. Choose **Renter**.
3. The client calls `supabase.auth.signUp(...)` with `user_metadata.role = "RENTER"`.
4. If Supabase returns a session immediately, the client calls `POST /api/account/bootstrap`.
5. The UI redirects to `/renter`.

Notes:
- If email confirmation is enabled in Supabase, signup may return **no session**; the UI redirects to `/sign-in?checkEmail=1`.

### 2) Upload renter verification documents

From the renter dashboard:

1. Go to `/renter?section=profile`.
2. Upload:
   - Profile photo (image)
   - ID document (image)
   - Driver’s license (image)
3. The client posts `multipart/form-data` to `POST /api/account/documents`.

What the server does:
- Upserts the Prisma `User` (keyed by email).
- Uploads the 3 images into Supabase Storage bucket:
  - bucket: `SUPABASE_USER_DOCS_BUCKET` (default `user-documents`)
  - paths: `<prismaUserId>/profile.<ext>`, `<prismaUserId>/id.<ext>`, `<prismaUserId>/license.<ext>`
- Updates Supabase Auth `user_metadata` with:
  - `profileImagePath`, `idDocumentImagePath`, `driversLicenseImagePath`, `documentsUploadedAt`
- Sets Prisma verification statuses to:
  - `idVerificationStatus = PENDING`
  - `driversLicenseStatus = PENDING`

Limits enforced by the upload endpoint:
- Images only
- Max 5MB per file

Code:
- UI form: `app/components/DocumentsUploadForm.client.tsx`
- Upload endpoint: `app/api/account/documents/route.ts`

### 3) Start booking (checkout)

1. Browse listings (`/listings`).
2. A renter can only checkout a listing that is:
   - `status = ACTIVE`
   - `isApproved = true`
3. Go to `/checkout/[listingId]` and choose dates + payment method.

Payment paths:

- **Card (Stripe)**
  - `POST /api/checkout/session`
  - Creates a `Booking` row with `status = PENDING_PAYMENT`
  - Creates a Stripe Checkout Session
  - Stripe webhook (`POST /api/stripe/webhook`) records payment and marks the booking as awaiting admin approval:
    - `status = PENDING_APPROVAL`
    - `paidAt = now`
  - Admin approves the booking in `/admin` (sets `status = CONFIRMED`).
  - Hosts are only notified / see the booking once it is `CONFIRMED`.

- **Instant EFT (manual)**
  - `POST /api/checkout/manual`
  - Creates a `Booking` row with `status = PENDING_PAYMENT` and *no Stripe session id*
  - Redirects the renter to `/bookings/[bookingId]` with bank details + payment reference
  - Renter can upload proof of payment (image/PDF) to:
    - `POST /api/bookings/[id]/payment-proof`
  - Admin confirms payment in `/admin` (sets `status = CONFIRMED`, `paidAt = now`). Hosts only see it once confirmed.

Code:
- Checkout page: `app/checkout/[listingId]/page.tsx`
- Checkout client UI: `app/checkout/[listingId]/CheckoutClient.tsx`
- Stripe checkout API: `app/api/checkout/session/route.ts`
- Manual EFT API: `app/api/checkout/manual/route.ts`
- Stripe webhook: `app/api/stripe/webhook/route.ts`
- Booking page (manual proof UI): `app/bookings/[id]/page.tsx`

## Host onboarding

### 1) Create account

1. Go to `/sign-up`.
2. Choose **Host**.
3. The client calls `supabase.auth.signUp(...)` with `user_metadata.role = "HOST"`.
4. The client calls `POST /api/account/bootstrap` and redirects to `/host`.

### 2) Upload host verification documents

From the host dashboard:

1. Go to `/host`.
2. In “Profile & verification”, submit the form which posts to `POST /api/account/documents`.

What the server does is the same as for renters (uploads 3 images, sets verification statuses to `PENDING`).

Important implementation note:
- The host dashboard form currently includes non-file fields (name/phone/dob/address/idNumber), but `POST /api/account/documents` **only processes the 3 file fields**. Those extra fields are not persisted by the server today.

Code:
- Host dashboard: `app/host/page.tsx`
- Upload endpoint: `app/api/account/documents/route.ts`

### 3) Create a listing (vehicle)

1. Go to `/host/listings/new`.
2. Fill listing details + choose map location + daily rate.
3. Upload required photos:
   - Left, right, interior, exterior (required)
   - Damage (optional)
4. Upload required vehicle documents:
   - License disk photo
   - Registration document
   - License card photo
5. Submit.

What the server does:
- Creates a `Listing` row:
  - `status = ACTIVE`
  - `isApproved = false` (admin must approve)
- Uploads listing images to:
  - bucket: `SUPABASE_STORAGE_BUCKET` (default `listing-images`)
  - returns **public URLs** stored in `Listing.imageUrl` (and used across the UI)
- Uploads vehicle documents to:
  - bucket: `SUPABASE_LISTING_DOCS_BUCKET` (default `listing-documents`, private)
  - stores **storage paths** in:
    - `Listing.licenseDiskImageUrl`
    - `Listing.registrationImageUrl`
    - `Listing.licenseCardImageUrl`

Code:
- Listing creation UI + server action: `app/host/listings/new/page.tsx`
- Storage helper: `app/lib/supabaseAdmin.ts`

### 4) Listing approval (admin)

- Newly created listings are not bookable until `isApproved = true`.
- Admin approves listings from `/admin`.

Code:
- Admin dashboard: `app/admin/page.tsx` (server action `approveListing`)

## Admin actions that affect onboarding

### Verify user documents

- Admin can set a user’s verification statuses in `/admin`:
  - `idVerificationStatus`: `UNVERIFIED | PENDING | VERIFIED | REJECTED`
  - `driversLicenseStatus`: `UNVERIFIED | PENDING | VERIFIED | REJECTED`

- Admin can view uploaded user docs via signed URLs:
  - `GET /api/admin/user-documents/[kind]?userId=<id>`
  - `kind`: `profile | id | license`

Code:
- Admin page: `app/admin/page.tsx` (server action `setUserVerification`)
- User doc signed URL endpoint: `app/api/admin/user-documents/[kind]/route.ts`

### Review listing documents

- Admin can fetch signed URLs for listing documents:
  - `GET /api/admin/listing-documents/[kind]?listingId=<id>`
  - `kind`: `licenseDisk | registration | licenseCard`

Code:
- Endpoint: `app/api/admin/listing-documents/[kind]/route.ts`

### Confirm manual/EFT bookings

- Manual/EFT bookings remain `PENDING_PAYMENT` until an admin marks them paid.
- Admin can also view payment proof via:
  - `GET /api/admin/booking-payment-proof/[bookingId]`

### Approve paid bookings (admin-controlled)

- Stripe bookings move to `PENDING_APPROVAL` after payment and require an admin approval to become `CONFIRMED`.
- Hosts only see / are notified about bookings once they are `CONFIRMED`.

Code:
- Admin page: `app/admin/page.tsx` (server actions `markManualBookingPaid`, `approveBooking`)
- Proof viewer endpoint: `app/api/admin/booking-payment-proof/[bookingId]/route.ts`

## Required Supabase Storage buckets

Bucket names are configurable via env vars, and `npm run supabase:storage` creates them.

Defaults:
- `SUPABASE_USER_DOCS_BUCKET`: `user-documents` (private)
- `SUPABASE_STORAGE_BUCKET`: `listing-images` (public)
- `SUPABASE_BOOKING_PHOTOS_BUCKET`: `booking-photos` (private)
- `SUPABASE_LISTING_DOCS_BUCKET`: `listing-documents` (private)

Code:
- Bucket setup script: `scripts/setup-supabase-storage.mjs`

