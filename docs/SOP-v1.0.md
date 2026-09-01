# ALIVE Network Operations SOP — v1.0


## 0. Document Control

### 0.1 Document identification

| Field | Value |
|---|---|
| Title | ALIVE Network Operations SOP — Mangaluru Kirana Screen Network |
| Version | 1.0 |
| Owner | Technology (Deepak) |
| Effective date | 2026-08-21 |
| Entity | VS Collective LLP (LLPIN ACC-2610) · GST 29AAXFV2589C1ZE |
| Registered office | #13 First Floor Highland Manor, Falnir, Mangalore 575002 |
| Contact | hello@wearealive.in · +91 74113 24448 |
| Grant context | Karnataka ELEVATE — Tranche-1 deliverable (field trial, ~10 screens) |
| Companion documents | `studio/docs/ARCHITECTURE.md` (system architecture), `studio/docs/field-trial-runbook.md` (on-call runbook), `studio/ALIVE_PLAYER_API.md` (device API reference), `ALIVE-Player/PROVISIONING.md` (Device Owner enrollment), `apk-releases/README.md` (APK build lineages) |

### 0.2 Revision history

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-08-21 | Technology (Deepak) | Initial issue |

### 0.3 Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Technology | Deepak | ______________ | __________ |
| Operations | [Founder — name] | ______________ | __________ |

### 0.4 Review cadence

