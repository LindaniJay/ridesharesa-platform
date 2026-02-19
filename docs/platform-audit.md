# RideShareSA Platform — Feature Audit (Checklist)

Last updated: 2026-02-19

This document maps what exists end-to-end in the codebase vs what is partial or missing.

Legend:
- [Done] Implemented end-to-end (UI + API/DB) or clearly functional.
- [Partial] Present but incomplete / demo-only / missing key edges.
- [Missing] Not implemented.

## 1) Authentication & roles
- [Done] Supabase Auth sign-up/sign-in flows.
- [Done] Role selection on signup (HOST vs RENTER) stored in user metadata, then bootstrapped into Prisma user row.
- [Done] Role gating helpers used across pages/routes.
- [Done] Admin role treated as server-controlled (not client-escalatable).

## 2) Core marketplace (listings)
- [Done] Browse listings and listing detail page.
- [Done] Listing creation flow (host) that creates the listing first and then uploads photos under the listing id.
- [Done] Listing gallery photo storage and display (bucket-backed).
- [Done] Listing status model (DRAFT/ACTIVE/PAUSED) and approval flag.
- [Done] Admin approval workflow for new host listings.
- [Partial] Availability/calendar management (no hard availability blocking beyond whatever the booking logic enforces).
- [Partial] Pricing rules (daily rate exists; discounts/fees/taxes not clearly modeled as first-class rules).
- [Partial] Search/filtering (basic browsing exists; advanced filters/sorting not audited as complete).

## 3) Booking & checkout
- [Done] Checkout session creation (Stripe Checkout) that creates a booking in `PENDING_PAYMENT` and redirects to Stripe.
- [Done] Stripe webhook confirms booking (`CONFIRMED`) and sets `paidAt`.
- [Done] Manual/EFT checkout path that creates a `PENDING_PAYMENT` booking without Stripe ids.
- [Done] Booking detail page shows status and supports evidence photo upload/display with signed URLs.
- [Done] Admin can mark manual/EFT bookings as paid (moves to `CONFIRMED`).
- [Partial] Cancellation policy page exists but is explicitly MVP placeholder content.
- [Partial] Cancellation execution: chatbot can set status to `CANCELLED` for `PENDING_PAYMENT` bookings; no refund logic.
- [Missing] Refunds/chargebacks tracking and operational tooling (admin dashboard shows “Not enabled”).
- [Missing] Deposits/escrow/holds (not implemented).
- [Missing] Dispute workflow tied to payments (separate from incident reports).

## 4) Media & documents (Supabase Storage)
- [Done] Bucket setup automation script (repo script) to create required buckets.
- [Done] Public listing gallery bucket strategy for general photos.
- [Done] Private buckets for sensitive documents/photos with signed URL access.
- [Done] Admin-only redirect endpoints to access private verification and listing legal docs.
- [Done] Booking evidence photos stored privately and displayed via signed URLs.
- [Partial] Consistent image usage across all surfaces is improved, but any new UI surface that expects a URL must follow the signed/public strategy.

## 5) Identity verification / compliance
- [Done] User document upload storage model (private bucket).
- [Done] Admin can view user verification documents through admin routes.
- [Done] Admin can set verification statuses (ID and driver’s license).
- [Partial] Automated verification (3rd-party KYC) not implemented.

## 6) Admin operations dashboard
- [Done] Admin dashboard sections (overview/analytics/vehicles/users/bookings/payments/risk/support).
- [Done] Approve listings and set listing status (ACTIVE/PAUSED/DRAFT).
- [Done] Set user role and user account status.
- [Done] Set verification statuses.
- [Done] View bookings with renter/host context.
- [Done] Manual payout records: create payout items and mark payout status (does not move money).
- [Partial] Refunds/chargebacks section exists but is not enabled.
- [Partial] Overdue returns tracking explicitly “Not enabled yet”.

## 7) Support & customer service
- [Done] Support tickets persisted in DB.
- [Done] Admin can change support ticket status.
- [Done] Chatbot can create support tickets and list bookings.
- [Partial] End-user support ticket UI beyond chatbot intake is limited (chatbot-first experience).

## 8) Risk, trust & safety
- [Done] Roadside assist / incident report intake endpoint (creates `IncidentReport`).
- [Done] Admin can change incident status.
- [Partial] Evidence workflow for incidents beyond booking photo evidence is limited.
- [Missing] Formal disputes/claims workflow (damage cost quoting, approvals, payment collection).

## 9) Reviews & favorites
- [Partial] Prisma models exist for `Favorite` and `Review`.
- [Missing] Favorites UI/API (save listing, view favorites).
- [Missing] Review authoring UI/API (post-booking review flow).
- [Missing] Review display/aggregation (rating summaries on listings/hosts).

## 10) Messaging
- [Missing] Host↔Renter direct messaging/conversation system.

## 11) PWA & push notifications
- [Done] Service worker registration.
- [Done] Web push subscribe endpoint and persistence of subscriptions.
- [Done] Push send/test endpoint.
- [Partial] Productized notification events (booking confirmed, reminders, etc.) not wired.

## 12) Operational safety for DB migrations
- [Done] `.env.example` added to document required environment variables.
- [Done] Prisma wrapper script to prefer `DIRECT_URL` for migration-related commands.
- [Partial] Production migration strategy depends on resolving existing drift safely (recommended: separate dev DB/project; avoid destructive reset on shared/prod DB).

---

# Priority gaps (recommended next work)

## P0 (blocks “real money” operations)
- Refunds/chargebacks tracking and workflow (at least admin visibility + Stripe refund plumbing).
- Cancellation workflow with clear rules and effects (status transitions + Stripe refunds where applicable).
- Deposit/hold strategy (if required for your risk model).

## P1 (marketplace growth)
- Reviews (authoring + display).
- Favorites/watchlist.
- Availability/calendar rules (prevent double booking, blackout dates).

## P2 (customer experience)
- Host↔renter messaging.
- Push notifications triggered by real events (booking confirmed, reminders, status changes).

# Notes
- Admin already covers the most important operational controls for an MVP (listing approvals, booking ops visibility, verification review, support/incident queues).
- The biggest remaining gaps are around payments lifecycle (refunds/cancellations/chargebacks) and user-to-user marketplace features (reviews/favorites/messaging).
