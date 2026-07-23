# Restaurant OS

A production-ready multi-tenant SaaS Restaurant Operating System built with Next.js 15, Prisma, PostgreSQL, and Better Auth.

## Features (Phase 0 + 1)

- **Multi-tenant architecture** with subdomain routing (`{restaurant}.mydomain.com`)
- **Super Admin dashboard** — restaurant CRUD, subscriptions, plans
- **Restaurant dashboard** — menu, categories, products, branding, QR codes
- **Public QR Menu** — mobile-first, PWA-ready, themed
- **Subscription management** — 3 plans with feature gating, Razorpay integration
- **RBAC** — role-based access control for owners, managers, staff
- **Docker-ready** — local development with PostgreSQL + Redis

## Tech Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Prisma ORM + PostgreSQL (Neon)
- Better Auth (email + password, JWT sessions)
- Cloudinary (image storage)
- Razorpay (subscriptions)
- Framer Motion, React Hook Form, Zod

## Getting Started

### Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL)

### 1. Start PostgreSQL

```bash
docker compose -f docker/docker-compose.yml up postgres -d
```

Compose project name is `cafe-pos-system` (containers: `cafe-pos-system-postgres`, etc.) so it does not clash with other projects that use a `docker` folder name.

### 2. Configure Environment

```bash
cp .env.example .env
```

Update `.env` with your values. For local dev, the defaults work with Docker Postgres.

### 3. Install & Setup Database

```bash
npm install
npx prisma migrate dev --name init
npm run db:seed
```

### 4. Run Development Server

```bash
npm run dev
```

### Access Points

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Marketing site |
| `http://localhost:3000/login` | Sign in |
| `http://localhost:3000/register` | Register new restaurant |
| `http://admin.localhost:3000` | Super Admin dashboard |
| `http://demo.localhost:3000/menu` | Demo public menu |
| `http://demo.localhost:3000/dashboard` | Demo restaurant dashboard |

### Demo Credentials

- **Super Admin:** `admin@restaurant-os.com` / `Admin@123456`
- **Demo Owner:** `owner@democafe.com` / `Owner@123456`

> For subdomain access on Windows, add to `C:\Windows\System32\drivers\etc\hosts`:
> ```
> 127.0.0.1 demo.localhost
> 127.0.0.1 admin.localhost
> ```

## Deployment (Vercel + Neon + Cloudflare)

1. Create Neon PostgreSQL database
2. Deploy to Vercel with environment variables from `.env.example`
3. Configure Cloudflare DNS:
   - `CNAME * → cname.vercel-dns.com`
   - `CNAME admin → cname.vercel-dns.com`
4. Add wildcard domain in Vercel project settings

### Cron jobs (Vercel Hobby)

Vercel Hobby only allows **daily** crons. This repo keeps those in `vercel.json`:

- `/api/cron/subscriptions` — daily
- `/api/cron/sales-summary` — daily

More frequent jobs run via GitHub Actions (`.github/workflows/cron-external.yml`):

- `/api/cron/billing-sync` — every 6 hours
- `/api/cron/reservations` — every 5 minutes (Hobby substitute for every minute)

Set these **GitHub repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|--------|
| `APP_URL` | Production origin, e.g. `https://yourdiner.com` (no trailing slash) |
| `CRON_SECRET` | Same value as Vercel `CRON_SECRET` |

Smoke-test: Actions → **External Cron Jobs** → **Run workflow**.

## Project Structure

```
src/
├── app/
│   ├── platform/          # Super Admin
│   ├── dashboard/         # Restaurant Owner
│   ├── public-menu/       # Customer QR Menu
│   └── api/               # Auth, webhooks, cron
├── features/              # Domain modules
├── components/            # Shared UI
└── lib/                   # Auth, DB, tenancy, permissions
```

## Subscription Plans

| Plan | Features |
|------|----------|
| QR Menu Only | Menu, categories, products, branding, QR |
| Cafe Staff | + Staff login, tables, orders, kitchen, reservations |
| Customer Ordering | + Customer QR ordering, loyalty, analytics |

## License

Private — BluePeak Studio
