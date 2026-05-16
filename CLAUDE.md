# ALIVE Advertising Platform — CLAUDE.md

## Project Overview

**ALIVE** (wearealive.in) is a kirana store digital advertising network based in Mangaluru, Karnataka.
The platform connects three parties:
- **Brands** — pay to run ad campaigns on screens inside kirana stores
- **Kirana store owners (Store Partners)** — host a free ALIVE screen and earn ₹500 + electricity/month
- **Shoppers** — see deals/offers at their local kirana store

**Company:** VS Collective LLP · GST 29AAXFV2589C1ZE · LLP IN-KA43598411418020V  
**Contact:** hello@wearealive.in · +91 74113 24448  
**Address:** #13 First Floor Highland Manor, Falnir, Mangalore 575002

---

## Architecture (target)

ALIVE is **one Next.js app** that does everything:
- Marketing site (`/`, `/store`, `/blog`, etc.)
- Brand onboarding + dashboard
- Store partner registration + dashboard
- **Console / admin** for fleet management (`/admin` with Screens, Content, Playlists, Schedules, Reports, Monitoring tabs)
- **Device/player API** for the Android TV apps (`/api/device/*`)

The only separate codebase is **ALIVE-Player** (Kotlin Android TV APK).

## Tech Stack

- **Framework:** Next.js 15 App Router (`'use client'` boundaries throughout)
- **Styling:** Tailwind CSS + shadcn/ui (Radix primitives)
- **Animations:** Framer Motion
- **Auth (target):** Auth.js v5 (`next-auth@beta`) with Prisma adapter. One `User` table with `role` enum (`STORE_PARTNER | BRAND | AGENCY | ADMIN | OPS`). Phone+password (Credentials provider) for store partners; email magic-link for brand/admin/ops.
- **Auth (legacy, in migration):** Clerk for brand dashboard + custom localStorage for store partners — both being phased out.
- **Primary DB:** PostgreSQL via Prisma 6. Use **Neon** for Vercel — pooled `DATABASE_URL` for runtime + direct `DATABASE_DIRECT_URL` for migrations.
- **Cache / sessions / rate-limit:** Upstash Redis (kept alongside Postgres for short-lived state).
- **Media storage:** Cloudflare R2 (S3-compatible, zero egress). Direct browser→R2 upload via signed PUT URLs from `lib/r2.ts` — never proxy media through Next.js API routes (Vercel payload limits).
- **Payments:** Razorpay (brand campaigns)
- **Maps:** Leaflet (plain, no react-leaflet) + CartoDB Voyager tiles
- **Geocoding:** OpenStreetMap Nominatim
- **AI:** Genkit + Google AI
- **React version:** 18.3.1 (NOT 19)

---

## Key Routes

| Route | Description |
|-------|-------------|
| `/` | Main marketing homepage (brand-facing) |
| `/store` | Kirana store partner landing + registration |
| `/store-dashboard` | Store partner dashboard (login + overview/earnings/flyers tabs) |
| `/store-agreement` | Full VS Collective LLP store partner contract (rendered page) |
| `/brand-onboarding` | Multi-step brand campaign onboarding flow |
| `/admin` | Admin dashboard — Flyers, Stores, Campaigns tabs |
| `/dashboard` | Brand campaign dashboard (Clerk auth) |
| `/deals` | Shopper deals/offers page |

---

