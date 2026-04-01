# RideShare Platform MVP Documentation

## Overview

This project is an MVP (Minimum Viable Product) for a ride-sharing platform. It is designed to demonstrate the core features and architecture required to launch a functional ride-sharing marketplace, connecting drivers (hosts) and riders (renters) with essential booking, payment, and support capabilities.

---

## Purpose

- Provide a foundational platform for ride-sharing services
- Enable rapid prototyping and validation of core business logic
- Serve as a base for future feature expansion and scaling

---

## Core Features

- User registration and authentication (host, renter, admin roles)
- Listing creation and management for hosts
- Booking system for renters
- EFT payment processing with payment reference codes
- Profile management
- Support ticketing system
- Push notifications
- Admin dashboard with analytics
- Location and map integration
- Email notifications

---

## Tech Stack

- **Frontend:** Next.js (React), Tailwind CSS
- **Backend:** Node.js (Next.js API routes)
- **Database:** PostgreSQL (managed via Supabase)
- **ORM:** Prisma
- **Authentication & Storage:** Supabase
- **Payments:** EFT (manual bank transfer with proof upload)
- **Email:** Resend
- **Error Monitoring:** Sentry
- **Mapping:** Leaflet, React-Leaflet
- **Charts:** Recharts
- **Forms & Validation:** React Hook Form, Zod
- **Push Notifications:** web-push
- **PDF Generation:** pdf-lib
- **Testing:** Node.js test runner, TSX

---

## Architecture

- **Monorepo structure** with clear separation of concerns
- **App directory** for Next.js pages, components, and API routes
- **Prisma** for database schema and migrations
- **Scripts** for setup, migration, and admin tasks
- **Public** directory for static assets and service worker
- **Docs** for onboarding and platform documentation
- **Tests** for automated testing

---

## Project Structure

- `app/` — Next.js app directory (pages, components, API routes)
- `prisma/` — Prisma schema, migrations, and seed scripts
- `scripts/` — Helper scripts for DB, migration, and admin tasks
- `public/` — Static assets and service worker
- `docs/` — Documentation and onboarding guides
- `tests/` — Automated tests

---

## Database Schema

- Managed with Prisma
- Enums for roles (ADMIN, HOST, RENTER), user status, verification, listing, booking, support ticket, and incident types
- See `prisma/schema.prisma` for details

---

## Setup & Deployment

- Node.js 20+ required
- Environment variables for Supabase, Sentry, etc.
- Local development uses Supabase for DB and storage

---

## Extending the MVP

This MVP is designed for easy extension. Future improvements may include:
- Real-time chat
- Advanced search and filtering
- Ratings and reviews
- Mobile app integration
- Enhanced analytics

---

For more details, see the codebase and individual documentation files.
