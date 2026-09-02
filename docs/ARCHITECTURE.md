# ALIVE — System Architecture

**Document owner:** Technology (Deepak) · **Version:** 1.0 · **Effective:** 2026-08-21
**Entity:** VS Collective LLP (LLPIN ACC-2610) · **Product:** ALIVE — in-store live advertising for kirana retail
**Companion documents:** [SOP-v1.0.md](SOP-v1.0.md) (operations), [../ALIVE_PLAYER_API.md](../ALIVE_PLAYER_API.md) (device API reference), [field-trial-runbook.md](field-trial-runbook.md) (on-call)

---

## 1. What the system is

ALIVE turns unused wall space in kirana stores into sellable digital ad inventory. Three parties transact through one platform:

| Party | Gets | Gives |
|---|---|---|
| **Kirana store partner** | Fixed monthly remuneration (₹500 standard / ₹1000 premium), free flyer + billing tools | Wall space, power, Wi-Fi |
| **Brand / advertiser** | Hyperlocal 10-second ad slots, proof-of-play evidence, campaign analytics | Campaign fee (₹699–₹999 per screen per month online + 18% GST) |
| **ALIVE** | The margin between the two | Hardware, software, installation, operations |

The physical unit is a **screen**: an Android TV panel mounted in portrait, running the ALIVE Player APK in kiosk mode, permanently online, playing a server-defined plan and reporting back every play it completes.

---

## 2. Component map

```
                         ┌──────────────────────────────────────┐
   Kirana store          │        ALIVE Studio (Vercel)         │        Operators
 ┌────────────────┐      │  Next.js 15 App Router · 314 files   │   ┌──────────────────┐
 │ Android TV     │      │                                      │   │ /admin  (21 tabs)│
 │ ALIVE Player   │◄────►│  /api/device/*   ← device JWT        │◄──│ password-gated   │
 │ (Kotlin/Media3)│ HTTPS│  /api/brand/*    ← session / public  │   └──────────────────┘
 │ kiosk, portrait│      │  /api/stores/*   ← signed store token│   ┌──────────────────┐
 └───────┬────────┘      │  /api/admin/*    ← admin password    │◄──│ Brand dashboard  │
         │               │  /api/razorpay/* ← HMAC signature    │   │ /dashboard       │
         │ FCM push      │  /api/cron/*     ← CRON_SECRET       │   └──────────────────┘
         │ (plan_updated,└───────────────┬──────────────────────┘   ┌──────────────────┐
         │  reboot,                      │                       ◄──│ Partner PWA +    │
         │  health_ping,      ┌──────────┴──────────┐               │ Expo mobile app  │
         │  decommission)     │  Neon PostgreSQL    │               └──────────────────┘
         │                    │  Prisma · 40 models │
         │                    │  47 migrations      │
         ▼                    └──────────┬──────────┘
 ┌────────────────┐                      │
 │ Cloudflare R2  │◄─── media, KYC docs, GPS photos, APKs
 └────────────────┘                      │
                        ┌────────────────┼─────────────────┬──────────────────┐
                        ▼                ▼                 ▼                  ▼
              AWS Lambda          Remotion Lambda     Railway worker     GitHub Actions
              (ffmpeg transcode)  (offer videos)      (footfall MQTT)    (5-min health cron,
                                                                          APK release,
                                                                          lambda deploy)
```

---

## 3. The screen (ALIVE Player, Android TV)

**Repo:** `ALIVE-Player` · Kotlin 1.9, minSdk 26, targetSdk 35, single `:app` module, ~6,400 LOC
**Stack:** Media3/ExoPlayer 1.3.1, Room 2.6.1, WorkManager 2.9, EncryptedSharedPreferences, Firebase Messaging, Glide, ZXing
**Distribution:** OTA self-update (not Play Store — Play policy forbids self-updating APKs)

### 3.1 Lifecycle