- Review **quarterly** (next scheduled review: 2026-11-21), **or immediately after any P1 incident**, whichever comes first. A P1 is any incident that takes down the device API, stops proof-of-play recording, or darkens 3+ screens simultaneously — e.g. the 2026-08-20 incident where a schema change shipped without its migration and took the device API down for ~5.5 hours (see `ARCHITECTURE.md` §7, risk #1).
- Every revision increments the version, gets a row in §0.2, and is re-approved per §0.3.
- The version in the repository at `studio/docs/` is the single source of truth. Printed copies are uncontrolled — check the version number before following a printed copy.

### 0.5 Distribution list

| Recipient | Format |
|---|---|
| Technology (Deepak) | Repository (owner copy) |
| Operations ([Founder — name]) | Repository + PDF |
| [Ops Lead — name] | PDF + printed field copy |
| Field Executives | Printed field copy (sections 3–5 minimum) |
| BDE(s) | PDF (sections 1, 2 and brand-facing sections) |
| Karnataka ELEVATE grant file | PDF snapshot of the approved version |

---

## 1. Scope, Definitions & Glossary

### 1.1 Scope

This SOP covers the day-to-day operation of the ALIVE in-store screen network in Mangaluru: Android TV panels mounted in portrait, running the ALIVE Player APK in kiosk mode inside partner kirana stores, managed by the ALIVE Studio platform at `https://wearealive.in` (Next.js on Vercel, Neon PostgreSQL).

In scope:

1. **Screen installation and provisioning** — unbox to playing content, including Device Owner enrollment and pairing.
2. **Store partner onboarding** — the 4-stage pipeline from registration to `live`, including agreement, GPS photo gates, KYC and payout setup (Section 3).
3. **Content operations** — playlists, schedules, slot-loop inventory, force sync, rollback.
4. **Monitoring** — offline detection (20-minute `lastSeen` threshold, 5-minute health cron), frozen-screen detection, alert lifecycle.
5. **Troubleshooting and escalation** — dark-screen diagnosis order and site-visit criteria, absorbing `field-trial-runbook.md`.
6. **Release management** — Studio deploys and Player OTA, including the `999xxx` sideload lineage rules.
7. **Decommissioning** — removing a screen or store without orphaning devices or wiping billable data.

Out of scope: brand campaign sales strategy and repricing decisions (pricing itself is code-controlled in `studio/src/lib/brand-pricing.ts` — online tiers ₹999 / ₹899 / ₹799 / ₹699 per screen-month at 1 / 3+ / 10+ / 20+ screens, plus 18% GST; nobody quotes prices from memory), legal drafting of the partner agreement, and hardware procurement.

### 1.2 Audience

Field Executives, Operations Executives, BDEs, Technology, and (for the sections addressed to them) Store Partners. Written to be followable with no prior context beyond this document and its companions.

### 1.3 Glossary

| Term | Meaning |
|---|---|
| **Screen** | The product unit: one Android TV panel, portrait, kiosk mode, running ALIVE Player inside a partner store. Business rule: **1 screen per store**. |
| **Device** | The `Device` database row representing a screen in the fleet. Status is server-managed: `PENDING` (claimed, no schedule), `ONLINE`, `OFFLINE`. |
| **hardwareKey** | The Android `Settings.Secure.ANDROID_ID`, sent on `POST /api/device/claim`. It is the screen's permanent identity — an uninstall/factory reset generates a **new** hardwareKey and orphans the old device row. This is why signing-lineage rules (§12.2) matter. |
| **Pairing code** | 6-character code the TV displays after first-boot claim, alongside a QR to `/admin/pair?code=XXXXXX`. The player polls `/api/device/pairing-status` every 5 s until an operator confirms it in the admin console. |
| **Plan** | The 72-hour rolling playback plan from `GET /api/device/plan`: content items, timeline windows, overlays. Fetched every 15 minutes, immediately on an FCM `plan_updated` push, and on every app start. |
| **planHash** | SHA-256 fingerprint of the full plan. The player skips all processing when it matches the cached hash — this is why "the screen didn't update" is usually a hash/push question, not a download question. |
| **Schedule mode** | Default playback model. `Schedule` rows target device ids, a group, store ids or a city, carry priority + recurrence + dayparting; higher priority wins, ties break on earlier start. |
| **Slot mode** | The ad product. A store with `loopSlotCount` set runs a fixed loop of N × 10-second slots between `hoursStart` and `hoursEnd` (defaults 09:00–21:00 IST) on its open days. If the loop would be empty, the plan endpoint falls back to schedule mode rather than serving a dark plan. |
| **Slot / loop position** | 0-based position within the slot loop. Inventory is sold as **(store, IST date, loop position)** — never clock time. |
| **Filler play** | A play in an unsold loop with zero sales: the house filler campaign runs. Recorded with `isFiller=true`. |
| **Bonus play** | An unsold position redistributed round-robin across the **sold** campaigns ("no dark slots"). Recorded `isFiller=true` but attributed to the campaign — brand reports split guaranteed vs bonus plays on this flag. |
| **PoP / PlayEvent** | Proof-of-play: one row per completed content item (device, campaign, media, start/end/duration, slot position, filler flag), idempotent by client-generated UUID, hash-chained (`rowHash`) so the log is tamper-evident. **This is the billable record and the grant deliverable — never delete PlayEvents.** |
| **Device Owner** | Android device-admin status granted by zero-touch QR provisioning (`ALIVE-Player/PROVISIONING.md`). A **factory-reset operation**, done once per device. Unlocks silent HOME claim (boots straight into the player) and silent OTA installs (API 31+). |
| **Kiosk mode** | Persistent HOME + `startLockTask()`; BACK/HOME/SEARCH/APP_SWITCH swallowed. Servicing hatches: **5×BACK** exits the kiosk; **MENU** or triple-Select opens Settings/diagnostics. |
| **OTA** | Over-the-air self-update. The player calls `GET /api/device/update-check` every 6 hours; the server answers from env pins (`PLAYER_LATEST_VERSION_CODE` etc. — used for pin/rollback) or the `latest.json` GitHub Release manifest. Not Play Store — Play policy forbids self-updating APKs. |
| **FCM** | Firebase Cloud Messaging push. Data types include `plan_updated`, `reboot`, `health_ping`, `decommission`. Destructive commands (`reboot`, `decommission`) are **rejected if delivered via a topic** — token-only, so one server mistake cannot wipe the fleet. Push is best-effort; polling is the fallback. |
| **Heartbeat** | The periodic `POST /api/device/events` call (may carry zero events — telemetry only). It is a WorkManager `PeriodicWorkRequest`, which Android clamps to a **15-minute floor** regardless of the requested interval. |
| **lastSeen** | Timestamp of the device's last `plan`/`events` call. Answers: *is the process alive and networked?* The health cron flips a device `OFFLINE` when `lastSeen` is **> 20 minutes** old (threshold chosen because a 10-minute one flapped healthy devices given the 15-minute heartbeat floor). |
| **playbackAliveAt** | Timestamp content last actually advanced. Answers: *is content still playing?* `lastSeen` fresh + `playbackAliveAt` stale = **frozen screen** (process up, display stuck). |
| **bootedAt** | The device's boot time, reported in heartbeat telemetry. Answers: *did it reboot during the outage?* A boot **inside** the offline gap = power cut; boot **before** it = something else broke. |
| **uptimePctD30** | Rolling 30-day uptime percentage per device, recomputed by the 5-minute health cron; a drop of >15 points opens a remediation ticket. |
| **Onboarding stage** | `Store.onboardingStage`: `new` → `contacted` → `physically_onboarded` → `digitally_onboarded` → `live` (plus `rejected`). Advancement is gated by GPS photos — see §3. |
| **liveAt** | Timestamp the admin marks a store live. **The partner's earning clock starts here** — ₹500/month standard, ₹1000/month premium, pro-rated from `liveAt`. |
| **Decommission** | Full device wipe (cached plan, media, Room tables, SharedPreferences incl. token and FCM token) and return to the pairing screen. Triggered only by an HTTP **410 carrying `{"error":"Device deleted"}`** or a token-addressed FCM `decommission` push. A bare 410 is treated as transient. The wipe is deliberate and irreversible — which is why device deletion is Technology-only (§2). |
| **Force Sync** | Admin action (`POST /api/devices/[id]/force-sync`) that sets `forceSyncAt` and changes the plan hash, making the player invalidate its cache and re-download immediately instead of waiting for the next poll. |
| **Remediation ticket** | `RemediationTicket` row auto-opened by the health cron on threshold breach (3 missed heartbeat windows, 3+ offline transitions in 24 h, or a >15-point uptime drop), with an admin WhatsApp alert. |

---

## 2. Roles & Responsibilities

### 2.1 Role matrix

| Role | Responsibilities | Systems touched | Must NEVER do |
|---|---|---|---|
| **Field Executive** [name] | Site visits; TV mounting and physical install; Wi-Fi/power hookup; taking the GPS shop-front and install photos on-site; on-site troubleshooting (power-cycle, 5×BACK service hatch, MENU → Settings diagnostics); collecting signed agreement + KYC documents; partner hand-holding on the dashboard. | Physical hardware; partner's phone/browser for `wearealive.in/store` registration and photo upload; WhatsApp with Ops. **No admin console access.** | Delete or "reset" a device (uninstall/factory reset changes the `hardwareKey`, orphans the device row, and loses pairing); sideload any APK not handed over by Technology (mixing the CI keystore and laptop-debug `999xxx` signing lineages forces an uninstall → pairing loss); exit kiosk mode and leave the store without restoring playback; promise premium (₹1000) rates — that requires the gated link (§3.4). |
| **Operations Executive** [Ops Lead — name] | Owns the onboarding pipeline (§3): verifies GPS photos, advances stages, reviews KYC, sets up payouts and runs the monthly payout cycle; confirms device pairing; assigns playlists/schedules; first-line remote triage per `field-trial-runbook.md` §2 (check Screens/Monitoring tab → open ticket → call store → escalate); partner WhatsApp communication. | Admin console (`/admin` — Stores, Screens, Content, Programming, Slot inventory, Reports, Monitoring, Payments, Alerts tabs); WhatsApp. | Delete a store or device (store delete **cascades**: devices decommission-wipe via FCM/410, the partner's user account is deleted, R2 photos removed — Technology-only); push code or APK releases; change prices, coupons, or `PREMIUM_SIGNUP_KEY`; advance an onboarding stage by working around a 409 photo-gate error; share the `ADMIN_PASSWORD`. |
| **Technology / Admin** Deepak | Studio deploys (push to `main` → Vercel build runs `prisma migrate deploy`); Player releases and OTA pins; Device Owner QR provisioning; device/store deletion and decommission; schema migrations; env vars and secrets; final escalation for anything the runbook can't resolve; P1 incident response and postmortem (triggers §0.4 review). | Everything: repos, Vercel, Neon, R2, GitHub Actions, admin console, ADB on devices. | Ship a schema change without its migration (caused the 2026-08-20 ~5.5 h device-API outage — risk #1 in `ARCHITECTURE.md`); build fleet APKs from a branch missing fixes the fleet already runs (risk #2: PR #57 fixes are on `fix/field-freeze-and-cache-hygiene`, not `main`); cross APK signing lineages on a paired device; deploy or push to production without the explicit go-ahead recorded for prod-gated actions. |
| **BDE** [name] | Brand acquisition; walks brands through `/brand-onboarding` (self-serve bounds: 1–50 screens, 1–12 months — larger deals go through sales); quotes only the code-defined ladder (`brand-pricing.ts`: ₹999/₹899/₹799/₹699 online per screen-month + 18% GST); collects creatives; relays coupon requests to Technology (coupons are DB rows in Admin → Coupons, never hardcoded). | Brand onboarding funnel; Campaigns tab (read); Reports tab (read, for advertiser PoP evidence). | Quote off-ladder prices or invent discounts; mark a campaign `active` (only the Razorpay signature-verified `verify-payment` route may set `active`); promise slot positions or clock times not backed by Slot inventory availability; touch Screens/Content/Programming tabs. |
| **Store Partner** | Keeps the screen powered and on Wi-Fi during store hours; performs the power-cycle when asked (resolves the large majority of dark-screen cases within minutes); responds to ALIVE WhatsApp messages; uses the partner dashboard/app for earnings, flyers and VoiceBill billing; displays no competing screen — ALIVE has exclusivity within 200 m of the store. | Partner dashboard (`/store-dashboard`) or Expo store app; the physical plug and router. | Unplug or switch off the screen during agreed hours; change Wi-Fi credentials without informing ALIVE; factory reset, uninstall, or let anyone "fix" the TV software; use the remote to exit playback (the service hatches are for ALIVE staff). |

### 2.2 Hard access rules

1. **Only Technology deletes.** Deleting a device or store sends a decommission (wipe) to real hardware and cascades data. There is no undo.
2. **Only Technology releases.** A push to Player `main` OTAs the fleet; a push to Studio `main` deploys production. No one else pushes to either `main`.
3. **`ADMIN_PASSWORD` is a shared secret with individual accountability**: it is issued verbally by Technology, never written into chat, and rotated when any holder leaves. Known limitation: the admin API currently fails **open** if `ADMIN_PASSWORD` is unset in an environment (risk #5 in `ARCHITECTURE.md`) — Technology verifies the env var on every new deployment target.
4. **Photo gates are not bureaucracy.** The 409 errors in §3 exist because stage advancement drives partner payment eligibility. Nobody bypasses them by editing the database.

---

## 3. Store Partner Onboarding SOP

### 3.1 The pipeline at a glance

A store moves through five stages on `Store.onboardingStage`. The admin console (Admin → **Stores** tab) is where stages are advanced; the server (`/api/admin/stores/[id]`) enforces two GPS-photo gates and will answer **HTTP 409** with an explanatory error if you try to advance without the evidence. Gates fire only on **forward** crossings — re-saving the current stage, demoting, `rejected`, and stores that predate the photo feature are unaffected.

| Stage | Entry criteria | Gate to exit (server-enforced) | Who advances | Where |
|---|---|---|---|---|
| `new` | Registration submitted (web `/store` or Expo store app); `agreedAt` timestamp saved; referral code generated | **GPS shop-front photo** uploaded (`shopPhotoUrl`). Without it the server refuses with 409: *"Cannot advance stage: the partner has not uploaded the GPS shop-front photo yet (required for Team verification)."* Ops must also visually verify the photo coordinates against the registered map pin. | Operations Executive | Admin → Stores → store row → stage selector |
| `contacted` | Shop photo verified; first contact made; site visit scheduled | **GPS installed-TV photo** uploaded (`installPhotoUrl`). Without it: 409 *"Cannot advance stage: the GPS photo of the installed TV has not been uploaded yet (required for Site visit & install)."* | Operations Executive (after Field Executive confirms install) | Admin → Stores |
| `physically_onboarded` | TV mounted, powered, on Wi-Fi; device claimed and pairing confirmed in Admin → Screens; install photo on file | KYC submitted and approved; payout method captured; partner can log in to the dashboard/app | Operations Executive | Admin → Stores |
| `digitally_onboarded` | `kycStatus = approved`; `payoutStatus = ready`; partner logged in at least once | Screen verifiably playing (PlayEvents visible in Reports); admin sets `liveAt` | Operations Executive, countersigned by Technology for the first screens | Admin → Stores (stage + `liveAt` field) |
| `live` | `liveAt` set — **earning clock running** | — (exit is decommission or `rejected`, both Technology-only) | — | — |

### 3.2 Registration

Two ways in — both create the same `Store` row at stage `new`:

- **Web:** `https://wearealive.in/store` on the partner's own phone (preferred — the session lands on their device).
- **Expo store app**, where already distributed.

**Step 1 — details.** Store name, owner name, WhatsApp number (this becomes the login username), password (minimum 6 characters), GSTIN (optional), map pin on the Leaflet map (locality/pincode/city autofill via Nominatim — drag the pin to the actual shopfront, this pin is what the GPS photo is checked against), and referral code if another partner referred them. The draft persists in `sessionStorage` (`alive_store_draft`), so opening the agreement page and coming back does not lose the form.

**Step 2 — agreement and consent.** The partner sees the full VS Collective LLP agreement (`/store-agreement`) with the party block prefilled (name, owner, address, phone, GSTIN if given). They tick **"I agree"** and submit. Submission saves the consent timestamp to `agreedAt` and generates the store's unique **referral code**. There is no paper-only path: no `agreedAt`, no store.

Key business terms the Field Executive must be able to state from memory (they are in the agreement):

- ₹500/month fixed remuneration per screen (clause 3.3), **₹1000/month for premium partners**
- Electricity reimbursed separately
- 1 screen per store
- ₹500 referral reward per new partner who signs up with their code
- Payout within 10 working days of month end
- ALIVE exclusivity within 200 m of the partner store

### 3.3 Referral code

Every store gets a unique `referralCode` at registration. It does three jobs: (1) new partners enter it in Step 1 to credit the referrer ₹500; (2) it is printed on the partner sticker; (3) at screen provisioning, passing `storeReferralCode` in the device claim auto-links the new screen to that store — so field staff should have the code on hand at install time.

### 3.4 Premium vs standard tier

- **Standard** signup (plain `/store`): `tier = standard`, `monthlyCompensationPaise = 50000` (₹500/month).
- **Premium** signup happens **only** through the gated link `/store?premium=<key>`. The key is the server-side `PREMIUM_SIGNUP_KEY` secret, validated by `GET /api/stores/premium-validate?key=…` before the UI even offers premium terms; the server re-validates on submit. A valid key sets `tier = premium` and `monthlyCompensationPaise` from `PREMIUM_MONTHLY_PAISE` (default 100000 = **₹1000/month**), and the agreement text the partner consents to shows the premium amount.
- The gated link is issued by Technology to the Operations Executive per named prospect. Field staff and BDEs cannot grant premium by any other means — a partner promised ₹1000 verbally but registered on the plain link is a standard partner in the system, and that discrepancy is a complaint waiting to happen.

### 3.5 GPS shop-front photo (gate out of `new`)

1. On the first visit (or guided remotely), the partner or Field Executive uploads a photo of the shopfront from the partner dashboard. The upload is `POST /api/stores/verification-photo` with FormData: `file` (JPEG/PNG/WebP, max 4 MB — the client downscales larger), `kind=shop`, `lat`/`lng` in decimal degrees, and `source` = `exif` (coordinates from the photo's EXIF GPS tags) or `device` (phone geolocation at upload time). Coordinates of exactly 0,0 or missing location are rejected — enable location services first.
2. The photo, its coordinates and `shopPhotoAt` timestamp appear in the admin panel **next to the registered map pin**. The Operations Executive checks they match — a photo taken kilometres from the pin means either the pin or the visit is wrong; resolve before advancing.
3. Only then set the stage to `contacted`.

> **Known limitation:** the Expo mobile app does not yet have the photo-upload UI — use the partner web dashboard in the phone's browser for both GPS photos.

### 3.6 Site-visit scheduling

Scheduling is manual (WhatsApp/phone) — there is no scheduler in the system. On first contact after registration:

1. Confirm the shop photo is on file (or plan to take it at the visit — it must be uploaded and verified before the stage leaves `new`).
2. Agree a 60–90 minute install window when the owner (not just staff) is present — the KYC selfie and payout details need the owner.
3. Send the document checklist (§3.12) on WhatsApp the day before.
4. Field Executive carries: the TV and mount, the provisioning QR (Device Owner enrollment per `ALIVE-Player/PROVISIONING.md` — factory-reset first, enroll before any account is added), the store's referral code, and a printed agreement copy for the partner's records.

### 3.7 GPS install photo (gate out of `contacted`)

After mounting, powering and pairing the screen (installation and pairing procedure is covered in the installation section of this SOP; summary: first boot shows a 6-character pairing code, Ops confirms it in Admin → Screens):

1. Take a photo of the **installed, powered-on TV showing content**, upload via the same route with `kind=install`. Same GPS rules apply (`installPhotoUrl`, `installPhotoLat/Lng`, `installPhotoAt`, `source`).
2. The server refuses to advance the stage to `physically_onboarded` (or beyond) without it — 409, message quoted in §3.1.
3. Ops verifies coordinates against the pin, then sets `physically_onboarded`.

### 3.8 KYC collection and review

Collected at the install visit (owner present). Stored on the `Store` row; document images go through the server-side upload proxy (`POST /api/admin/r2-upload` — phone photos are well under the ~4.5 MB Vercel body cap).

| Item | Field | Notes |
|---|---|---|
| PAN card photo | `kycPanUrl` | Owner's PAN |
| Aadhaar card photo | `kycAadhaarUrl` | Mask/record only last 4 digits in `kycAadhaarLast4` |
| Live selfie | `kycSelfieUrl` | Taken at the visit, not a gallery photo |

Lifecycle on `kycStatus`: `not_started` → `submitted` (sets `kycSubmittedAt`) → Ops reviews in Admin → Stores → `approved` (sets `kycVerifiedAt`) or `rejected` (write the reason in `kycRejectedReason` and tell the partner what to re-submit). KYC documents are payout-compliance PII: never forward them over personal WhatsApp; they live in R2 and the admin panel only.

### 3.9 Payout setup

Capture one payout method on the store row (`payoutMethod`):

- **UPI**: `upiId` — verify by sending ₹1 or scanning the partner's own QR; a typo here is a failed payout cycle.
- **Bank**: `bankAccountName`, `bankAccountNo`, `bankIfsc`, `bankName` — account name must match the KYC name; mismatches go to Ops before approval.

Set `payoutStatus` from `pending_setup` to `ready`. Monthly remuneration is driven from the admin Payouts tooling — one `StorePayment` row per store per month (`YYYY-MM`), paid by UPI QR or the bulk bank CSV export, within 10 working days of month end. `on_hold` exists for disputes; only Ops sets it, and always with a `payoutNotes` entry saying why.

### 3.10 Marking live — the earning clock

Before setting stage `live`:

1. Confirm the screen is actually playing: `PlayEvent` rows for the device visible in Admin → Reports within a few minutes of playback. (Per the field-trial runbook: content confirmed playing but no PlayEvents after 10+ minutes is a **P0** — proof-of-play is the grant deliverable.)
2. Confirm `kycStatus = approved` and `payoutStatus = ready`.
3. In Admin → Stores set stage `live` **and set `liveAt`**. Remuneration accrues from `liveAt`, pro-rated — not from the install date, not from registration. Tell the partner their start date explicitly so expectations match the first payout.

### 3.11 Per-visit conversation script (first contact)

**Opening (30 seconds):** "Namaskara. We're ALIVE — we put a free TV screen in kirana stores in Mangaluru that plays offers and ads. You don't pay anything. We pay **you** ₹500 every month for the wall space" *(₹1000 only if this prospect has a premium gated link — never promise it otherwise)*, "we reimburse the electricity separately, and you also get our free tools — a billing app (VoiceBill) and offer flyers for your own store. The screen shows your own offers too, between the ads."

**The three commitments we ask for:** wall space for one screen, a power point, and your Wi-Fi. That's it. One screen per store, and we don't put screens in competing shops within 200 metres of yours.

**Objection handling:**

| Objection | Response |
|---|---|
| "The power bill will go up." | "Electricity is reimbursed separately on top of the ₹500 — it's in clause 3.3 of the agreement you'll see before signing. The panel draws less than a ceiling fan." |
| "I don't have wall space." | "It mounts in portrait — it needs about the width of a calendar. Show me the counter area and I'll point at two spots that work. The install photo we take is GPS-verified, so we only mount where it genuinely fits and is visible." |
| "What's the catch?" | "The agreement is two pages and you read it on your own phone before agreeing — nothing is signed on paper you can't keep. Brands pay us to show ads; we share that with you as fixed rent. If you ever want out, the screen is ours and we remove it. Your only obligations are power, Wi-Fi, and not switching it off during store hours." |
| "Wi-Fi is slow / metered." | "The screen downloads content once and plays from its own storage — after setup it sips data. If it ever loses internet it keeps playing what it has." |
| "Pay me more." | "₹500 is fixed for every standard store — it's in the agreement, same for everyone, plus ₹500 for every store you refer that signs up. Refer two neighbours and you've doubled it." |

**Close:** register on the spot on the partner's own phone at `wearealive.in/store` — the form takes 5 minutes, the map pin and the agreement happen right there, and you leave with the visit scheduled and the shop-front photo already uploaded.

### 3.12 Document checklist (per partner file)

| # | Item | Where it lives | Required before |
|---|---|---|---|
| 1 | Agreement consent (`agreedAt` timestamp) | `Store` row — captured at registration Step 2 | Store exists at all |
| 2 | GSTIN (only if the store has one) | `Store.gstin` | Optional, capture at registration |
| 3 | GPS shop-front photo (+ coordinates, timestamp) | `shopPhotoUrl` / `shopPhotoAt` | Leaving `new` |
| 4 | GPS installed-TV photo (+ coordinates, timestamp) | `installPhotoUrl` / `installPhotoAt` | Leaving `contacted` |
| 5 | PAN card photo | `kycPanUrl` | `digitally_onboarded` |
| 6 | Aadhaar card photo + last-4 | `kycAadhaarUrl`, `kycAadhaarLast4` | `digitally_onboarded` |
| 7 | Live selfie | `kycSelfieUrl` | `digitally_onboarded` |
| 8 | Payout details (UPI id, or bank name/account/IFSC/holder) | `payoutMethod` + fields | `payoutStatus = ready`, before `live` |
| 9 | Referral code noted on partner sticker | Printed sticker at the counter | Handover at install visit |
| 10 | `liveAt` set and communicated to partner | `Store.liveAt` | First payout cycle |


---

## 4. Hardware & Site Preparation

### 4.1 Panel selection by SoC

Before purchasing or deploying a batch of panels, identify the SoC (Settings → About, or `adb shell getprop ro.board.platform`). The fleet has already burned time on three broken vendor decoder families — do not repeat those diagnoses in the field. Use this table.

| Panel / SoC | Seen on | Known fault | Player handling | Verdict |
|---|---|---|---|---|
| HiSilicon Hi3751V350 | Foxsky, KTC | Hardware AVC (H.264) decoder accepts input but never drains output — permanent blank screen with **no error raised** | Decoder blocklisted by exact name; player downloads and plays the server's HEVC rendition (`hevcUrl`) instead | **Supported** with the standard fleet APK (blocklist + HEVC-preference shipped on `main`) |
| Realtek SPPL_2K_RT41 "Kodak" | Kodak-branded panels | OMX AVC decoder (`OMX.realtek.video.decoder`) fails at init (`setPortMode` failure). Also `setRequestedOrientation` throws on OEM non-fullscreen windows | Decoder blocklisted → software decode; orientation applied in software and the throwing call is swallowed | **Supported** with the standard fleet APK |
| Realtek rtd2841a "D5STV" (Android 14) | AH Store 4th TV | Codec2 HEVC decoder (`c2.realtek.video.hevc.decoder`) starts, then dies with `CodecException 0xe` on the first buffers of every clip — a runtime error, so Media3 never falls back and the screen black-screens in a retry loop | Blocklist entry forces software HEVC decode — verified smooth on ~220 kbps portrait content | **Supported ONLY with the per-panel APK lineage**: `apk-releases/by-tv/alive-player-realtek-d5stv.apk` (versionCode 999530) or any ≥999541 build — the c2 blocklist shipped in 999541; current fleet build is 999560 |
| Foxsky / Google TV (incl. ASAANO) | 4K Foxsky units | OEM launcher re-enables itself on every boot; lock task is not resumed after reboot | Player relaunches itself after boot; brief OEM launcher flash is accepted | **Supported.** Accept the boot flash. Device Owner enrollment (§6.1) strongly recommended — it buys auto-launch and silent OTA |
| Generic Android TV 9–14 | — | None known | Standard fleet APK (minSdk 26) | **OK** — preferred for new purchases |

> **Known limitation:** the Realtek Codec2 blocklist, cache-prune, and frozen-glass watchdog fixes live on PR #57 (`fix/field-freeze-and-cache-hygiene`) and in the 999560 fleet build — **not on plain `main`**. Until PR #57 merges, any APK cut from `main` is a regression for D5STV panels. When in doubt, install from `apk-releases/` (see `apk-releases/README.md` for the exact lineage per build), not from a fresh CI build.

Buying rule: when trialing a new budget panel model, test one unit with real portrait video content for a full day before committing to a batch. Vendor decoder incompatibility is the failure category that keeps adding new cases (`ALIVE-Player/docs/instability-audit.md`, Category 4).

### 4.2 Site survey checklist

Complete this at the shop-photo visit (the same visit that captures the GPS shop-front photo required to move the store past `new`). All four must pass before scheduling the install.

| # | Check | Pass criteria |
|---|---|---|
| 1 | Power socket | Working 3-pin socket within **1.5 m** of the mount point. No extension boards daisy-chained across a walkway. |
| 2 | Wall strength | Solid masonry or a stud that holds the mount bracket with no flex. No plyboard partitions, no glass. |
| 3 | Sightline | Screen face visible from the store entrance and the billing counter. Not blocked by racks, fridges, or hanging stock. |
| 4 | Ambient light | No direct sunlight or spotlight washing out the panel during business hours. Check at survey time and ask the owner about afternoon sun. |

Record failures on the store record; a failed survey means "pick another wall," not "install anyway."

### 4.3 Network requirements

The screen is only as alive as its network. Verify all of these **on the store's actual Wi-Fi with a phone before mounting anything**.

| Requirement | Detail |
|---|---|
| Outbound HTTPS (TCP/443) | MUST reach `wearealive.in` (device API), `media.wearealive.in` (OTA APKs), and `*.r2.dev` / the R2 media host (content downloads). If the router blocks any of these, the screen cannot pair, fetch plans, or download creatives. |
| No captive portal | Hotel/ISP login pages break every background call. If the Wi-Fi shows a login page on a phone, it is not usable — get the ISP to whitelist the device MAC or use a different network. |
| No MITM / TLS-intercepting proxy Wi-Fi | TLS interception breaks the player completely — every HTTPS call fails certificate validation. The player's network diagnosis will report this as "router is blocking wearealive.in." |
| NTP (UDP/123) | Preferred. The player syncs its clock **before** the first HTTPS call (a drifted clock fails TLS, so a post-success sync would never run on the devices that need it). Where UDP/123 is blocked, it falls back to the HTTP `Date` header; on Device Owner units it corrects the system clock. |

> **Known limitation:** one deployed HiSilicon unit still sits on a TLS-intercepting (MITM) Wi-Fi network. The player keeps running on cache but cannot be reliably updated or serviced over that network. This is a network to be replaced at the next site visit, not a player bug to debug. Do not accept MITM/proxy Wi-Fi at any new site.

If the player shows a network error, read it — it distinguishes "router is blocking wearealive.in" from "device date/time is wrong." Fix the one it names.

### 4.4 Anti-sleep provisioning — MANDATORY per install

On 2026-08-19 a fleet-wide incident was found where displays were **Asleep while the player kept recording proof-of-play every ~10 seconds** — plays billed against dark glass. Root cause: units shipped without anti-sleep provisioning. The player holds `FLAG_KEEP_SCREEN_ON` and a partial wake lock, but **panel-level OEM timers override the app**. Every install must therefore complete this sweep, and it is a line item on the §5 checklist and the sign-off block:

1. **Screensaver / Daydream → OFF** (Settings → Device Preferences → Screen saver → set to Never / None).
2. **Sleep / idle display timeout → Never.**
3. **HDMI-CEC auto power-off → OFF** (OEM names vary: "CEC", "T-Link", "Anyview Cast control", "HDMI control"). CEC lets another HDMI device or the panel's own standby logic power the display down while Android keeps running.
4. **Any "no signal / idle auto power off" or "4-hour auto off" eco timer → OFF** (common on TV panels, buried under Power/Eco settings).
5. Confirm: leave the screen untouched for 5 minutes at the end of the install — display must still be lit and playing.

An install that skips this sweep is an incomplete install. There is no remote fix; it costs a repeat site visit.

### 4.5 Portrait orientation

- Panels are mounted **physically rotated 90°** (portrait). The panel's own OSD/firmware rotation is never used.
- The **software** rotates content: set the device's orientation in the admin Screens tab to `PORTRAIT` or `PORTRAIT_FLIPPED`, depending on which way the panel was rotated at mounting (cable exit up vs down).
- If content renders upside-down after pairing, do not remount the panel — switch between `PORTRAIT` and `PORTRAIT_FLIPPED` in admin and let the next plan fetch apply it. (Reference: the AH Store D5STV runs `PORTRAIT_FLIPPED`, verified live 2026-08-19.)
- On Kodak/Realtek panels the Android orientation API throws; the player already applies rotation in software — nothing extra to do on site.

---

## 5. Installation Checklist

### 5.1 The ≤25-minute install

Target: **box to playing-and-verified in 25 minutes on site.** Pre-provisioned Device Owner units (§6.1) are the reason this target is achievable — provision at the office, not in the shop. If you blow the budget, the overrun is almost always network (§4.3): fix the network, don't stretch the visit.

| # | Step | Min | Pass check |
|---|---|---|---|
| 1 | Unbox + mount on the surveyed wall (§4.2); note cable-exit direction for orientation | 5 | Panel solid on bracket, no flex |
| 2 | Power on + join store Wi-Fi; confirm no captive portal | 3 | Network connected, internet reachable |
| 3 | APK: pre-provisioned unit boots straight into the player (preferred); otherwise sideload the correct lineage per §4.1 / §6.2 | 3 | Player launches |
| 4 | Auto-claim runs (`POST /api/device/claim` with the panel's `ANDROID_ID`); 6-character pairing code + QR appear on screen | 1 | Code visible; player polls pairing status every 5 s |
| 5 | Admin confirms the code at `/admin/pair?code=XXXXXX` (scan the on-screen QR). **This opens the install wizard, which carries you through steps 6, 7 and 11–12 below** | 1 | Screen leaves the pairing view |
| 6 | Link the device to the store and name it (convention: `<Store> - <Position>`, e.g. "Sharma Kirana - Counter") | 1 | Device shows under the store in Screens tab |
| 7 | Set orientation: `PORTRAIT` or `PORTRAIT_FLIPPED` (§4.5) | 1 | Content right-way-up |
| 8 | Assign a playlist via a Schedule, or enable the store's slot loop. First plan fetch happens immediately after pairing — no waiting on the poll interval | 2 | Diagnose panel shows the intended plan |
| 9 | Verify first frame renders + kiosk lock active: content playing; BACK/HOME presses are swallowed | 3 | Video/image on glass, remote can't escape |
| 10 | Anti-sleep settings sweep (§4.4, all 4 settings) | 2 | All four confirmed OFF/Never |
| 11 | Record the install in the wizard: **TV** (serial, company, model, size, ALIVE tag) · **network** (SSID, security type, password, and username on PPPoE/portal sites) · **smart plug ID**; then take the three **GPS photos** — installed TV playing, serial plate, plug in socket | 3 | Every field green in the wizard; 3 of 3 photos uploaded |
| 12 | Tap **Save & finish install**. The wizard writes the record and advances the stage to `physically_onboarded` | 1 | "Install recorded" screen; `live` + `liveAt` are set later by Ops once KYC and payout clear (§3.10) |
| | **Total** | **25** | |

Step-12 gate, by design: the admin API **refuses** to advance a store past `contacted` (into `physically_onboarded` or beyond) until the whole install record is present — every field listed in step 11 plus the installed-TV, serial-plate and smart-plug photos. It answers 409 with the exact list of what is still missing, which the wizard shows as a checklist with a jump-back link per item. Likewise a store cannot leave `new` without the GPS shop-front photo. Do not ask [Ops Lead — name] to bypass this; this record is the field evidence trail, and nobody can read a serial or a Wi-Fi password off the router remotely afterwards.

Read the serial and model off the back-panel plate **before** you tidy the cable, and the plug ID **before** you push the plug into the socket — both become unreachable once mounted, and that is the single most common reason an install runs over.

Revisits and panel swaps: a screen that is already paired shows no code. Open `/admin/pair` without a code and pick the screen from the fleet list. A store already at `physically_onboarded` or beyond keeps its stage — the wizard never moves a store backwards. You can also fill any field or upload any of the four photos later from Admin → Kirana partners → Edit.

Before leaving site: proof-of-play (`PlayEvent`) rows must appear for the device in the Reports tab within a few minutes of playback. **If nothing appears after 10+ minutes of confirmed playback, treat it as P0** — proof-of-play is the grant deliverable (see the field-trial runbook). Call [Ops Lead — name] before leaving, not after.

### 5.2 Install sign-off (print, fill, tear off, file)

```
──────────────────────────────────────────────────────────────────────
ALIVE SCREEN INSTALLATION SIGN-OFF            VS Collective LLP
──────────────────────────────────────────────────────────────────────
Store name        : _______________________________________________
Device ID         : _______________________________________________
Device name (admin): ______________________________________________
APK version       : _____________   Orientation: PORTRAIT / FLIPPED
Pairing code used : _______

TV serial (plate) : _______________________________________________
TV company / model: ______________________  Size: ______ inches
ALIVE TV number   : _______
Wi-Fi SSID        : _______________________________________________
Wi-Fi security    : WPA / PPPoE / PORTAL / OPEN
Wi-Fi username    : ______________________  (PPPoE / portal only)
Smart plug ID     : _______________________________________________

  [ ] Kiosk lock verified (BACK/HOME swallowed)
  [ ] Anti-sleep sweep complete (screensaver / sleep / CEC / eco timer)
  [ ] GPS photos uploaded: installed TV / serial plate / smart plug
  [ ] PlayEvents visible in Reports tab
  [ ] Stage set to LIVE in admin

Date              : ____ / ____ / ________
Time in           : ________        Time out : ________

Field executive   : _____________________  Signature: ______________
Store partner     : _____________________  Signature: ______________
──────────────────────────────────────────────────────────────────────
```

---

## 6. Device Provisioning SOP

### 6.1 Preferred: Device Owner zero-touch (QR at first-boot setup)

Device Owner status is the difference between a screen that maintains itself and one that needs an operator. It unlocks:

| Capability | Without Device Owner |
|---|---|
| Silent OTA installs (API 31+, no confirm dialog) | Operator must accept an install dialog per update |
| Silent remote reboot | Physical power-cycle only |
| Persistent HOME claim — OS relaunches the player after any crash/boot, immune to OEM autostart/battery kills | HOME interception unreliable |
| `startLockTask()` kiosk | Softer kiosk (key-swallowing only) |

**This is a factory-reset operation.** Enroll new devices at first setup, before any account or app is added. Already-deployed units keep working without it — re-provision them during routine maintenance visits, not as an emergency rollout (`ALIVE-Player/PROVISIONING.md`).

Procedure (full detail in `ALIVE-Player/PROVISIONING.md`):

1. **Generate the checksum** — base64url SHA-256 of the signed APK file itself (NOT the keystore cert, NOT a hex digest):
   ```bash
   openssl dgst -binary -sha256 alive-player-release.apk | openssl base64 | tr '+/' '-_' | tr -d '='
   ```
2. **Build the QR payload** (JSON): admin component `com.alive.player/com.alive.player.admin.AliveDeviceAdminReceiver`, download location `https://media.wearealive.in/releases/alive-player-release.apk`, the checksum from step 1, `PROVISIONING_SKIP_ENCRYPTION: true`, locale `en_IN`, and optionally the store's Wi-Fi SSID/password so the unit self-connects. Render with any QR generator (`qrencode -o setup.png "$(cat payload.json)"`).
3. **Enroll**: factory reset → on the Android TV "Welcome" screen, tap the same spot **6 times** to enter QR provisioning mode → connect Wi-Fi (or let the QR payload fill it) → scan the QR. Fire TV / no-camera devices don't expose the QR UI — instead:
   ```bash
   adb install alive-player-release.apk
   adb shell dpm set-device-owner com.alive.player/.admin.AliveDeviceAdminReceiver
   ```
   (only succeeds on a device with no accounts/apps configured — same factory-reset requirement).
4. **Verify**: `adb shell dpm list-owners` must show `Device Owner: ComponentInfo{com.alive.player/com.alive.player.admin.AliveDeviceAdminReceiver}`; in-app, the diagnostics overlay must show "Device Owner: yes". The player launches automatically post-provisioning and silently claims HOME.

Note for later servicing: a Device Owner app **cannot be force-stopped externally** — `adb force-stop`, `pm clear`, and `am crash` are all silently ignored. Recovery is in-app (watchdogs) or a power-cycle.

### 6.2 Fallback: non-owner sideload

Use only when a factory reset is not possible (panel already in service, partner can't afford downtime). Install with `adb install -r <apk>`, choosing the lineage from `apk-releases/README.md` — the current fleet build is `apk-releases/alive-player-999560.apk`; Realtek D5STV panels take `apk-releases/by-tv/alive-player-realtek-d5stv.apk`.

What you lose, and must plan around:

| Loss | Field consequence |
|---|---|
| No silent install | Every OTA shows Android's install-confirm dialog; someone with the remote must accept it. Budget a phone call to the store per player release. |
| Boot flash | Brief OEM launcher flash on every boot before the player relaunches. Cosmetic; accepted. |
| HOME interception unreliable | OEM launchers can re-assert HOME; the player survives on its boot receiver and watchdogs instead. |

During pairing the app prompts for a **battery-optimization exemption** and, on aggressive OEMs, the **autostart settings screen**. Do NOT dismiss these — a box installed non-owner where staff dismissed the autostart prompt survives only until the OEM task killer runs (instability audit, Category 2: the leading residual cause of dead screens).

> **Known limitation — signing lineages.** Two APK signing lineages exist: the CI keystore and the local debug keystore used for the machine-built `999xxx` series. They are **not cross-installable**: crossing lineages forces an uninstall, which loses pairing and changes the `hardwareKey`, leaving an orphaned device row in admin. Check which lineage a unit runs before sideloading. The `999xxx` builds are also deliberately numbered above the OTA pin (e.g. 999541 sits above the 999540 pin) so a pinned OTA cannot clobber a sideloaded fix — do not "tidy" version numbers.

### 6.3 Servicing a kiosk-locked screen

All servicing entry points work from the standard remote — no adb needed on site:

| Gesture | Timing window | Result |
|---|---|---|
| **MENU** | single deliberate press | Opens the Settings/diagnostics screen directly (not gated by the kiosk key lock — MENU can't be bumped accidentally) |
| **Select ×3** | within 2 s | Opens Settings |
| **BACK ×5** | within 3 s | Exits kiosk mode; an on-screen toast counts down from press 3 so accidental bumps warn before anything happens |
| **Long-press + PIN** | PIN = last 4 characters of the Device ID | Opens the diagnostics overlay (device ID, version, Device Owner status, last plan fetch) |

Restoring kiosk requires no cleanup: **reopening the app or rebooting the panel restores the kiosk lock.** From Settings, BACK returns straight to playback — `PlaybackActivity` is never finished underneath.

### 6.4 In-app Wi-Fi / system-settings buttons

The player's Settings screen (MENU → Settings) includes direct **Wi-Fi** and **Android system settings** buttons, added specifically for servicing (present since APK 999310). Use these to fix a changed Wi-Fi password or re-join a network on Google TV units without exiting kiosk mode or hunting for the OEM launcher.

> **Known limitation:** on some Google TV OEM builds the lock task is **not resumed across a reboot** — the screen boots with a brief launcher flash, then the player relaunches and re-locks. This is accepted behavior; do not raise it as a defect.

> **Known limitation:** Android 15 forbids `BOOT_COMPLETED` from starting the media foreground service directly. The player handles this internally — expect a **few seconds' delay** between boot and first frame on Android 15 panels. No action needed.

---

## 7. Content & Campaign Operations SOP

This section covers everything between "the brand sent us a file" and "the screen is provably playing it." Owner: [Content Ops — name]. Escalation: [Ops Lead — name].

### 7.1 Creative specs

Give this table to every brand and every designer before they send a file. Reject non-conforming files at intake — fixing them later costs a transcode cycle and a fleet re-download.

| Property | Requirement |
|---|---|
| Orientation | **Portrait.** All screens are Android TV panels mounted in portrait. |
| Resolution | **1080 × 1920 preferred** (any resolution is accepted — the pipeline downscales to ≤1080p, but starting at 1080×1920 avoids quality loss and wasted upload time on 4K masters) |
| Slot creative duration | **Exactly 10 seconds.** The slot loop is fixed 10 s positions (`SLOT_DURATION_MS = 10_000` in `src/lib/slots.ts`). A longer video gets cut off or breaks loop math; do not accept it. |
| Video format | Any common container/codec — the pipeline re-encodes everything to **H.264 Main@4.1, yuv420p, ≤1080p30 + AAC** (see §7.2). Don't promise brands their original bitrate survives. |
| Images | JPG/PNG. Display duration is set per playlist item in the playlist editor (images don't need transcoding). |
| File size | **≤ 100 MB per upload** (browser-direct upload limit, §7.2). Larger masters: ask the brand to export a 1080p version. |

### 7.2 Upload flow and the transcode pipeline

1. Admin (`/admin`) → **Content** tab → upload. The browser requests a presigned URL from `GET /api/admin/r2-upload?key=&type=` and PUTs the file **directly to Cloudflare R2** — up to 100 MB. (It cannot go through the server: Vercel caps any function's request body at ~4.5 MB on every plan. If an upload fails immediately, suspect R2 CORS — see `studio/docs/R2_CORS.md`.)
2. For videos, an async **AWS Lambda (ffmpeg, ap-south-1)** transcodes to **H.264 Main@4.1, yuv420p, ≤1080p30 + AAC** — budget panel SoCs reject High@5.0 even when ExoPlayer claims support — plus a **best-effort HEVC rendition** for panels with broken H.264 decoders. The Lambda callback updates the `Content` row (`objectKey`, `md5`, dimensions, `transcodeStatus`).
3. `Content.transcodeStatus` is `null | 'pending' | 'done' | 'error'`:

| Badge / status | Meaning | Your action |
|---|---|---|
| **transcoding…** (`pending`) | Lambda is running or queued | Wait. Do not schedule to sensitive panels yet (rule below). If stuck >30 min, treat as `error`. |
| `done` | Fleet-safe H.264 (and usually HEVC) renditions exist | Safe to schedule anywhere. |
| `error` | Lambda failed (bad source file, Lambda misconfigured/undeployed) | Run the operator fallback below. |

**Operator fallback — `studio/local-transcode.mjs`.** Does exactly what the Lambda does, on your machine, and leaves the `Content` row in the identical end state (`transcodeStatus='done'`, new objectKey/md5/HEVC rendition). Requirements: ffmpeg + ffprobe on PATH built with **libx264 and libx265**; run from `studio/`; real R2 + `DATABASE_URL` creds in `.env.production.local`.

```
node local-transcode.mjs <contentId> [<contentId> ...]   # specific rows
node local-transcode.mjs --playlist "name contains"      # every video in a playlist
node local-transcode.mjs --all-pending                   # every video with transcodeStatus != 'done'
node local-transcode.mjs --playlist "x" --dry-run        # list targets, encode nothing
```

It mutates production content and R2, but writes a **new** object key — a device mid-download is unaffected and rollback is restoring the old objectKey/md5.

> **Hard rule: NEVER schedule a raw 4K or H.265 upload to a Realtek or HiSilicon panel before transcode completes.** These SoCs have broken hardware decoders handled by an exact-name blocklist (HiSilicon Hi3751V350 AVC never drains output — permanent blank with no error; Realtek OMX fails init; Realtek Codec2 HEVC dies at runtime with `CodecException 0xe`). A raw upload bypasses the renditions the blocklist logic depends on, and the failure mode is a silent black screen in a live store. Wait for `done`, then schedule.

Content updates propagate by hash: a re-transcode produces a new objectKey + md5, so cached devices detect the change on their next plan fetch like any other edit — no manual cache clearing.

### 7.3 Playlists vs Schedules vs Slot loop — which tool for which job

| You are placing… | Use | Where in admin | Why |
|---|---|---|---|
| House content, store offers, fillers, anything not individually sold | **Playlist + Schedule** | Content → Programming | Ordered list with per-item durations, targeted by schedule. Default playback model. |
| **Sold ad inventory** (a brand paid for plays) | **Slot loop + SlotBooking** | Slot inventory tab | Only slot mode produces per-position, guaranteed-vs-bonus billing evidence (§7.5). Never sell inventory as a playlist item — there is no availability accounting there. |
| Multi-zone screen (main video + side/bottom zone) | **Composition** | Compositions tab | Compositions define zone layouts; playlists/schedules fill the zones. |
| Ticker / banner strip over content | **Overlay** | Programming | Rendered on top of whatever plays; supports its own dayparting. |

Playlists may nest playlists to **max depth 3**; cycles are rejected at write time. A nested playlist plays **all** its items per visit, depth-first — the device receives the fully flattened order, so nesting is an authoring convenience, not a playback risk.

### 7.4 Scheduling

**Targeting** — a Schedule targets any of: explicit `deviceIds`, a `groupName`, `storeIds`, or a `cityFilter`. Prefer store/group targeting; device-id targeting breaks silently when hardware is swapped.

**Conflict rule** — when schedule windows overlap on the same screen: **higher `priority` wins; on a tie, the earlier `startAt` wins.** Contiguous windows of the same schedule merge. Convention: keep house content at priority 0 and use higher numbers only for deliberate takeovers, so a takeover is always an explicit act.

**Dayparting** — `dailyStart`/`dailyEnd` (`HH:mm`) restricts a schedule within its date range; `recurrence` is `once | daily | weekly`. The device gets a 72-hour rolling window from `/api/device/plan` and switches playlists at item boundaries, never mid-play.

**The replace-confirmation dialog — never bypass it.** Before saving, the Schedules tab calls `POST /api/schedules/conflicts`, which returns every existing schedule whose window overlaps AND whose resolved screens intersect yours. The UI then asks "replace the old playlist?". This exists because of a production incident where a new schedule left screens playing nothing. Rules:

1. Read the list. Every schedule named in it will be **deleted** if you confirm.
2. Confirm only if replacement is intended. Confirmed ids go to `POST /api/schedules` as `replaceScheduleIds` and are deleted **in the same transaction** that creates the new schedule — a failed create deletes nothing, so a screen can never end up with neither playlist.
3. If you did not expect a conflict, cancel and check the Diagnose panel (§7.6) for that screen before proceeding. Do not "confirm to make the dialog go away."

### 7.5 Slot bookings (the ad product)

Inventory is sold as **(store, IST calendar date, loop position)** — never clock time. A store in slot mode runs a fixed loop of N × 10 s positions between its `hoursStart` and `hoursEnd` on its open days (defaults 09:00–21:00 if unset).

**Availability** = `loopSlotCount − COUNT(sold bookings)` for that store+date. Filler and bonus fills are **never** counted — a loop that is 100% filler still shows as 100% available to brands.

**Guaranteed vs bonus — how to explain it to an advertiser:**
- **Guaranteed plays**: your booked position plays once per loop cycle. Cycles per day = `floor(open seconds ÷ (loopSlotCount × 10 s))` — e.g. a 20-slot loop over 12 open hours = 216 guaranteed plays/day per booked position.
- **Bonus plays**: unsold positions are never left dark — they are redistributed **round-robin across the sold campaigns** as free extra plays, recorded with `isFiller=true` but attributed to your campaign. Early campaigns on a lightly sold store get far more total plays than they paid for. Bonus volume shrinks as the store sells out — never promise it, report it as upside. With **zero** sales the loop plays the house filler campaign; if nothing at all is playable, `/api/device/plan` falls back to schedule mode rather than serving a dark plan.
- Proof-of-play reporting splits the two: `isFiller=false` rows are the billable guarantee, `isFiller=true` rows are bonus.

**Assigning the creative (`slotContentId`)** — a booking plays the campaign's designated 10 s slot creative, set as `slotContentId` on the Campaign. **A booked campaign without a `slotContentId` cannot render**: it still counts as sold for availability, but its positions join the redistribution set — they play *other* campaigns' bonuses or house filler, and the paying brand gets **zero plays**. Therefore, checklist for every new booking:

1. Creative uploaded and `transcodeStatus = 'done'` (§7.2).
2. Creative is exactly 10 s, portrait.
3. `slotContentId` set on the campaign.
4. Verify via Diagnose (§7.6) that the loop shows the campaign at its booked positions with `isFiller=false`.

Shrinking a store's loop repacks bookings in one transaction and rejects a genuine oversell — if the shrink is refused, bookings must be moved first; never force it.

### 7.6 Propagation: how fast a change reaches a screen, and how to force it

| Path | Latency | When it applies |
|---|---|---|
| FCM `plan_updated` push | **Seconds** | Every schedule/playlist/content save pushes to affected devices |
| 15-minute plan poll | ≤ 15 min | Fallback when a push is missed (FCM is best-effort) |
| 60-second plan poll | ≤ 60 s | Devices with no FCM token (e.g. MStar panels that cold-boot with a dead clock — Firebase auth fails, no token that session); self-disables once a token appears |

Tools on the **Screens** tab, per device:

- **Force-sync** (`POST /api/devices/[id]/force-sync`) — sets `forceSyncAt`, which changes the plan hash **and** tells the player to purge its local content cache and re-download everything. Use when: content was replaced under the same id, a device is suspected of serving a stale/corrupt cached file, or after running `local-transcode.mjs`. Do not use it as a routine "refresh" — it forces a full re-download over the store's connection.
- **Test-play** (`POST /api/devices/[id]/test-play`) — pushes a 3-minute high-priority takeover of the test playlist, then `GET` polls whether a proof-of-play row arrived for it. This is the only true liveness check: a frozen or black screen still heartbeats and still reads ONLINE — only a PoP row for content we just requested proves pixels are moving.
- **Diagnose** (`/api/admin/devices/[id]/plan-preview`) — renders exactly the plan the device should be receiving, including drift between what is assigned and what the player last fetched. Use it before every escalation and after every content change: it distinguishes "we scheduled it wrong" from "the device isn't picking it up" in one view.

### 7.7 Verification duty — no change is done until a screen proves it

After **any** content, playlist, schedule, or booking change, the person who made the change owns verification, **within 30 minutes**:

1. Diagnose panel: the affected screen's plan shows the intended items (and for slot bookings, the right `slotPosition`/`isFiller`).
2. Screens tab: the device's `playbackAliveAt` is advancing. `lastSeen` fresh but `playbackAliveAt` stale means the process is alive but content is stuck — treat as an outage (§8.2), not as "propagation lag."
3. Reports tab: `PlayEvent` rows for the new content appear within minutes of playback. No PoP after 10+ minutes of confirmed playback is a **P0** — proof-of-play is the grant deliverable (field-trial runbook §1.6).
4. Log the change and its verification in the ops log [Ops log location — link].

---

## 8. Monitoring SOP

### 8.1 Monitoring cadence

| Cadence | Owner | What to do |
|---|---|---|
| **Continuous** (automatic) | System → [Ops Lead — name] | Offline alerts: admin console popup + WhatsApp to `ADMIN_WHATSAPP` (default +91 74113 24448) at the offline edge; partner WhatsApp after sustained downtime (§8.3). Every alert gets acknowledged and actioned — none are informational. |
| **Daily, 09:30 IST** | [Ops Lead — name] | Fleet review in `/admin` → Screens tab: (a) every **live** screen shows ONLINE; (b) `uptimePctD30` not declining on any screen; (c) free storage (`freeStorageMb`) not trending to zero — full storage truncates downloads and corrupts the cache; (d) CPU temperature normal for each panel. Anything anomalous → §8.2/§8.3, diagnose per §9. |
| **Weekly, Monday** | [Ops Lead — name] | (a) Uptime report per store: every screen vs the **80% grant floor** and the **95% T2 target** — a screen under 80% is a grant-deliverable problem, open a remediation item; (b) PoP row counts per screen for the week — a live screen with near-zero rows is frozen or misconfigured even if ONLINE; (c) data-quality checks §8.4. |
| **Monthly, by 3rd working day** | [Finance — name] + [Ops Lead — name] | (a) Partner payout run — Admin → Payouts tab, one `StorePayment` row per store per month (`YYYY-MM`), ₹500 standard / ₹1000 premium, UPI QR or bulk bank CSV export; contract requires payout within 10 working days of month end; (b) export the monthly uptime and maintenance report (Reports tab CSV) and file it with the grant records. |

### 8.2 Reading the dashboard

Device states (server-managed; the device never sets its own status):

| State | Meaning | Ops reading |
|---|---|---|
| `PENDING` | Claimed via `POST /api/device/claim` but never confirmed/assigned | Normal only during provisioning. A long-lived PENDING is an abandoned pairing — investigate or delete. |
| `ONLINE` | Heartbeated (plan poll or event flush) recently | Healthy **network-wise**. Not proof of playback — check `playbackAliveAt`. |
| `OFFLINE` | `lastSeen` > **20 minutes** old; flipped by the health cron running **every 5 minutes on GitHub Actions** (`/api/cron/device-health`) | Real outage signal. Expect up to ~20–25 min of detection lag: the player heartbeat is a WorkManager job Android clamps to a 15-min floor — platform limit, not a bug. |

Two signals beyond status, both visible per screen:

- **FROZEN screen**: `lastSeen` fresh + `playbackAliveAt` stale = the process is alive and networked but content stopped advancing. **Treat as a full outage** — the store is showing a stuck frame while we record heartbeats. Confirm with Test-play (§7.6); a frozen screen never completes it.
- **`bootedAt` tells you what broke**: after recovery, compare `bootedAt` against the outage gap. `bootedAt` **inside** the gap → the device rebooted → **power cut** (talk to the partner about the plug/mains). `bootedAt` **unchanged** → no reboot → **app or network failure** (diagnose per §9; check router, FCM token, incident telemetry).

### 8.3 Alert flow (what fires, when, and what you do)

Implemented in `src/lib/device-alerts.ts` + the health cron; timings are code, not convention:

1. **Offline edge** — the 5-min cron flips the device OFFLINE (20-min threshold) and opens one `DeviceAlert` row per outage (a flapping screen does not stack rows). Admin is notified **immediately**: console popup + WhatsApp. When **≥3** screens drop in one sweep (`ADMIN_DIGEST_THRESHOLD = 3`) they arrive as a single digest — read a digest as "mains or ISP event, not a device fault."
2. **Sustained outage** — after `PARTNER_NOTIFY_AFTER_MS = 40 min` past the edge (**≈60 min total downtime**), the partner gets a web push + WhatsApp ("check the screen's power and Wi-Fi"). Before sending, the system **re-checks live state** and silently closes the alert if the screen recovered or was re-assigned — a self-healed screen never generates a shopkeeper message. Severity escalates `warning → critical` at this point.
3. **Auto-resolve** — the next heartbeat closes the alert, records `downtimeSec`, and (only if the partner was told it broke) sends them a back-online notice.

The cron also opens a `RemediationTicket` (with an admin WhatsApp) when a device misses **3** heartbeat windows (20 min each), logs **≥3** offline transitions in 24 h, or its 30-day uptime drops **>15 points**; severity `high` at ≥6 missed windows.

**Ops action on every alert — no exceptions:**

| Step | Action |
|---|---|
| Acknowledge | Claim the alert in the admin Alerts tab within 15 min of the popup (business hours). |
| Diagnose | Follow §9 (dark-screen diagnosis). First move for most cases: call the store, ask for a power-cycle of screen and router. |
| Log outcome | Record cause (power / network / app / hardware) and resolution on the alert/ticket. `downtimeSec` and `bootedAt` (§8.2) do the classification for you. |

### 8.4 Weekly data-quality checks

Run alongside the Monday review. These protect the two things the grant and the brands actually buy: trustworthy proof-of-play and playable content.

1. **PoP hash-chain verification** — hit `/api/events/verify`. Every `PlayEvent` carries a SHA-256 `rowHash` chained off the previous row, so the log is tamper-evident; the endpoint re-validates the chain. Any failure is a **P0 data-integrity incident**: stop any pending brand report, escalate to [Tech — Deepak].
2. **Timestamp sanity** — spot-check the week's play timestamps for impossible dates (the fleet historically recorded 1,986 of 14,848 plays with 2024 timestamps from drifted device clocks). Player-side NTP repair has shipped, so **new** 2024-dated rows mean a device's clock repair is failing — pull that device's telemetry. Exclude known-bad historical rows from brand-facing reports.
3. **Transcode error queue empty** — filter the Content tab for `transcodeStatus = 'error'` (and stale `pending`). Clear the queue with `node local-transcode.mjs --all-pending` (§7.2). An errored creative attached to an active booking means a brand is currently getting filler instead of their ad — treat as same-day.

### 8.5 Known limitation: the health cron lives on GitHub Actions

> **Known limitation:** the real 5-minute health cadence is a GitHub Actions schedule (`.github/workflows/device-health-cron.yml` calling `/api/cron/device-health` with the `CRON_SECRET` repo secret), because Vercel's Hobby plan rejects sub-daily crons — the `vercel.json` cron entry is only a once-daily fallback (03:00 UTC). **GitHub can silently pause scheduled workflows after long repo inactivity, and it does not guarantee exact timing under load.** If offline detection seems stuck — no OFFLINE flips for hours despite a known outage, or alerts have gone completely quiet — check the repo's **Actions tab for failed or disabled runs first**, before debugging anything else (per the field-trial runbook §2.1). Re-enable the workflow if paused; a manual `workflow_dispatch` run restores detection immediately. Silence from the alert system is itself an alert.

---

## 9. Troubleshooting Runbook

How to use this section: find the symptom in the index, jump to the numbered entry, follow the Diagnose steps **in order**, then the Fix. Every entry names the owner level (L1/L2/L3 — defined in §10). If the Fix does not work within the time-box for your level (§10.2), escalate — do not improvise past your level.

Standing facts you need for almost every diagnosis:

| Fact | Value | Source |
|---|---|---|
| Offline threshold | Device flips OFFLINE when `lastSeen` > **20 minutes** old | `src/app/api/cron/device-health/route.ts` |
| Health cron cadence | Every **5 minutes** via GitHub Actions (`.github/workflows/device-health-cron.yml`); Vercel cron only fires once daily (03:00) as fallback | same |
| Heartbeat floor | Android clamps the player's heartbeat WorkManager job to a **15-minute minimum** — 20–25 min of dashboard lag after a real outage is normal, not a bug | field-trial-runbook §2 |
| Plan poll | Every 15 min + instantly on FCM `plan_updated` push; 60 s fallback poll when the device has no FCM token | ARCHITECTURE.md §3.1 |
| PoP flush | Events buffered locally (Room), flushed every 60 s in batches of ≤500, deleted **only after a 200** | ALIVE_PLAYER_API.md |
| Partner notified | Only after ~**60 min** sustained downtime (20-min edge + 40-min `PARTNER_NOTIFY_AFTER_MS`) | `src/lib/device-alerts.ts` |
| Current fleet build | versionCode **999560** (`apk-releases/alive-player-999560.apk`) | apk-releases/README.md |
| Admin tools | Screens tab → **Diagnose** (`/api/admin/devices/[id]/plan-preview`) and **Force Sync** (`POST /api/devices/[id]/force-sync`) | field-trial-runbook §1, §3 |

Symptom index:

| # | Symptom | Owner |
|---|---|---|
| 9.1 | Black screen, TV is on | L1 → L2 |
| 9.2 | Pairing code shown again unexpectedly | L2 (L3 if unexplained) |
| 9.3 | Stuck looping first ~5 s of one video | L2 → L3 |
| 9.4 | Frozen on a still frame | Self-heals; L3 if chronic |
| 9.5 | Dashboard says OFFLINE but screen visibly playing | L1 |
| 9.6 | Content not updating | L2 |
| 9.7 | Download stuck at N% | L1 → L2 |
| 9.8 | Wrong orientation | L2 |
| 9.9 | TV sleeps / HDMI power-save re-enabled | L1 |
| 9.10 | No FCM token / push never arrives | L2 (L3 if persistent) |
| 9.11 | TLS/certificate errors or "date wrong" banner | L2 → L3 |
| 9.12 | Captive-portal / MITM Wi-Fi | L1 + L2 |
| 9.13 | APK won't install / "downgrade" error | **L3 only** |
| 9.14 | Video black-screens on one panel model only | L3 |
| 9.15 | PoP rows not arriving | L2 → L3 |
| 9.16 | Whole-fleet outage — every screen OFFLINE at once | L3 + L4 (P1) |

### 9.1 Black screen, TV is on

- **Likely cause (in order):** empty/missing plan for this screen; player crashed and mid-relaunch; broken hardware decoder on this panel (→ 9.14); wrong HDMI input (only on stick-based installs).
- **Diagnose:**
  1. Admin → Screens: is the device ONLINE and is `lastSeen` fresh?
  2. Click **Diagnose** — does the plan preview show items? Zero items = programming problem, not hardware. (Since the 2026-08-14 fix, an empty slot-mode loop falls back to schedule mode instead of serving a dark plan — if you still see zero items, the schedule itself is wrong.)
  3. Look at the physical screen: pairing code (→ 9.2)? A diagnosis banner (→ 9.11/9.12)? Pure black?
  4. Ask the store to power-cycle the TV. The player is registered as HOME and relaunches itself after any crash.
- **Fix:** fix the schedule/playlist if Diagnose shows an empty plan; power-cycle for a wedged app; escalate to 9.14 if only videos are black on this panel model.
- **Owner:** L1 (visual check + power-cycle), L2 (admin diagnosis).

### 9.2 Screen shows the pairing code again unexpectedly

- **Likely cause:** the device was **decommissioned** — deleted in the admin panel (server answers `410` with body `{"error":"Device deleted"}`, or an FCM `decommission` push), the store was deleted with screens attached, or the app data was wiped/uninstalled locally.
- **Important design rule:** a **bare 410 must never cause this**. The player treats a bare 410 as transient; only a 410 carrying `{"error":"Device deleted"}` wipes the device (ARCHITECTURE.md §3.2, "Decommission safety"). If a screen wiped itself and **nobody deleted it in admin**, that is a player bug — collect what the screen shows and escalate to L3 immediately.
- **Fix (re-pair):**
  1. The screen shows a 6-character code plus a QR to `/admin/pair?code=XXXXXX`; it polls `/api/device/pairing-status` every 5 s.
  2. Admin → Screens: find the device by its pairing code (status `PENDING`) and confirm it.
  3. **Re-link the store** (deletion severed the link) and re-assign the schedule.
  4. Verify content plays and `PlayEvent` rows appear in Reports within ~10 minutes.
- **Owner:** L2 (re-pair + relink); L3 if the wipe was not caused by an intentional delete.

### 9.3 Stuck looping the first ~5 seconds of one video

- **Likely cause:** the stale-poller / stacked-instance bug — multiple player instances with competing pollers resetting the playback index. **Fixed in build 999520 and later** (singleTask + lifecycle-gated pollers + no index reset, device-verified 2026-08-14).
- **Diagnose:** Screens tab telemetry → `appVersion`. Anything below 999520 has the bug.
- **Fix:** update the APK to the current fleet build (999560). Respect the lineage rules in 9.13 — do not sideload across signing lineages. A power-cycle is a temporary relief only; the bug recurs.
- **Owner:** L2 detects; L3 performs the update.

### 9.4 Frozen on a still frame

- **Signal that defines this case:** `lastSeen` fresh + `playbackAliveAt` stale = frozen screen (the ARCHITECTURE.md §4.6 three-signal table). The process is alive and networked; content is not advancing.
- **Expected behaviour: self-heal in ≤90 s.** Two watchdogs cover it: the cross-process `:watchdog` kills and restarts the main process when the heartbeat file goes 90 s stale, and the frozen-glass watchdog (999560) detects "decode advancing but display frozen" after ~60 s of accumulated evidence and rebuilds the view via `Activity.recreate()` (~1 s, playlist position intact).
- **Diagnose (only if it does NOT self-heal within ~2 minutes, or the same screen freezes repeatedly):**
  1. Check TelemetryEvent incidents (`route='player/incident'`) for `STUCK_PLAYBACK` entries from this device.
  2. Collect on-device diagnostics with `ALIVE-Player/tools/diagnose-device.sh` and attach the output folder.
- **Fix:** power-cycle for the immediate outage; escalate the diagnostics bundle to L3 for the chronic case.
- **Known limitation:** the frozen-glass watchdog exists only in the 999560+ sideload lineage (the 999543 variant could never fire and was redesigned in 999560) — PR #57 is not merged to `main`, so a plain-main build loses it. Older builds recover only via the 90 s process watchdog or a power-cycle.
- **Owner:** watch and wait first; L2 monitors; L3 for chronic cases.

### 9.5 Dashboard shows OFFLINE but the screen is visibly playing

- **Likely cause:** network drop with cached content. The player deliberately keeps playing from its local cache when offline; heartbeats just can't reach the server, and after 20 minutes the cron flips it OFFLINE.
- **Diagnose:** call the store — router lights, ISP outage, Wi-Fi password changed? Check whether other screens at the same store/area dropped together (mains or ISP event). Remember the 15-min heartbeat floor: 20–25 min of lag is normal.
- **Fix:** get the router/ISP fixed. **Do not touch the TV.** On reconnect the screen self-heals: the next heartbeat resolves the `DeviceAlert`, fills `downtimeSec`, and uploads the queued proof-of-play backlog. Nothing is lost.
- **Owner:** L1.

### 9.6 Content not updating

- **Diagnose, in order:**
  1. Admin → Screens: is `fcmToken` present? Null token → the push path is dead, the screen converges only via the 15-min poll (see 9.10).
  2. **Diagnose** panel: compare what's assigned vs what the player last fetched — has the `planHash` actually changed on the server?
  3. If the hash changed but the device hasn't picked it up: **Force Sync** (`POST /api/devices/[id]/force-sync`). This sets `forceSyncAt`, which changes the plan hash, forces a cache purge and full re-download on the device's next fetch.
  4. If nothing after 15+ minutes: check `lastSeen` (device may simply be offline → 9.5).
- **Owner:** L2.

### 9.7 Download stuck at N%

- **What you see:** the player shows a download-progress corner while fetching assets.
- **Likely causes:** Wi-Fi connected but not validated / captive portal (→ 9.12); storage full; genuinely slow link.
- **Diagnose:** Screens tab heartbeat telemetry → `freeStorageMb`. The player pre-checks free space before downloading, so a full disk stalls, it doesn't corrupt — downloads stage as `.part` files, resume via HTTP range, and are MD5/SHA-256-verified before promotion.
- **Fix:** fix the network first. For storage: builds 999541+ prune stale cached assets automatically as soon as a content update lands; older builds rely on the 2 GB LRU cache — update the APK (via L3) if a screen chronically runs full. Then Force Sync.
- **Owner:** L1 (network), L2 (storage check + force sync).

### 9.8 Wrong orientation (sideways / upside-down)

- **Fix:** set the orientation in admin — `PORTRAIT` vs `PORTRAIT_FLIPPED` — on the device record. **Never** use the TV's own rotation setting: it is lost on firmware resets and fights the app.
- **Panel note:** Kodak panels throw on the OS rotation call; the player swallows it and rotates in software — the admin setting still applies.
- **Owner:** L2.

### 9.9 TV sleeps / HDMI power-save came back

- **Likely cause:** a panel firmware update or factory reset re-enabled the sleep timer / eco mode / CEC standby. Some panels are known to reset these after firmware updates; new units have arrived without anti-sleep provisioning at all.
- **Fix:** redo the §4 anti-sleep sweep on-site (sleep timer off, eco/power-save off, CEC standby off, screensaver off) and verify the screen stays awake through one full loop.
- **Why this is not cosmetic:** a sleeping display with a running player has historically kept recording plays (fleet-wide 2026-08-19 incident — plays billed while displays were Asleep). Treat sleep regressions as revenue-affecting.
- **Owner:** L1 (on-site sweep), L2 verifies display-state telemetry afterwards.

### 9.10 No FCM token / push never arrives

- **Likely cause:** MStar-SoC panels have no RTC battery. A cold boot starts with a stale clock → Firebase auth fails → no FCM token for that session.
- **Built-in self-heal:** the player runs a 60 s plan poll whenever it has no token (self-disables once a token appears) and re-uploads its token via `POST /api/device/fcm-token` whenever the server copy drifts. Content still converges — just by poll (≤15 min) instead of seconds.
- **Diagnose:** Screens tab → is `fcmToken` populated? Does content eventually update via poll?
- **Fix:** usually none needed. If the token stays null for days: power-cycle once the clock has synced; if still null, escalate to L3.
- **Owner:** L2 monitors; L3 if persistent.

### 9.11 TLS/certificate errors or "date wrong" banner

- **Built-in self-heal:** the player NTP-syncs **before** its first HTTPS call (a drifted clock fails TLS, so a post-success sync would never run on the devices that need it), falls back to the HTTP `Date` header where the router blocks UDP/123, and corrects the system clock on Device Owner devices.
- **If it persists:** the router is blocking both NTP **and** HTTPS. Read the diagnosis message the player prints on screen — it distinguishes **"device date/time is wrong"** from **"router is blocking wearealive.in"**. Act on what it says; don't guess.
- **Fix:** router/ISP change, or move the screen to a different network (hotspot test confirms the diagnosis in minutes).
- **Owner:** L2, with L3 if the on-screen diagnosis is ambiguous.

### 9.12 Captive-portal / MITM Wi-Fi

- **What you see:** the player reports **"network is blocking the screen (proxy: …)"** on screen — the Wi-Fi intercepts TLS (captive portal, MITM proxy, "free Wi-Fi" login page).
- **Fix:** get the router owner / ISP to whitelist `wearealive.in` (and the media host) or move the screen onto a clean SSID. A phone hotspot proves the diagnosis instantly.
- **Known limitation:** one deployed store (the Hisilicon panel) has been running on MITM Wi-Fi since the 2026-08-18 rollout — known, accepted, tracked by [Ops Lead — name] until the router is replaced. Do not re-diagnose it from scratch each time.
- **Owner:** L1 talks to the store/router owner; L2 verifies recovery in admin.

### 9.13 APK won't install / "downgrade" error

- **Likely cause:** two parallel lineages exist and must never be crossed in the field:
  1. **versionCode lineage** — CI builds carry small versionCodes; hand-built fleet builds carry the `999xxx` series. Android only upgrades, so a CI build reads as a *downgrade* on any 999xxx device.
  2. **signing lineage** — CI keystore vs the machine debug keystore that signs the 999xxx builds. Different signatures ⇒ install across them requires **uninstall first**, and uninstalling **loses pairing**: the reinstall generates a new `hardwareKey`, orphans the old device row, and forces a full re-pair + store relink (9.2).
- **Rule:** field staff never choose an APK. **Only L3 (Technology) decides** which build any device gets. Current fleet build: 999560.
- **Owner:** L3 only.

### 9.14 Video black-screens on this panel model only

- **Likely cause:** a broken hardware decoder on that SoC. Confirmed cases (ARCHITECTURE.md §3.3): HiSilicon Hi3751V350 AVC (Foxsky, KTC) — accepts input, never drains output; Realtek OMX (Kodak SPPL_2K_RT41, D5STV rtd2841a) — fails init; Realtek Codec2 HEVC (D5STV, Android 14) — `CodecException 0xe` at runtime, black-screen retry loop.
- **Fix:** install the per-panel APK from **`apk-releases/by-tv/`** (e.g. `by-tv/alive-player-realtek-d5stv.apk`, build 999530) or a fleet build that carries the relevant decoder blocklist (999560 carries all current entries). For a *new* panel model showing this: capture the model/SoC, run `tools/diagnose-device.sh`, and hand to L3 for a blocklist entry.
- **Known limitation:** the Realtek Codec2 HEVC blocklist entry exists only on the PR #57 branch (`fix/field-freeze-and-cache-hygiene`), not on `main` — an OTA built from plain `main` regresses those panels until PR #57 merges.
- **Owner:** L3.

### 9.15 PoP rows not arriving (screen plays, no PlayEvents)

- **Diagnose, in order:**
  1. **Telemetry error stream:** any `recordError`/`TelemetryEvent` rows against `/api/device/events`? A server-side ingest failure hits the whole fleet, not one screen (→ 9.16).
  2. **Device clock:** events with a wrong clock land with wrong timestamps and vanish from date-filtered reports. (Historical scale of this: 1,986 of 14,848 recorded plays carry 2024 timestamps. Player-side NTP repair now prevents new cases.)
  3. **Backlog, not loss:** events are buffered in Room, flushed every 60 s in ≤500-event batches, and deleted only after a 200 — after a reconnect the backlog arrives late, not never. Wait ~10 minutes after reconnect before concluding data loss.
- **Escalation rule:** confirmed playback with **no** PlayEvents after 10+ minutes is grant-deliverable-critical — a **P0** per §10.1.
- **Owner:** L2 detects; L3 fixes.

### 9.16 Whole-fleet outage — every screen OFFLINE simultaneously

- **This is server-side until proven otherwise. Do not dispatch anyone.** Individual TVs do not fail in unison; the server does.
- **Diagnose FIRST, in order:**
  1. **Vercel deploy status** — did a deploy land just before the outage started?
  2. **Telemetry error stream** — `TelemetryEvent` rows showing 500s on `/api/device/plan`, `/api/device/events`, `/api/device/claim`.
  3. **GitHub Actions** — if instead the symptom is *no OFFLINE flips for hours despite a known outage*, the health cron itself has stalled (GitHub pauses schedules on repo inactivity — ARCHITECTURE.md risk #8): check the Actions tab for failed/disabled `device-health-cron` runs.
- **Precedent (ARCHITECTURE.md risk #1, realised 2026-08-20):** `Device.bootedAt` was added to the Prisma schema **without its migration**. Prisma selects all scalar columns by default, so the one missing column 500'd every full-row device query — plan, events, claim, pairing, health cron — and took the device API down for **~5.5 hours**. Fixed by applying migration `20260820180000_device_booted_at`. A schema/migration mismatch after a deploy is the first hypothesis to test.
- **Fix:** L3 rolls back or hot-fixes the deploy (missing migration → apply it; bad code → revert on Vercel). Reassure everyone: screens keep playing cached content and queue PoP locally throughout — playback continuity survives a server outage; evidence just uploads late.
- **Owner:** L3 immediately, L4 informed. This is always **P1**.

## 10. Escalation Matrix & TAT

### 10.1 Severity levels and turnaround times

| Severity | Definition | Examples (→ §9) | Response time | Resolve target | Escalation |
|---|---|---|---|---|---|
| **P0** | Billing evidence or whole platform at risk: whole-fleet/server outage; confirmed playback with **no PoP** (grant deliverable) | 9.16, 9.15 (fleet-wide) | **Immediate** | **< 4 h** | **All levels — drop everything** |
| **P1** | Multiple screens dark; any **partner-visible billing or payout error** | ≥3 screens dark together (digest alert fires), wrong payout marked paid | **15 min** | **< 4 h** | **L3 + L4 immediately** |
| **P2** | A single screen dark or frozen for **> 60 min** | 9.1, 9.4 (not self-healing), 9.5 (router dead) | **1 h** | **< 24 h** | L1 → L2, L3 as needed |
| **P3** | Cosmetic, content-quality, or reporting question | 9.8, creative quality, a report query | **4 h** | **< 72 h** | Normal ladder |

"Response" = a human has acknowledged the incident in the ops WhatsApp group and owns it. "Resolve" = screen playing correct content again (or the billing/report corrected), verified in admin.

Note on the system's own timing: the platform will not even *know* a screen is dark until ~20–25 min after the fact (20-min offline threshold + 15-min heartbeat floor, §9 standing facts). The P2 60-minute clock starts at the outage, not at detection — the `DeviceAlert.startedAt` timestamp in the Alerts tab is your reference.

### 10.2 Escalation ladder

| Level | Role | May attempt | MUST escalate when | Contact channel |
|---|---|---|---|---|
| **L1** | Field Executive | On-site/phone-only actions: visual check, power-cycle, remote/input check, Wi-Fi/router liaison with the store, §4 anti-sleep sweep, talking the shopkeeper through a plug/router reset | Not fixed within **30 min**; or the fix needs *any* admin-console change; or *any* APK action | WhatsApp ops group [group — name/link] |
| **L2** | Ops Executive | Everything in the admin console: Diagnose, Force Sync, pairing confirm + store relink, orientation, schedule/playlist fixes and content rollback (field-trial runbook §3), alert acknowledgement, payout queries and payout runs (§11.3) | Not fixed within **60 min**; or the cause touches APK builds/signing (9.13), server errors, database, deploys; or money already went out wrong | WhatsApp ops group + phone [Ops Executive — name / number] |
| **L3** | Technology (Deepak) | Code, APK builds and lineage decisions, OTA pins, per-panel builds, Vercel deploys and rollbacks, migrations, telemetry analysis, decommission decisions | Inform **L4 immediately on any P1**; escalate decisions to L4 when partner/brand commercial commitments are at risk beyond 4 h, or a refund/credit is needed | Phone + WhatsApp [Technology — Deepak / number] |
| **L4** | Founder | Partner/brand-facing communication on P1s, commercial decisions, refunds/credits, grant-body reporting | — (top of ladder) | Phone [Founder — name / number] |

Two hard rules that override the time-boxes:

1. **P1 skips the ladder.** Whoever detects a P1 calls L3 *and* L4 directly, then posts in the ops group. Do not wait out the L1/L2 time-boxes on a P1.
2. **APK and server changes never happen below L3** — no matter how long the time-box has run (see 9.13: a wrong sideload costs the pairing and orphans the device row).

> **Known limitation:** the WhatsApp alert pipeline (`notifyAdminWA`) silently no-ops if the Twilio/MSG91 env vars are absent, and admin alerts for ≥3 simultaneous drops arrive as one digest message, not individual pings. Verify the alert channel is actually live as part of onboarding any new ops phone — do not assume silence means health.

### 10.3 Out-of-hours rule

- **P1:** phone-call L3 and L4 **immediately**, whatever the hour. A whole-fleet outage at 23:00 does not wait for morning — screens play cached content, but detection, billing evidence, and partner trust are all burning.
- **P2 / P3:** log the incident in the ops WhatsApp group with the §9 entry number when detected; pick it up **next business morning**. Business hours: [define — e.g. 09:30–19:00 IST, Mon–Sat].

### 10.4 Incident log

**Every incident gets a row** in the incident log (form in the Appendix), filled by the resolver before the incident is considered closed:

| Field | What to record |
|---|---|
| Date | Outage start (use `DeviceAlert.startedAt` where available, not detection time) |
| Screen | Device name + store name (or "fleet" for §9.16 events) |
| Symptom | What was observed, in one line |
| Category | The §9 entry number (9.1–9.16) — this is what makes the log analysable |
| Action | What actually fixed it |
| Downtime | Copy `downtimeSec` from the resolved `DeviceAlert` where one exists; otherwise estimate |
| Resolver | Name + level (L1–L4) |

Review the log monthly: three rows with the same screen + category in a month means the runbook entry's fix is a workaround, not a fix — raise it with L3 as a permanent-fix candidate.

## 11. Partner Support SOP

### 11.1 What a partner can raise, and where

Intake channels: **WhatsApp** to the ops number [Ops WhatsApp — number] and the **partner app** (store-dashboard PWA / Expo mobile app). Whatever the channel, the same person (L2 Ops Executive) owns the reply.

| Partner issue | Channel | First responder | Severity / TAT (§10.1) |
|---|---|---|---|
| Screen dark / not playing | WhatsApp or app | L2 (checks Alerts tab first — see script below) | P2 — respond 1 h, resolve < 24 h |
| Payout query ("where is my ₹500?") | WhatsApp or app → Earnings tab | L2 | P3 — respond 4 h; **any payout actually wrong = P1** |
| KYC / onboarding status | App (upload flows) or WhatsApp | L2 | P3 |
| Offer / flyer help (VoiceBill, flyers) | App or WhatsApp | L2 | P3 |
| Remove or relocate the screen | WhatsApp (must be confirmed in writing) | L2 → L3 | Scheduled work — see §11.5 |

### 11.2 Response scripts (the two commonest)

**Screen dark.** Before replying, open Admin → Alerts and find the open `DeviceAlert` for that store — its `startedAt` is your "we already knew" timestamp. Then:

> "Namaste [name]! Yes — our monitoring system alerted us at **HH:MM** and we are already working on it. Meanwhile, could you check two things for us: is the screen's plug switched on, and is the Wi-Fi router working? If it's on our side, a technician will have it resolved by **[per §10.1: within 24 hours]**. Your screen's plays are safe — the system records everything once it reconnects."

If there is **no** open alert for that store (partner noticed before the 20-minute detection window, or the alert pipeline missed it), say so honestly, open the incident yourself, and thank them — then check §10.2's known limitation on the alert channel.

**Payout query.**

> "Payouts run **monthly, for the previous month**, once your store is live — payment reaches you within **10 working days of month end** (clause 3.3 of your agreement). Standard partners receive **₹500/month**, premium partners **₹1000/month**; electricity is reimbursed separately and referral rewards (₹500 per converted code) are added to the same run. You can see the status any time in the partner app → **Earnings** — it will show 'paid' with the payment reference as soon as we process it."

If the app shows a month as paid but the partner says money never arrived: that is a **P1** (partner-visible billing error, §10.1) — verify the UTR/UPI reference on the `StorePayment` row before promising anything.

### 11.3 Monthly payout run procedure

Run once per month, immediately after month close, complete within 10 working days:

1. **Admin → Payments (Payouts) tab.** Generate the month's rows — the system creates one `StorePayment` row per live store per month (`YYYY-MM`). A store earns from `liveAt` onwards; stores not yet `live` get no row.
2. **Check amounts:** ₹500 standard / ₹1000 premium per screen-month; add referral rewards (₹500 per new partner converted on the store's code) and electricity reimbursement per the agreement.
3. **Pay** by either path:
   - **UPI QR** — per-store QR from the tab, scan-and-pay individually; or
   - **Bulk bank CSV** — export the CSV from the tab and run it as a batch transfer through the bank portal.
4. **Mark each row paid** with the payment reference (UTR / UPI ref). Do not mark paid before money has actually left — the partner app reads this status live.
5. **Partner-side verification:** the partner sees the row flip to paid, with reference, in the app's Earnings tab. Spot-check 2–3 partners by WhatsApp on the first run of each month.
6. Log any failed/bounced transfer in the incident log (§10.4) and re-run that row — a bounced payout left unfixed becomes a P1 the moment the partner asks.

### 11.4 The automatic offline alert to partners — and the rule that goes with it

The system messages partners about outages **on its own**. Know the timeline so ops is never behind the machine:

| T+ | What happens automatically |
|---|---|
| 0 | Screen's heartbeats stop |
| ~20 min | 5-min cron flips the device OFFLINE, opens a `DeviceAlert`, notifies **admin** WhatsApp immediately (one digest message if ≥3 screens drop together) |
| ~60 min | If still down (`PARTNER_NOTIFY_AFTER_MS` = 40 min past the edge), the **partner** gets a push + WhatsApp: *"Your ALIVE screen is offline — it stopped playing about an hour ago. Please check the screen's power and Wi-Fi."* Alert severity escalates to critical |
| Recovery | On the next heartbeat the alert auto-resolves with `downtimeSec`; the partner gets a back-online message **only if** they received the offline one — a resolution notice is never their first contact |

Built-in guards you can rely on: before messaging, the system re-checks the device's **live** state (a screen that recovered is never falsely reported to its shopkeeper), and re-checks the screen still belongs to that store (a relinked screen never messages the wrong partner). Marking happens before sending, so a partner can never be double-messaged for one outage.

**The ops rule:** the admin alert lands ~40 minutes before the partner message. **Ops must have acknowledged the admin alert (§10.1 response) before the partner WhatsApp fires** — and for anything P2 or above, **call the partner proactively** rather than letting the automated message be the first thing they hear. The automated WhatsApp is the safety net, not the service.

> **Known limitation:** the partner *push* notification requires VAPID env vars to be configured; until they are, only the WhatsApp message is delivered. And the WhatsApp path itself no-ops silently if the Twilio/MSG91 credentials are absent (§10.2). Confirm both channels with a test outage before relying on them for a new deployment.

### 11.5 Partner offboarding or relocation request

1. Take the request in writing (WhatsApp is fine), confirm identity against the registered WhatsApp number, and log it.
2. **Relocation within the same partner:** do **not** delete anything — unlink/relink the store on the device record in admin and physically move the screen. Deletion is not the tool for a move.
3. **Removal (offboarding):** schedule the visit, settle the final month's payout (§11.3 — the store earns up to its last live day), then follow the **§14 decommission procedure**. Do not delete the screen in admin ahead of the visit: deletion pushes `decommission` / answers `410 {"error":"Device deleted"}` and wipes the screen immediately (§9.2), leaving a dead panel on the partner's wall until the team arrives.
4. Close with a final WhatsApp confirming the removal and the last payout reference.

---

## 12. Change Management & Release SOP

Two things ship at ALIVE: **Studio** (the server, wearealive.in) and the **Player APK** (the fleet). They have different blast radii and different rules. Config edits made inside the admin panel are a third category (§12.5) — they reach screens in seconds and count as releases too.

### 12.1 Studio (server) releases

Every change lands on `main` via a pull request. A push to `main` auto-deploys on Vercel; the build runs:

```
prisma migrate deploy && prisma generate && next build
```

That means **the deploy itself runs database migrations**. There is no separate "apply migration" step — whatever migration folders are in the commit get applied to production Neon Postgres during the build (using `DATABASE_DIRECT_URL`).

> **⛔ MANDATORY PRE-PUSH CHECK — schema and migration ship together**
>
> Any edit to `prisma/schema.prisma` MUST include a matching migration folder under `prisma/migrations/` **in the same commit**. Before pushing, verify:
>
> ```
> git show --stat HEAD | grep migrations
> ```
>
> If the commit touches `schema.prisma` and that grep returns nothing, **do not push**.
>
> **Why this is a hard rule:** Prisma selects *all* scalar columns on every query by default. One column that exists in the schema but not in the database 500s every full-row device query — plan, events, claim, pairing-status, and the health cron — simultaneously. This exact failure happened on **2026-08-20**: `Device.bootedAt` shipped in the schema without its migration and took the entire device API down for **~5.5 hours**. It was fixed by applying `20260820180000_device_booted_at`. (Known risk #1 in `studio/docs/ARCHITECTURE.md`.)

Pre-merge checklist (the build does NOT gate on these — it ignores TypeScript and ESLint errors, known risk #6):

| # | Check | Command / where |
|---|---|---|
| 1 | Types pass | `npx tsc --noEmit` in `studio/` |
| 2 | Build passes locally | `npm run build` |
| 3 | Schema ↔ migration pairing | `git show --stat HEAD \| grep migrations` (boxed rule above) |
| 4 | PR reviewed, merged to `main` | GitHub |

**Post-deploy verification (do this every deploy, ~15 minutes):**

1. Watch telemetry errors for 15 minutes — Admin → Monitoring tab (`TelemetryEvent` rows via `recordError`, with correlation IDs). A spike of a single `errorClass` across device routes right after deploy = your change; go straight to §12.4 rollback.
2. Confirm device ingest is advancing: on the Screens tab, `lastSeen` timestamps must keep moving; in Reports, new `PlayEvent` rows must keep landing. If both freeze fleet-wide after a deploy, the device API is down — treat as P0.
3. If the deploy touched the plan endpoint or scheduling, spot-check one device with Screens → Diagnose (`/api/admin/devices/[id]/plan-preview`).

### 12.2 Player (APK) releases

**OTA path:** every device calls `GET /api/device/update-check` (every 6 h). The server resolves the release in priority order: the `PLAYER_LATEST_*` env vars act as a pin/rollback override; otherwise it reads the `latest.json` manifest published on the `sideload-latest` GitHub Release by the release workflow (URL overridable via `PLAYER_OTA_MANIFEST_URL`). The player installs when the offered `versionCode` is higher than its own. Silent install works only on Device-Owner-enrolled devices on API 31+; every other unit shows Android's install-confirm dialog and needs a human to press OK.

**Versioning rules — two lineages, do not cross them:**

| Lineage | versionCode | Signed with | Example |
|---|---|---|---|
| CI builds | GitHub Actions `run_number` (e.g. 66, 67) | CI keystore | OTA fleet releases |
| Hand builds | `999xxx` series | The build laptop's debug keystore | 999530, 999541, 999560 |

Known hazards (risks #2–#4 in `ARCHITECTURE.md`):

- **Downgrade trap:** the fleet currently runs `999560`-series hand builds. Any CI build (versionCode ~67) reads as a *downgrade* — Android only upgrades, so it silently never installs, and worse, the `latest.json` that CI publishes clobbers the real OTA manifest. The fix exists unmerged on branch `fix/ci-fleet-versioning`.
- **Signing trap:** the two keystores are incompatible. Installing across lineages requires an uninstall first — which loses pairing, generates a new `hardwareKey`, and orphans the device row in the DB.
- **Fleet-ahead-of-main trap:** PR #57 (`fix/field-freeze-and-cache-hygiene` — Realtek Codec2 blocklist, frozen-glass watchdog, cache prune, loop-kick debounce) is unmerged; a build cut from plain `main` is a *regression* for deployed screens until it lands.

> **Standing rule: ONE person owns version numbers — [Technology — name].**
> Nobody else picks a versionCode, and every hand-built APK gets an entry in `apk-releases/README.md` **before it touches a TV**, recording: base commit, every uncommitted change baked in, sha256 of the APK, and a deployment record (which TV, which IP, verified when). The `999551` incident — a parallel build that appeared on two screens containing none of the four field fixes, discovered only by dex marker search — is what happens without this.

### 12.3 Staged rollout rule

For every player build and every risky server change:

1. **1 bench screen** (office/test TV) — install, watch playback, reboot it once, confirm `PlayEvent` rows land.
2. **1 live store for 24 h** — confirm overnight survival, heartbeats, no incident rows.
3. **Fleet** — OTA or per-device rollout.

**Never fleet-wide same day**, with one exception: a P1 fix for an active fleet-wide outage, called by [Technology — name].

### 12.4 Rollback

**Server:** `git revert <bad-commit>` → push to `main` → Vercel redeploys.

> **Known limitation:** migrations are **forward-only**. `prisma migrate deploy` never un-applies anything, and you must **never edit or delete an applied migration folder** — that desyncs the `_prisma_migrations` table and can wedge every future deploy. If the bad change included a migration, the revert commit must carry a **new forward migration** that undoes the schema change (e.g. drops the column). Reverting only the code while leaving an additive column in place is safe and is usually the fastest first move.

**Player:** set the env pins in Vercel so `update-check` serves the previous APK, then redeploy:

```
PLAYER_LATEST_VERSION_CODE   # previous good versionCode
PLAYER_LATEST_VERSION_NAME   # previous good versionName
PLAYER_APK_URL               # signed APK download URL
PLAYER_APK_SHA256            # its checksum
```

Env pins override the `latest.json` manifest, so this works even if a bad manifest was published.

> **Known limitation:** Android will not downgrade. Pinning an older versionCode stops the bad build from *spreading*, but devices that already installed it stay on it. To actually replace it you need a **fixed build with a higher versionCode** (this is why 999541/999543/999560 kept counting upward past the 999540 pin), or a per-device uninstall+reinstall — which loses pairing (§12.2).

### 12.5 Config changes are changes

`PlayerConfig` knobs (fleet-wide player settings), Schedules, Playlists, slot-loop settings and Overlays all reach screens in seconds via the FCM `plan_updated` push, or within 15 minutes via the plan poll. Treat them like deploys:

1. **Announce in the ops channel before saving** — what you're changing, which screens it targets.
2. **Verify propagation:** Screens → Diagnose to confirm the served plan matches intent; use **Force Sync** (`POST /api/devices/[id]/force-sync`) if you can't wait for the poll.
3. **Don't rapid-fire saves.** Four plan pushes in under 60 seconds wedged a Foxsky panel's EGL window on 2026-08-19 (the freeze the 999560 debounce fixes). Batch your edits, save once.
4. Rollback for a bad content push is the runbook §3 procedure: restore the previous playlist items via `PATCH /api/playlists/[id]`, Force Sync, verify in Diagnose. There is no automatic versioning — know the previous good state before you edit.

---

## 13. Data, Privacy & Compliance

ALIVE (VS Collective LLP, GST 29AAXFV2589C1ZE) holds partner PII, KYC documents, GPS-tagged photos, brand contact data and billable play logs. This section says exactly what we hold, where, who can see it, and how it leaves the system.

### 13.1 Data inventory

| Data | Examples | Stored in | Who can access |
|---|---|---|---|
| Partner identity | Store name, owner name, phone/WhatsApp (doubles as login username), GSTIN | Neon Postgres (`Store`, `User`) | Admin password holders; the partner themselves (own record only) |
| Partner payment details | Bank account / UPI for payouts | Neon Postgres (`Store`, `StorePayment`) | Admin password holders; the partner (own record only) |
| Partner KYC | PAN, Aadhaar, selfie. **Aadhaar: only the last 4 digits are stored, as text — never the full number, never an image of the full number** | Documents in Cloudflare R2 (uploaded via the small server-side proxy `POST /api/admin/r2-upload`); references + last-4 text in Postgres | Admin password holders only |
| GPS-tagged photos | Shop-front photo (gates stage past `new`), installed-TV photo (gates stage past `contacted`) | R2 under `verification/` (`shopPhotoUrl`, `installPhotoUrl` on `Store`) | Admin password holders; the partner (own photos) |
| Brand contact data | Company, contact person, email, phone, Razorpay order/payment IDs | Neon Postgres (`Brand`, `Campaign`) | Admin password holders; the brand (own dashboard via Auth.js session) |
| Play logs | `PlayEvent` rows — device, campaign, media, timestamps, slot position, tamper-evident `rowHash` chain | Neon Postgres | Admin; brands see rollups for their own campaigns only |
| Device telemetry | `lastSeen`, CPU temp, storage, versions, incident stack traces (`TelemetryEvent`) | Neon Postgres | Admin password holders only |
| Ad media / creatives | Video/image files | R2 (public delivery URLs for players) | Public URLs by design — never put PII in creative filenames |

### 13.2 Access rules

- **Store partners see only their own data.** Enforcement mechanism: a bare `storeId` parameter is *not* a credential (IDs are enumerable). Every store-partner API call must carry either the signed HMAC token `st1.<storeId>.<expMs>.<sig>` (`x-store-token` header, signed with `AUTH_SECRET`, 90-day TTL, constant-time compare) or a matching next-auth session — resolved centrally by `resolveStoreId()` in `studio/src/lib/store-partner-auth.ts`. This is the fix for the store IDOR (shipped 2026-08-18); never hand-roll a route that trusts a raw `storeId`.
- **Never share the admin password.** It is a single shared `ADMIN_PASSWORD` header guarding ~63 admin routes. Anyone who holds it can read all PII and delete the fleet. Keep the holder list to named individuals ([Ops Lead — name], [Technology — name]); rotate it when anyone leaves.
- **Known limitation:** admin routes **fail open** if `ADMIN_PASSWORD` is unset in the environment (risk #5, `ARCHITECTURE.md`). Verifying that the env var is set is part of any new-environment checklist.
- **Per-role principle:** `User.role` is `STORE_PARTNER | BRAND | AGENCY | ADMIN | OPS`. Give people the narrowest realm that does their job — field staff generally need nothing beyond the partner-facing flows plus, at most, pairing confirmation.
- **Audit expectation:** destructive admin actions (store delete, device delete, payout marking) should be attributable. `AuditLog` exists in the schema for this; until it's fully wired, announce destructive actions in the ops channel *before* doing them so there is a human record.

### 13.3 Retention and erasure

- **KYC** is kept while the partnership is active (needed for payouts and the signed agreement). On exit, erase per below after the final payout clears.
- **Account deletion route:** `/delete-account` exists for Play-Store compliance — partners can request deletion from the app.
- **Manual erasure procedure (admin):** deleting a store from the admin panel (`DELETE /api/admin/stores/[id]`) cascades through `StorePayment`, `StoreOffer`, `Bill` and `Device` rows, deletes the linked `User`, deletes the `verification/` GPS photos from R2, and sends a decommission push to any attached screens. **Before deleting:** export the payout history you are legally required to retain (payout records are expenses — see §13.4) — the cascade removes `StorePayment` rows with the store.
- Play logs and telemetry are operational/billing records, not PII beyond device identity; retain them (they are the brand-billing evidence and the ELEVATE grant deliverable).

### 13.4 GST and money records

- **Brand side:** invoices carry **18% GST** (`GST_RATE = 0.18` in `studio/src/lib/brand-pricing.ts`) on the discounted subtotal. Current online per-screen-month tiers (same file, single source of truth for client and server): ₹999 (1 screen) / ₹899 (3+) / ₹799 (10+) / ₹699 (20+). The server recomputes the charge and re-fetches the order amount from Razorpay on verification — the browser total is display-only.
- **Partner side:** payouts (₹500/month standard, ₹1000/month premium) are **expenses**, one `StorePayment` row per store per month (`YYYY-MM`), paid within 10 working days of month end. Retain the UPI reference or bank transaction ID against each row (the admin Payouts tab supports UPI QR and bulk bank CSV export). Electricity reimbursement is recorded separately.

### 13.5 Consent

- The partner agreement (`/store-agreement`, VS Collective LLP contract) is presented at registration step 2 with the party block prefilled; the "I agree" checkbox saves a consent timestamp (`agreedAt`) on submit.
- GPS-tagged shop and install photos are taken **with the partner's knowledge and for a stated purpose** (onboarding verification) — tell them what the photo is for before taking it. The onboarding stage gates in `api/admin/stores/[id]` make these photos mandatory, so there is no "quietly photograph the shop" path.
- Brands consent to terms of service inside the onboarding funnel before payment.

---

## 14. Business Continuity & Decommissioning

### 14.1 Studio down (Vercel/Neon outage or a bad deploy)

**What keeps working:** every screen keeps playing its cached plan **indefinitely** — the plan endpoint serves a 72-hour rolling window and all assets are cached on-device (2 GB LRU), so playback does not depend on the server being up. Devices retry with exponential backoff (2s → 4s → 8s → 16s) and just keep looping cached content.

**What stops:** new content/schedule changes don't propagate, the admin console is unreachable, and proof-of-play upload pauses. **No billing data is lost:** each play is written to the on-device Room backlog first, and `PopUploadWorker` deletes local rows only after a server 200 — the backlog drains automatically after recovery. The only way a server outage loses PoP data is if a device is wiped while the backlog is still on it (so: never decommission or factory-reset a device during a server outage; see also known risk #9 — a Room destructive migration touching `proof_events` would destroy the backlog).

**During the outage:**
1. Expect the whole fleet to trend OFFLINE in monitoring ~20 minutes in — that is the detector reacting to the server, not to the screens. Do not dispatch field visits for it.
2. Diagnose per §12.1/§12.4: bad deploy → revert; platform outage → wait it out (check Vercel/Neon status pages first, §14.4).
3. After recovery: watch `lastSeen` timestamps resume, then confirm the PoP backlog draining as a burst of `PlayEvent` rows with `startedAt` values inside the outage window.

### 14.2 Store closes / partner exits

1. **Schedule the retrieval visit** and agree the exit date with the partner.
2. **Decommission from the admin panel — never on the device.** Delete the screen in `/admin` → Screens (or delete the store, which cascades to its devices). The platform then: sends a token-addressed FCM `decommission` push; the player wipes its cached plan, media, Room tables and identity, and returns to the pairing screen. A screen that misses the push converges on its next API call, which answers **410 with `{"error":"Device deleted"}`** — the marker that authorizes self-wipe.
3. **On site:** confirm the screen shows the pairing screen (not content), then unmount and recover the hardware.
4. **Settle the final payout:** final month's `StorePayment` (pro-rated as agreed) within 10 working days of month end, UPI/bank reference recorded.
5. **Mark the store record.** Export payout history first if you intend to delete the store row (§13.3 — the cascade removes payment rows).

> **NEVER decommission by uninstalling the app or factory-resetting the TV on site first.** Let the platform do it. Wiping device-side first leaves an orphaned device row that keeps alerting, breaks the PoP audit trail, and skips the final backlog upload. The platform path keeps records consistent.

> **Why a bare 410 must not wipe (and why the marker exists):** Vercel's platform itself can emit plain 410 responses. If the player treated any 410 as "decommission", a platform hiccup would factory-unpair the entire fleet at once. The player therefore treats a bare 410 as transient and wipes **only** on the `"Device deleted"` marker body. Related safety: destructive pushes (`reboot`, `decommission`) are rejected if delivered via an FCM *topic* — token-only addressing, so one server-side mistake cannot wipe the fleet.

### 14.3 Hardware recovery and re-inventory

1. Unlink and wipe via the §14.2 decommission flow (platform-driven, never device-first).
2. Physically recover: panel, mount, power brick, remote.
3. **Re-inventory as a spare with its APK lineage noted** — label the unit with panel/SoC model and which build family it needs (Appendix F). Example: the Realtek rtd2841a "2K D5STV" panel is unusable without the `c2.realtek.video.hevc.decoder` blocklist build; a HiSilicon Foxsky needs the HEVC-preference path.
4. Note the **signing lineage** on the label (CI keystore vs 999xxx debug keystore, §12.2) — crossing lineages on redeploy forces an uninstall and a new pairing.
5. Before redeploying to a new store, factory reset and re-enroll via the Device Owner zero-touch QR (`ALIVE-Player/PROVISIONING.md`) — enrollment is a factory-reset operation anyway, and Device Owner is what buys silent OTA and autostart immunity.

### 14.4 Single point of failure register

| Dependency | Symptom if down | First check | Fallback / mitigation |
|---|---|---|---|
| **Vercel** (hosts Studio + all APIs) | Admin unreachable; whole fleet trends OFFLINE ~20 min in; no content changes | Vercel status page + deployment logs; was there a deploy just now? | Screens play cached 72 h plans indefinitely; PoP backlogs on-device; revert bad deploy (§12.4) |
| **Neon Postgres** | API up but 500s with DB errors in Monitoring; ingest frozen | Neon console/status; `TelemetryEvent` error classes | Same device-side caching; nothing to do but wait or restore — do not wipe any device meanwhile |
| **Cloudflare R2** | New media won't download; existing cached content plays fine; KYC uploads fail | Cloudflare status/dashboard | Delay content pushes; players verify checksums so partial downloads never play corrupt |
| **FCM** | Admin edits take up to 15 min instead of seconds; decommission pushes missed | `fcmToken` null/stale on device rows; push send errors | By design: 15-min plan poll converges everything; token-less devices run a 60 s fallback poll; deletion converges via the 410 marker |
| **GitHub Actions cron** (`.github/workflows/device-health-cron.yml`, every 5 min) | Offline detection silently stops — no OFFLINE flips despite a known outage | Actions tab for failed/**disabled** runs (GitHub pauses schedules on repo inactivity — known risk #8) | Vercel's own daily cron (`0 3 * * *` in `vercel.json`) still sweeps once a day; re-enable the workflow |
| **Razorpay** | Brand payments fail at checkout | Razorpay dashboard/status | "Confirm Booking — Pay later" path keeps bookings flowing (`pending_payment`); only signature-verified payment ever activates a campaign |

---

## 15. Appendices

### 15.1 Appendix A — Printable installation checklist (one page)

**Store:** ______________________  **Screen/device name:** ______________________  **Date:** ____________

| ✓ | # | Step | Pass criteria |
|---|---|---|---|
| ☐ | 1 | Mount panel in **portrait**, clear sightline to customers, power socket reachable | Partner agrees on position |
| ☐ | 2 | Power on; connect store Wi-Fi or data SIM | Network icon steady |
| ☐ | 3 | Factory-fresh unit: enroll **Device Owner** via zero-touch QR (6 taps on welcome screen → scan) or `adb shell dpm set-device-owner com.alive.player/.admin.AliveDeviceAdminReceiver` | Diagnostics overlay shows "Device Owner: yes" |
| ☐ | 4 | Disable panel sleep timer / screensaver in TV settings (anti-sleep provisioning) | No sleep/screensaver entries armed |
| ☐ | 5 | Player boots to pairing screen; 6-character pairing code + QR displayed | Code visible |
| ☐ | 6 | Confirm pairing in `/admin` → Screens (device shows `PENDING` with the code) | Code clears from the TV |
| ☐ | 7 | Link device to the store; assign playlist/schedule | Schedule visible on device row |
| ☐ | 8 | Screens → **Diagnose**: served plan matches assignment | No drift shown |
| ☐ | 9 | Content playing on the screen, full-screen portrait, no letterboxing | Visual check |
| ☐ | 10 | `PlayEvent` rows appear in Reports within 10 min of playback | **If not: treat as P0** (PoP is the grant deliverable) |
| ☐ | 11 | Take **GPS-tagged installed-TV photo** and upload (required to advance the store past `contacted`) | Photo on store record |
| ☐ | 12 | Advance onboarding stage → `physically_onboarded` in admin (`live` + `liveAt` come later from Ops, §3.10) | Stage saved without a 409 gate error |
| ☐ | 13 | Show the partner: power button, "call us before touching anything else" | Partner briefed |

**Installer sign-off:** ______________________  **Partner sign-off:** ______________________  **Time completed:** ________

### 15.2 Appendix B — Store-visit script card

**The pitch (30 seconds):**
- "We install a free TV screen in your shop — it plays offers and ads for your customers."
- "You get **₹500 every month** (₹1000 for premium locations), and **electricity is reimbursed separately**."
- "You also get free tools: printed-style offer flyers and VoiceBill billing for your counter."
- "Refer another shop that joins with your code and you get **₹500 extra**."
- "One screen per store, we install and maintain everything, agreement is on wearealive.in/store-agreement."

**Objection responses:**

| Objection | Answer |
|---|---|
| "Who pays the electricity?" | We do — reimbursed separately from the ₹500, per the agreement |
| "What if it breaks?" | ALIVE owns and maintains the hardware; call us, we fix or replace it |
| "Will it show my competitor's ads?" | ALIVE gives your store exclusivity within 200 m of your shop |
| "Am I locked in?" | The agreement is on the website; exits are settled with a final payout within 10 working days of month end |
| "I don't have space" | It mounts vertically (portrait) on a wall — no counter space used |
| "When do I get paid?" | Monthly, within 10 working days of month end, by UPI or bank transfer |

**Before leaving a signed-up store:** capture the **GPS shop-front photo** — the store cannot advance past stage `new` without it.

### 15.3 Appendix C — Escalation contact card

| Level | Role | Who | Contact | Handles |
|---|---|---|---|---|
| L1 | Field Ops / on-call | [Field Ops — name] | [phone] | Store calls, power-cycles, site visits, installs |
| L2 | Ops Lead | [Ops Lead — name] | [phone] | Multi-screen incidents, partner escalations, payouts |
| L3 | Technology | [Technology — name] | [phone] | Server deploys/rollbacks, APK builds, version numbers (sole owner, §12.2), data issues |
| L4 | Founder / LLP partner | [Founder — name] | [phone] | Brand-facing incidents, legal, grant reporting |

**Severity quick reference:**

| Sev | Definition | Examples | Response |
|---|---|---|---|
| P0 | Billing evidence or whole platform at risk | PoP not recording during confirmed playback; device API down fleet-wide (e.g. the 2026-08-20 migration outage) | Immediate; all levels — drop everything; resolve < 4 h |
| P1 | Multiple screens dark; partner-visible billing/payout error | ≥3 screens dark together (admin digest alert fires); wrong payout marked paid | Respond 15 min; resolve < 4 h; L3 + L4 immediately |
| P2 | Single screen degraded | One screen dark/frozen > 60 min (partner auto-notified at ~60 min) | Respond 1 h; resolve < 24 h (out-of-hours: next business morning, §10.3) |
| P3 | Cosmetic / non-urgent | Overlay styling, copy fixes, report queries | Respond 4 h; resolve < 72 h |

### 15.4 Appendix D — Dashboard field glossary

| Field | What it tells you |
|---|---|
| `lastSeen` | Last time the device hit any API. Fresh = process alive and networked. > 20 min old → cron flips the device OFFLINE (sweep runs every 5 min, so expect up to ~20–25 min of lag) |
| `playbackAliveAt` | Last time content actually advanced. Fresh `lastSeen` + stale `playbackAliveAt` = **frozen screen** (app up, picture stuck) |
| `bootedAt` | When the device last booted. A boot *inside* an outage gap = power cut; a boot *before* it = something else broke |
| `uptimePctD30` | Rolling 30-day uptime %, recomputed each 5-min health sweep; a > 15-point drop auto-opens a remediation ticket |
| `planHash` | SHA-256 fingerprint of the device's current plan; the player skips re-processing when it matches. Diagnose shows drift between assigned and fetched |
| `transcodeStatus` | Media pipeline state for a `Content` row. A creative is fleet-safe only after transcode (H.264 Main@4.1 ≤1080p30 + optional HEVC rendition) completes |
| `onboardingStage` | Store pipeline: `new → contacted → physically_onboarded → digitally_onboarded → live`. GPS shop photo gates leaving `new`; GPS install photo gates advancing past `contacted` (server enforces with a 409) |
| `payoutStatus` | State of the store's monthly ₹500/₹1000 remuneration (`StorePayment`, one row per store per `YYYY-MM`) |

### 15.5 Appendix E — Incident report form (blank)

```
ALIVE INCIDENT REPORT                                   Ref: INC-______

Date/time detected: ____________________  Detected by:  ☐ Alert (WhatsApp/admin)
                                                        ☐ Partner call/message
                                                        ☐ Site visit  ☐ Other: ________
Screen(s): _____________________________  Store(s): ______________________________

Symptom category (§9):  ☐ Offline/no heartbeat   ☐ Frozen screen (lastSeen fresh)
                        ☐ Black screen / codec   ☐ Stale content
                        ☐ Server/API errors      ☐ Other: _________________________

Severity:  ☐ P0  ☐ P1  ☐ P2  ☐ P3

Actions taken (with timestamps):
  __:__  ____________________________________________________________________
  __:__  ____________________________________________________________________
  __:__  ____________________________________________________________________

Resolved at: ____________  Total downtime: ____________ (cross-check DeviceAlert.downtimeSec)

Root cause: ________________________________________________________________
Resolver: ____________________  Prevention note (what stops a repeat): ______
____________________________________________________________________________
```

### 15.6 Appendix F — APK lineage quick-reference (which build for which panel)

Source of truth: `apk-releases/README.md` — every hand-built APK is logged there **before** it touches a TV (§12.2). Current fleet build: **`alive-player-999560.apk`** (versionCode 999560, PR #57 content: Realtek Codec2 HEVC blocklist, prune-on-update cache, loop-kick debounce, frozen-glass watchdog).

| Panel / SoC | Known failure | Build to use | Notes |
|---|---|---|---|
| Realtek rtd2841a — "2K D5STV" (AH Store, Android 14) | `c2.realtek.video.hevc.decoder` dies with CodecException 0xe → black-screen retry loop | `by-tv/alive-player-realtek-d5stv.apk` (999530) or any ≥999541 build | Fix is uncommitted-on-main until PR #57 merges; sha256 in README entry |
| HiSilicon Hi3751V350 — Foxsky, KTC | AVC decoder accepts input, never drains → permanent blank, no error | 999560 fleet build | Plays the server's HEVC rendition instead (`preferHevc`) |
| Realtek SPPL_2K_RT41 — Kodak | OMX AVC decoder fails init; `setRequestedOrientation` throws on OEM windows | 999560 fleet build | Decoder blocklisted; orientation applied in software |
| MStar (no RTC battery) | Stale clock on cold boot → Firebase auth fails → no FCM token that session | 999560 fleet build | 60 s plan-poll fallback self-disables once a token appears |
| Google TV / ASAANO | Launcher re-enables on boot; brief OEM launcher flash | 999560 fleet build | Accepted behaviour; Device Owner enrollment reduces it |

> **Warnings that apply to every row:**
> 1. All `999xxx` builds are signed with the build laptop's debug keystore — **incompatible with CI-signed builds**; crossing lineages = uninstall = pairing loss (§12.2).
> 2. PR #57 is unmerged: a build cut from plain `main` today is a **regression** for every deployed screen.
> 3. `adb install -r <apk>` for same-lineage upgrades; Android never downgrades, so a stray higher versionCode (like the rogue 999551) can only be displaced by an even higher one.

