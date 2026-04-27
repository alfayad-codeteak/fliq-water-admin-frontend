# ProAdmin (Fliq)

Next.js 15 admin UI that talks to your **HTTP API** documented in `admin-panel-api.md` at the repo root.

## What it does

- **Login:** `POST /api/auth/login` with **10-digit phone** + **password** (JWT access + refresh tokens stored in the NextAuth JWT session).
- **BFF proxy:** Browser calls `GET|POST|PATCH|DELETE /api/bff/{owner|admin}/…` → Next.js forwards to `{API_URL}/api/{owner|admin}/…` with `Authorization: Bearer <accessToken>` (avoids CORS and hides the API origin from the client).
- **Owner:** staff management via `/api/owner/admins` and `/api/owner/features`.
- **Admin + owner:** products, orders, customers via `/api/admin/*`.
- **Navigation:** filtered by `user.permissions` from the API (`products`, `orders`, `customers`, `dashboard`, `reports`, `addresses`) + **Staff** for `owner` only.

## Prerequisites

- Node.js 20+
- Your backend running and reachable from this machine (same rules as `admin-panel-api.md` — CORS not required for the panel if you use only `/api/bff`).

## Setup

```bash
cd proadmin
cp .env.example .env
```

Set **`API_URL`** to your API base (e.g. `http://localhost:4000`). Set **`AUTH_SECRET`** and **`AUTH_URL`**.

**Important:** `AUTH_URL` must use the **same host and port** as the browser URL for this Next app. If you run `next dev -p 3001` or `npm run dev:3001`, set `AUTH_URL=http://localhost:3001`. If it stays `http://localhost:3000` while you open `http://localhost:3001`, Auth.js cookies and redirects often break and login “does not work.”

```bash
npm install
npm run dev
```

The default dev script uses **port 3001** (so it does not fight with whatever is on 3000) on the stable webpack dev server. Open [http://localhost:3001/login](http://localhost:3001/login) and keep **`AUTH_URL`** in `.env` aligned with that port. To use port 3000 instead: `npm run dev:3000` and set `AUTH_URL=http://localhost:3000`.

If you want Turbopack locally, use `npm run dev:turbo` (or `npm run dev:3000:turbo`), but if you see repeated `.next/..._buildManifest.js.tmp` ENOENT errors, switch back to `npm run dev` and clear `.next`.

Sign in with an **owner** or **admin** account from your backend (phone + password).

## Environment variables

| Variable        | Required | Description |
|----------------|----------|-------------|
| `API_URL`      | Yes      | Backend base URL, no trailing slash. |
| `AUTH_SECRET`  | Yes (prod) | NextAuth cookie encryption. |
| `AUTH_URL`     | Yes (prod) | Public URL of **this** Next app. |

## Scripts

| Command              | Description        |
|---------------------|--------------------|
| `npm run dev`       | Dev server         |
| `npm run build`     | Production build   |
| `npm run start`     | Production server  |
| `npm run lint`      | ESLint             |

## Stack

- Next.js 15 App Router, TypeScript, Tailwind v4, shadcn/ui  
- Auth.js v5 (JWT session) + backend tokens in JWT callback + refresh  
- TanStack Query + React Table, Zod, server actions for mutations  

## API reference

See **`../admin-panel-api.md`** in the parent folder for routes, bodies, and guards.