1. **First boot** → `PairingActivity` claims the device using `ANDROID_ID` as `hardwareKey` → server returns a device id, a per-device JWT and a 6-character pairing code.
2. The TV displays the code plus a QR to `/admin/pair?code=XXXXXX`. An operator confirms it in the admin console. The player polls `/api/device/pairing-status` every 5 s until confirmed.
3. **Playback** runs inside `PlaybackForegroundService` (a `mediaPlayback` foreground service holding a partial wake lock) so the engine outlives the activity. `PlaybackActivity` is `singleTask`, immersive, `KEEP_SCREEN_ON`, and is registered as **HOME** so the OS relaunches it after any crash.
4. **Plan** is fetched every 15 minutes (WorkManager's floor) *and* immediately on an FCM `plan_updated` push, so an admin edit reaches a screen in seconds.
5. Every completed item writes a **proof-of-play** row locally; `PopUploadWorker` drains the backlog to the server and deletes rows only after a 200.

### 3.2 Reliability layers (why screens stay up in shops nobody watches)

| Layer | Mechanism |
|---|---|
| In-process watchdog | 5 s poll; 6 stuck ticks → restart item ×3 → fallback playlist |
| Cross-process watchdog | Separate `:watchdog` process reads a heartbeat **file** every 20 s; at 90 s stale it kills and restarts the main process (a frozen process cannot answer Binder, so the check must be file-based) |
| Crash handler | Uncaught exception → incident row in Room → hard process exit → OS relaunches HOME |
| Stall detection | Three independent detectors in the engine — position stall (10 s), first-frame deadline (20 s), player error — each evicts the cached file and advances |
| Decoder blocklist | Known-broken hardware decoders (HiSilicon AVC, Realtek OMX, Realtek Codec2 HEVC) excluded by exact name; panels with unreliable AVC play the server's HEVC rendition instead |
| Clock repair | NTP sync runs *before* the first HTTPS call (a drifted clock fails TLS, so a post-success sync never runs on the devices that need it); falls back to the HTTP `Date` header where UDP/123 is blocked; on Device Owner it corrects the system clock |
| Network diagnosis | A TLS failure is translated into an operator-readable cause: "router is blocking wearealive.in" vs "device date/time is wrong" |
| Kiosk | Device Owner → persistent HOME + `startLockTask()`; BACK/HOME/SEARCH/APP_SWITCH swallowed; 5×BACK exit hatch for servicing; MENU / triple-Select opens Settings |
| Download integrity | Staging `.part` in the same directory so promotion is an atomic rename; HTTP range resume; MD5/SHA-256 verification; free-space pre-check; 2 GB LRU cache |
| Push safety | Destructive commands (`reboot`, `decommission`) are **rejected** if delivered via a topic — token-only, so one server-side mistake cannot wipe the fleet |
| Decommission safety | A bare 410 is treated as transient; only a 410 carrying `{"error":"Device deleted"}` wipes the device |

### 3.3 Panel-specific handling

| Panel / SoC | Failure | Handling |
|---|---|---|
| HiSilicon Hi3751V350 (Foxsky, KTC) | AVC decoder accepts input, never drains output → permanent blank, no error | Decoder name blocklisted; HEVC path used |
| Realtek SPPL_2K_RT41 (Kodak), rtd2841a (D5STV) | OMX decoder fails init | Blocklisted |
| Realtek Codec2 HEVC | `CodecException 0xe` at runtime → black-screen retry loop | Blocklisted **on branch `fix/field-freeze-and-cache-hygiene` (PR #57) only — not on `main`** |
| MStar (no RTC battery) | Cold boot with a stale clock → Firebase auth fails → no FCM token for the session | 60 s plan poll that self-disables once a token appears |
| Kodak | `setRequestedOrientation` throws on OEM non-fullscreen windows | Orientation applied in software; the throwing call is swallowed |
| Google TV / ASAANO | Launcher re-enables on boot; lock task not resumed | Accepted: brief OEM launcher flash before the player relaunches |

---

## 4. ALIVE Studio (the server)

**Repo:** `studio` · Next.js 15.3 App Router on Vercel · React 18.3 · Tailwind + shadcn/ui · Prisma 6 → Neon PostgreSQL
**Deploy path:** push to `main` → Vercel builds → `prisma migrate deploy && prisma generate && next build`

### 4.1 Four authentication realms

| Realm | Mechanism | Used by |
|---|---|---|
| Device | Per-device HS256 JWT signed with a per-device secret, 90-day expiry | The player |
| Store partner | HMAC-signed token `st1.<storeId>.<expMs>.<sig>`, 90-day TTL, constant-time compare | Partner PWA + Expo app |
| Brand / user | Auth.js v5, JWT sessions, phone-password and email-password credentials | Brand dashboard |
| Admin | Shared `ADMIN_PASSWORD` header | Admin console (~63 routes) |

Plus `CRON_SECRET` bearer for cron/agent routes and a shared secret for the transcode Lambda callback.

### 4.2 The device API (the contract that matters)

| Endpoint | Cadence | Purpose |
|---|---|---|
| `POST /api/device/claim` | Once, then on any 401/403 | Register hardware, mint JWT, issue pairing code |
| `GET /api/device/pairing-status` | 5 s while pairing | Wait for admin confirmation |
| `GET /api/device/plan` | 15 min + on push | **The core endpoint.** 72-hour rolling plan: resolves slot mode vs schedule mode, priority conflicts, dayparting, nested playlists, overlays, orientation, per-fleet config; returns a `planHash` the client uses to short-circuit |
| `POST /api/device/events` | After each item + 15 min | Proof-of-play batch (idempotent by client UUID) **and** heartbeat telemetry (CPU temp, storage, versions, `playbackAliveMs`, uptime → `bootedAt`) **and** incident batches |
| `POST /api/device/fcm-token` | On token change/drift | Push addressing, with self-heal when the server copy drifts |
| `GET /api/device/update-check` | 6 h | OTA: returns `{versionCode, versionName, apkUrl, sha256}` from env pins or the `latest.json` GitHub Release manifest |

A valid token whose device row was deleted returns **410 Gone** so the screen self-decommissions instead of hammering a dead id.

### 4.3 Inventory: two coexisting playback models

**Schedule mode** (default) — `Schedule` rows target device ids, a group, store ids or a city, carry a priority and a recurrence, and are resolved server-side by an interval sweep: higher priority wins, ties break on earlier start, contiguous same-schedule slots merge. Playlists may nest playlists (max depth 3, cycles rejected at write time).

**Slot mode** (the ad product) — a store with `loopSlotCount` set runs a fixed loop of N × 10 s slots between `hoursStart` and `hoursEnd` on its open days. Inventory is sold as **(store, IST date, loop position)** — never clock time. Rules enforced in `src/lib/slots.ts`:
- Availability counts **sold** bookings only, so filler never reads as sold out.
- **No dark slots:** unsold positions are redistributed round-robin as *bonus* plays across the sold campaigns (recorded with `isFiller=true` but attributed to the campaign). With zero sales the loop plays the house filler campaign.
- Shrinking a store's loop repacks bookings in one transaction and rejects a genuine oversell rather than silently dropping a paid slot.
- If slot mode is on but the loop would be empty, the plan endpoint **falls back to schedule mode** rather than serving a dark plan.

### 4.4 Money

Razorpay only. Volume-tiered pricing (online ₹999 / ₹899 / ₹799 / ₹699 per screen-month at 1 / 3+ / 10+ / 20+ screens, anchored against list ₹1,299–₹999) plus 18% GST, DB-backed coupons, optional one-per-email trial. The browser total is display-only: the server recomputes the amount when creating the order **and** re-fetches the order from Razorpay on verification, storing Razorpay's amount. Only the signature-verified verify route can set a campaign `active`.

On the supply side, `StorePayment` holds one row per store per month (`YYYY-MM`) for the fixed remuneration, driven from the admin Payouts tab with UPI QR and bulk bank CSV export.

### 4.5 Proof of play

`PlayEvent` is the billable record: device, campaign, media, schedule, start/end/duration, slot position, filler flag, impressions, and a SHA-256 `rowHash` chained off the previous row's hash so the log is tamper-evident. Ingest is idempotent by client UUID. Reporting composes by screen / by ad / by group over a date range with server-side rollups and CSV export; `/api/events/verify` re-validates the hash chain; `HourlyPop` carries hourly rollups.

### 4.6 Fleet health

A GitHub Actions schedule calls `/api/cron/device-health` every 5 minutes (Vercel Hobby cannot run sub-daily crons; a once-daily Vercel cron is the fallback). The cron atomically flips devices whose `lastSeen` is older than 20 minutes to OFFLINE and captures exactly the set that crossed the edge, recomputes 30-day uptime, and opens remediation tickets on threshold breaches.

Three distinct signals answer three different questions:

| Signal | Answers |
|---|---|
| `lastSeen` | Is the process alive and networked? |
| `playbackAliveAt` | Is content actually still advancing? (`lastSeen` fresh + this stale = **frozen screen**) |
| `bootedAt` | Did it reboot during the outage? (boot inside the gap = power cut; boot before it = something else broke) |

Alerting is incident-shaped, not cron-shaped: one `DeviceAlert` row per outage, admin notified at the offline edge (digested into one message when ≥3 screens drop together), **partner notified only after ~60 minutes of sustained downtime** with a live re-check first, so a self-healing screen never generates a shopkeeper message.

### 4.7 Media pipeline

Upload → presigned PUT straight to R2 (server proxy only for small KYC/photo uploads, because Vercel caps request bodies around 4.5 MB) → async AWS Lambda container running ffmpeg → **H.264 Main@4.1, yuv420p, ≤1080p30 + AAC** (budget SoCs reject High@5.0 even when ExoPlayer reports support) plus a best-effort HEVC rendition → callback updates the `Content` row. A new object key and hash means cached devices pick it up on the next plan fetch like any other content change. `local-transcode.mjs` is the operator-run equivalent when Lambda is unavailable.

### 4.8 Out-of-process workers

| Worker | Where | Job |
|---|---|---|
| Transcode Lambda | AWS ap-south-1, container image in ECR | ffmpeg re-encode (above) |
| Remotion Lambda | AWS | Renders 1080p offer videos from the product catalogue (POC) |
| footfall-worker | Railway | MQTT subscriber for the ESP32 Wi-Fi-CSI + BLE footfall sensors; fuses signals, dedups, excludes staff zones, correlates presence to plays |
| GitHub Actions | GitHub | 5-min health cron, APK release + `latest.json` manifest, transcode-Lambda deploy |

---

## 5. Data model (40 Prisma models — the ones that carry the business)

| Cluster | Models | Carries |
|---|---|---|
| Supply | `Store`, `StorePayment`, `PushSubscription` | Partner profile, 4-stage onboarding, GPS-verified photos, KYC, payout, tier, slot-loop config, monthly remuneration |
| Demand | `Brand`, `Campaign`, `Coupon` | Advertiser, booking (screens × months), Razorpay ids, creatives, preferred stores |
| Fleet | `Device`, `DeviceAlert`, `RemediationTicket/Proposal`, `TelemetryEvent`, `PlayerConfig` | Screen identity, health, outage incidents, error sink, fleet-wide player knobs |
| Content | `Content`, `Playlist`, `PlaylistItem`, `Schedule`, `Composition`, `Overlay` | Media (+ transcode + HEVC rendition), ordered/nested playlists, targeting, multi-zone layouts, tickers |
| Inventory & evidence | `SlotBooking`, `PlayEvent`, `HourlyPop` | What was sold, what actually played, hourly rollups |
| Retail (VoiceBill) | `Flyer`, `Customer`, `Bill`, `BillItem`, `Product`, `StoreOffer` | Partner-facing billing/offers tools that keep the shopkeeper engaged |
| Sensing | `FootfallEvent`, `FootfallHourly`, `ScreenPresenceEvent`, `StoreSensorHealth` | Audience measurement and ad-attribution signal |
| Ops/AI | `AuditLog`, `ExternalSignal`, `ContextDocument`, `ContextSyncState` | Audit trail, market signals, operational context index |

---

## 6. End-to-end flows

**A store goes live**
Partner registers (web or Expo app) with a map pin (`Store.lat/lng`; a legacy row without one is filled by the first on-site GPS fix, or set by ops in Admin → Stores → Edit → Map pin) → agreement + consent captured with a timestamp → GPS shop-front photo gates the stage past `new` — from `contacted` the store is on the public map as "Coming soon", nothing waits for `live` → field visit installs the TV → install record + GPS install photos + map pin gate the stage past `contacted` → screen claims itself and shows a pairing code → admin confirms → screen linked to store → playlist/schedule assigned → stage set `live`, `liveAt` starts the earning clock.

**A brand books a campaign**
Brand onboarding funnel (screens 1–50, months 1–12, start date, map screen picker) → server computes the amount from volume tier + coupon + GST → Razorpay order → signature-verified payment → campaign `active` → ops assigns slot bookings for (store, date, position) → creative uploaded and transcoded → plan endpoint emits the loop → screens play it → `PlayEvent` rows land → advertiser sees proof-of-play and analytics.

**A change reaches a screen**
Admin edits a schedule → FCM `plan_updated` to the affected devices → each device fetches `/api/device/plan`, compares `planHash`, downloads any new assets (verified by hash), and swaps at the next item boundary. If FCM is unavailable the 15-minute poll picks it up; if the device never gets an FCM token, a 60-second fallback poll covers it.

**A screen goes dark**
Heartbeats stop → within 20 min the 5-minute cron flips it OFFLINE and opens a `DeviceAlert` → admin notified immediately (digested if several) → if still down at ~60 min the partner gets a WhatsApp message → on recovery the heartbeat resolves the alert and fills `downtimeSec` → `bootedAt` compared across the gap says whether it was a power cut.

---

## 7. Known architectural risks

| # | Risk | Consequence | Status |
|---|---|---|---|
| 1 | **Schema change without a migration** | Prisma selects all scalar columns by default, so one missing column 500s every full-row device query — plan, events, claim, pairing, health cron | **Realised 2026-08-20**: `Device.bootedAt` shipped in schema without its migration and took the device API down for ~5.5 h. Fixed by applying `20260820180000_device_booted_at`. Must become a pre-push check |
| 2 | Fleet runs code that `main` does not | PR #57 (Realtek Codec2 blocklist, frozen-glass watchdog, cache prune) is unmerged; a build from `main` is a regression for deployed screens | Open |
| 3 | CI versionCode vs hand-built `999xxx` | CI APKs read as a downgrade and the `latest.json` CI publishes clobbers the real OTA manifest | Fix exists unmerged on `fix/ci-fleet-versioning` |
| 4 | Two signing lineages (CI keystore vs a laptop debug keystore) | Crossing them needs an uninstall → pairing loss → new `hardwareKey` → orphaned device row | Open |
| 5 | 63 admin routes fail **open** if `ADMIN_PASSWORD` is unset | Entire admin API exposed in a misconfigured environment | Open |
| 6 | Build ignores TypeScript and ESLint errors; no CI build/lint/test gate | A type regression can reach production unchallenged | Open |
| 7 | Near-zero automated tests (18 player unit tests, 0 studio tests) on a system handling payments and billable evidence | Regressions are found in the field | Open |
| 8 | Health cron depends on a GitHub Actions schedule | GitHub may pause schedules on repo inactivity; alerting silently stops | Documented in the runbook |
| 9 | Room `fallbackToDestructiveMigration` | A future schema bump touching `proof_events` destroys the un-uploaded (billable) backlog | Documented in code, undefended by a test |
| 10 | Device clock drift | 1,986 of 14,848 recorded plays carry 2024 timestamps | Player-side NTP repair shipped; historical rows still wrong |
| 11 | QR attribution not implemented | No scan endpoint, no UTM model — the advertiser-facing conversion story is unbuilt | Open |