## API Routes

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/stores/save` | POST | none | Register a new store |
| `/api/stores/save` | GET | `admin-password` header | List all stores |
| `/api/stores/login` | POST | none | Store partner login by phone+password |
| `/api/flyers/save` | POST | none | Upload a flyer |
| `/api/flyers/save` | GET | none | List all flyers |
| `/api/flyers/delete` | POST | none | Delete a flyer by ID |
| `/api/campaigns/save` | POST | none | Save a brand campaign |
| `/api/campaigns/list` | GET | none | List campaigns |
| `/api/campaigns/admin` | GET | `admin-password` header | Admin: all campaigns with revenue |
| `/api/razorpay` | POST | none | Create Razorpay order |

---

## Database Models (Prisma)

Defined in `prisma/schema.prisma`. Run `npx prisma migrate dev` after pulling.

| Model | Purpose |
|-------|---------|
| `User` | All humans (store partners, brands, admin/ops) — Auth.js compatible. Holds `role`, `phone`, `passwordHash`. |
| `Account / Session / VerificationToken` | Auth.js standard. |
| `Store` | Kirana store profile (1-to-1 with a STORE_PARTNER User). Holds map coords, referral code. |
| `Brand` | Brand profile (1-to-1 with a BRAND User). `walletPaise` BigInt for prepaid balance (T2). |
| `Campaign` | Brand campaign — already on Razorpay. |
| `Device` | Physical screen running ALIVE-Player. `hardwareKey` from Android. `groupName` for group-based scheduling. |
| `Content` | Media file (image / video). `objectKey` is the R2 path. `md5` for player cache invalidation. |
| `Playlist` + `PlaylistItem` | Ordered list of content with per-item duration. |
| `Schedule` | Assigns a playlist to a set of devices OR a `groupName`, with optional dayparting (`dailyStart`/`dailyEnd`). |
| `PlayEvent` | Proof-of-play log row. Indexed on `(deviceId, startedAt)`, `tag` (campaign attribution). `prevHash`/`rowHash` reserved for T2 tamper-evident chain. |
| `Flyer` | Existing flyer feature, migrating from Redis-base64 to R2. |
| `AuditLog` | Reserved for T2 audit trail. |

Always import the singleton from `@/lib/db`:
```ts
import { db } from '@/lib/db';
const stores = await db.store.findMany();
```

---

## Redis Data Model (legacy, being migrated)

Uses per-key storage (not single-blob arrays) to stay under Upstash 1MB/value limit.

```
stores:index          → string[]          # list of store IDs
store:{id}            → StoreInfo JSON    # individual store

flyers:index          → string[]          # list of flyer IDs  
flyer:{id}            → Flyer JSON        # individual flyer (includes base64 image)

