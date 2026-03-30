# Inventory Flow Control System

Cloud-native inventory management platform with Xero integration. Tracks asset lifecycle (new, repair, refurbished, written-off) and provides dashboards, analytics, and reporting.

## Stack

- **Frontend**: Next.js 16 + TailwindCSS (Vercel)
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **ORM**: Prisma
- **Auth**: Supabase Auth (signed-in users have full app access)
- **Charts**: Chart.js
- **Integration**: Xero API (OAuth2) — fixed assets + inventory
- **CI/CD**: GitHub Actions

## Quick Start

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. In **Settings → Database → Connection string**, choose **Session pooler** (shared pooler, port `5432` on `aws-0-<region>.pooler.supabase.com`). Use **Transaction pooler** (`6543`) only if you intentionally want transaction mode.
3. Copy values into `.env` (see `.env.example`).

```env
DATABASE_URL="postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1"
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON-KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE-ROLE-KEY]"
```

### 3. Database setup

```bash
npm run db:push    # Push schema to Supabase
npm run db:seed    # Seed asset statuses (new, repair, refurbished, written_off)
```

### 4. Authentication (login)

1. In Supabase Dashboard → **Authentication** → **Providers**, ensure **Email** is enabled.
2. Under **Users**, **Add user** with your email and password (or use **Sign up** if you add a sign-up flow later).
3. Open `/login` and sign in. **Home (`/`) and `/login` are public**; all other pages and **all `/api/*` routes** require a valid session.

### Access control

**Any user with a valid Supabase session** can use the app and call authenticated APIs — there are no role-based restrictions on routes or settings.

The optional `UserRole` table and Supabase `role` metadata are still supported for **reporting or future use** (e.g. `resolveUserRole`, seeding with `SEED_ADMIN_USER_ID`), but they do **not** limit what a logged-in user can do.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Deploy to Vercel

1. Connect this repo to [Vercel](https://vercel.com)
2. Add env vars (same as `.env`)
3. Deploy

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List assets (filters: status, category) |
| POST | `/api/assets` | Add asset |
| GET | `/api/assets/:id` | Get asset |
| PUT | `/api/assets/:id` | Update asset |
| GET | `/api/statuses` | List asset lifecycle states |
| GET | `/api/reports/stock` | Stock on hand |
| GET | `/api/reports/repairs` | Repairs pipeline |
| GET | `/api/reports/refurbished` | Redistribution readiness |
| GET | `/api/reports/writeoffs` | Write-off summary |
| POST | `/api/xero/sync` | Trigger Xero sync |
| GET | `/api/xero/health` | Xero sync health |

## Xero Setup

1. Create an app at [developer.xero.com](https://developer.xero.com)
2. Add redirect URI: `https://your-domain.com/api/xero/callback`
3. Add to `.env`:

```env
XERO_CLIENT_ID="..."
XERO_CLIENT_SECRET="..."
XERO_REDIRECT_URI="https://your-domain.com/api/xero/callback"
```

Sync scope: **fixed assets** and **inventory** (both).

## Extensible Asset States

Default states: `new`, `repair`, `refurbished`, `written_off`. To add more:

```sql
INSERT INTO "AssetStatus" (id, code, label, description, "sortOrder")
VALUES (gen_random_uuid(), 'in_use', 'In Use', 'Deployed to user', 5);
```

Or use Prisma Studio: `npm run db:studio`

## Project Structure

```
src/
├── app/
│   ├── api/          # API routes
│   ├── assets/       # Assets list page
│   ├── dashboard/    # Dashboard with charts
│   └── page.tsx      # Home
├── components/
│   └── charts/       # Chart.js components
└── lib/
    ├── auth/         # Session auth (requireApiAuth)
    ├── prisma.ts
    └── supabase/     # Supabase client
```

## License

Private.