campaigns:all         → Campaign[]        # all campaigns (admin use)
```

**Always use lazy `getRedis()` pattern** — never module-level `const kv = new Redis(...)` as it breaks SSG:
```ts
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  return new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
}
```

---

## Store Partner Auth

**No Clerk** — custom phone + password auth.

- `localStorage` key: `alive_store_session`
- On registration: saves full session to localStorage immediately (works even without Redis)
- On login: checks localStorage first → falls back to `/api/stores/login` API
- Session shape:
```ts
{
  storeName, ownerName, whatsapp, phone, password,
  address, locality, city, pincode, lat, lng,
  referralCode,   // e.g. "SHARRAM4X2" — generated on registration
  referredBy,     // optional code entered during signup
  agreedAt,       // ISO timestamp when agreement was accepted
  screens: 1,     // always 1 screen per store
}
```

---

## Store Partner Business Rules

- **Fixed remuneration:** ₹500/month per screen (matches clause 3.3 of store agreement)
- **Electricity:** reimbursed separately at screen rated power × actual hours × prevailing tariff
- **Only 1 screen per store** — do not show screen count selectors
- **Referral rewards:** ₹500 per new store partner who joins using a referral code
- **Payout timing:** within 10 working days of month end via UPI/NEFT
- **Exclusivity:** ALIVE will not install within 200m of a partner store

---

## Store Registration Flow (2-step)

1. **Step 1 — Store details form:**
   - Store name, owner name, WhatsApp (= username), password (min 6 chars)
   - Leaflet map (CartoDB Voyager tiles) — drag pin or click to set location
   - Locality, pincode, city autofilled via Nominatim on pin move
   - Optional referral code field
   - Inline validation: errors shown on first submit attempt

2. **Step 2 — Agreement:**
   - Shows party block with store name, owner name, phone, address **prefilled from step 1**
   - Key terms summary (remuneration, electricity, equipment, exit)
   - Checkbox: "I agree" — must be ticked to submit
   - On submit: generates unique referral code, saves `agreedAt` timestamp

---

## Map / Location

- **Component:** `src/components/map-picker.tsx`
- **Tiles:** CartoDB Voyager — light theme, shows street labels and landmarks
- **Default centre:** Mangaluru (12.8698°N, 74.8431°E)
- **Reverse geocode:** Nominatim (`nominatim.openstreetmap.org/reverse`) → locality, pincode, city
- **Stored data:** `lat`, `lng`, `locality`, `pincode`, `city` — used later to show network map on homepage
- Do **not** install `react-leaflet` (requires React 19) — use plain `leaflet` with dynamic import only
- Do **not** install `snazzy-info-window` (Google Maps only, incompatible)

---

## Admin Dashboard (`/admin`)

- No Clerk — protected by `admin-password` env var checked in API headers
- Three tabs: **Flyers** | **Stores** | **Campaigns**
- Flyer upload: client-side Canvas compression (1200px, JPEG 0.75) before base64 storage
- Stores panel: search by name/city, shows all registered store partners
- Campaigns panel: revenue total, paid/pending counts

---

## Image Storage

- Images compressed client-side before upload (Canvas API, max 1200px, 0.75 quality)
- Stored as base64 in Redis per-flyer key
- `resolveImage(raw)` helper: prepends `data:image/jpeg;base64,` if not already a data URL

---

## Brand Onboarding (`/brand-onboarding`)

- Multi-step campaign flow: audience → locations → duration → creative → pricing → agreement → payment
- Razorpay for payments
- Promo code `GETALIVENOW` reduces price from ₹799 → ₹699
- GST at 18% added on top of base price
- Agreement auto-fills brand name, campaign details, date

---

## Design Conventions — UI / Visual

**Strictly avoid generic AI aesthetics:**
- No neon accent colours, rainbow palettes, or glowing buttons
- No floating decorative shapes, orbs, or blobs in backgrounds
- No heavy gradients used purely for decoration (gradients are fine for data viz or subtle depth)
- No "glassmorphism" cards with heavy backdrop-blur as the primary design motif
- No animated particle effects or canvas-based decorations

**ALIVE visual language:**
- Brand red: `#ef4444` / `#b91c1c` (primary), used sparingly on CTAs and key labels
- Backgrounds: white (`bg-white`) or very light gray (`bg-gray-50` / `bg-background`)
- Cards: white with a single `border border-border` — no shadow stacks, no double-border tricks
- Typography: tight tracking on headings (`tracking-tight`), `font-black` for hero numbers
- Savings / positive indicators: `text-green-700` on `bg-green-50` — not neon green
- Status badges: small, muted, no icons unless genuinely necessary
- Motion: Framer Motion for enter animations only (`fadeUp`, `stagger`) — never looping or attention-seeking

## Important Conventions

- **`'use client'`** must be first line of any component using hooks, browser APIs, or Framer Motion
- **No module-level Redis** — always lazy `getRedis()`
- **Dark theme on store pages** was replaced with **light theme** (white/gray-50) matching brand onboarding
- **Inline styles** for colours that must be exact (e.g. map overlay, brand red `#ef4444`/`#b91c1c`)
- **No react-leaflet** — plain leaflet with `async function loadLeaflet()` dynamic import pattern
- **`localStorage('alive_store_session')`** — the single key for store auth; do not use sessionStorage or other keys
- Images: always use `// eslint-disable-next-line @next/next/no-img-element` before `<img>` tags for base64 images

---

## Development Branch

Active feature branch: `claude/build-alive-advertising-platform-tlG96`

Merge to `main` → auto-deploys to Vercel production.

---

## Env Vars Required

```
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
```
