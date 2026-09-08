# ALIVE Store — Play Console Checklist

Everything needed to take the partner app from EAS to the Play Store.
Repo side is already wired (see § 0); this file is mostly the Console-side
walkthrough with the form answers prefilled. Build/submit commands live in
[DEPLOYMENT.md](./DEPLOYMENT.md).

Key URLs used throughout:

| Thing | URL |
|---|---|
| Privacy policy | `https://www.wearealive.in/privacy` |
| Account deletion | `https://www.wearealive.in/privacy#delete-account` |
| Website | `https://www.wearealive.in` |
| Contact email | `hello@wearealive.in` |

---

## 0. Repo state (as of 2026-09-07)

Already done — no action needed:

- EAS project linked (`6a63834c-7c6a-474c-a438-ca5bbfd0b32f`), production AAB
  profile + `eas submit` profile (internal track) configured
- `expo-updates` OTA wired: `runtimeVersion` policy `appVersion`, update URL in
  `app.json`, channels `preview`/`production` in `eas.json`
- Privacy policy page updated (VS Collective LLP, app disclosures, deletion
  section) and linked inside the app on the sign-in screen

Blocking, in rough order of lead time (start 1 and 2 first — they have
multi-day waits; 3 is 30 minutes):

1. **Play Console developer account** (§ 1 — verification can take days–weeks)
2. **D-U-N-S number** if registering as an organization (§ 1)
3. **Firebase `google-services.json`** — until it exists, no Android build will
   pass (DEPLOYMENT.md § Push notifications)

---

## 1. Developer account — register as the LLP

Two account types; **organization is the right call here**:

| | Organization (recommended) | Personal |
|---|---|---|
| Shows as developer | VS Collective LLP | Your name |
| D-U-N-S number | Required (free, but allow ~up to 30 days; check if the LLP already has one at dnb.com) | Not needed |
| Production access | Immediate after verification | New accounts must first run a **closed test with ~12 testers opted in for 14 continuous days**, then apply |
| Verification | Business docs (GST cert / LLP deed help), can take days–weeks | ID check, usually fast |

- Fee: **$25 one-time**. Use a Google account owned by the business
  (e.g. one on `hello@wearealive.in` via Workspace, or a dedicated Gmail).
- Details to enter: VS Collective LLP · GST 29AAXFV2589C1ZE ·
  LLP IN-KA43598411418020V · 217, Milestone 25, Balmatta, Mangalore ·
  +91 96060 72227.
- If speed matters more than the "VS Collective LLP" developer label: a
  personal account + the 14-day closed test is viable (staff + friendly
  partners ≈ 12 testers), but you can't convert personal → org later; you'd
  re-register.

## 2. Create the app in Play Console

- **Create app** → Name: `ALIVE Store` · Default language: `English (India)` ·
  Type: App · Free.
- Category: **Business**. Contact details: `hello@wearealive.in`,
  `+91 96060 72227`, `https://www.wearealive.in`.

## 3. App content declarations (Policy → App content)

Prefilled answers — these all match what the app actually does; don't improvise:

| Declaration | Answer |
|---|---|
| Privacy policy URL | `https://www.wearealive.in/privacy` |
| Account deletion URL | `https://www.wearealive.in/privacy#delete-account` |
| Ads | **No** — the app contains no ads (the business sells ads on screens; the app itself shows none) |
| App access | **All or some functionality is restricted** — provide a demo login (below) |
| Content rating questionnaire | Utility/productivity/business · no UGC visible to others · no violence/sexuality/gambling → comes out **Everyone / PEGI 3** |
| Target audience | **18 and over** only (business partners) |
| News app | No |
| Data safety | § 4 |
| Government app | No |
| Financial features | **None** — the app displays earnings but takes no payments, loans, or bank details |

**Demo login for reviewers (App access):** create ONE dedicated store account
and keep it forever (reviews re-run on every update):

- Register a store named `Play Review Demo` via the app/site with a spare
  phone number you control; note the phone + password in the App access form
  with instructions: "Sign in with the number and password above. OTP is not
  required for sign-in."
- ⚠️ There is no staging DB — this creates a real production `Store` row.
  Leave it at the earliest stage (no tier/screen assignment) so it never
  appears on public maps (it gets no pin) and never enters payouts; name it
  so ops know what it is.

## 4. Data safety form (exact answers)

Overview answers:

- Does your app collect or share user data? **Yes, collects. No sharing.**
  (Vercel/Neon/Cloudflare/Razorpay/Expo/MSG91 act as service providers on our
  behalf — under Play's definitions that is *collection*, not *sharing*.)
- All data encrypted in transit? **Yes** (TLS everywhere).
- Do you provide a way to request deletion? **Yes** → deletion URL above.

Data types to declare (everything: *Collected, Not shared, Not processed
ephemerally*):

| Play data type | What it actually is | Required? | Purpose |
|---|---|---|---|
| Personal info → Name | Owner + store name | Required | App functionality, Account management |
| Personal info → Phone number | WhatsApp number (login ID) | Required | App functionality, Account management |
| Personal info → Address | Store address | Required | App functionality |
| Personal info → Other info | PAN / Aadhaar card photos (KYC) | Required | App functionality, Fraud prevention & compliance |
| Photos and videos → Photos | KYC selfie, document + shop photos, flyers | Required | App functionality |
| Location → Approximate + Precise | One-time fix to place the shop on the network map; EXIF from shop photos | **Optional** (user can deny the permission; app still works) | App functionality |
| App info & performance → Diagnostics | Device model/OS with support requests | Optional | Analytics/diagnostics |
| Device or other IDs | Expo push token (screen-offline alerts) | Optional | App functionality |

NOT collected by the app (don't declare): email, financial/bank info (payout
details are handled off-app), contacts, calendar, SMS/call logs, browsing,
health, any background location.

## 5. Store listing

Assets:

- App icon 512×512 PNG — export from `assets/icon.png`
- **Feature graphic 1024×500 — must be created** (logo on brand red `#ef4444`
  is fine to start)
- ≥ 2 phone screenshots, portrait, ≥ 1080×1920 — take from a real device or
  emulator: suggest Overview (screen status card), Earnings, Offers, KYC
- No TV/tablet/Wear assets needed

Copy (drafts — edit freely):

- **App name:** `ALIVE Store`
- **Short description** (≤ 80 chars):
  `Partner app for ALIVE screens — earnings, offers, flyers and screen alerts.`
- **Full description** (≤ 4000 chars):

  > ALIVE Store is the app for kirana and retail store partners who host an
  > ALIVE digital screen.
  >
  > • See your screen's status and get an instant alert if it goes offline
  > • Track your monthly earnings and payout history
  > • Publish offers and flyers to shoppers in your area
  > • Complete KYC and manage your store profile
  > • Get updates from the ALIVE team on WhatsApp
  >
  > ALIVE (VS Collective LLP) puts free digital screens inside neighbourhood
  > stores across India. Store partners earn a fixed monthly income for
  > hosting a screen — no investment, no maintenance, electricity reimbursed.
  >
  > This app is for registered ALIVE store partners. Don't have a screen yet?
  > Apply at https://www.wearealive.in/store
  >
  > Support: hello@wearealive.in · WhatsApp +91 96060 72227

- Countries: **India** only.

## 6. Release flow

1. `eas build --platform android --profile production` (first run creates the
   keystore — **immediately back it up**: EAS dashboard → Credentials)
2. First upload: **manual** — download the `.aab`, Play Console → Release →
   **Internal testing** → upload, add yourselves as testers, sanity-pass on a
   real phone (login, push alert, OTA check)
3. Later uploads: `eas submit --platform android --profile production` (needs
   `google-service-account.json` per DEPLOYMENT.md Option B; it lands on the
   internal track as configured in `eas.json`)
4. Promote Internal → Production (org account) or Internal → Closed for the
   14-day window (personal account). Use a staged rollout (20% → 100%) once
   there's a real install base.
5. First production review of a brand-new app commonly takes **2–7 days**;
   subsequent updates usually clear in hours to ~1 day.

## 7. Routine afterwards

- **JS/UI change:** `eas update --branch production --message "..."` — reaches
  installed apps on next launch, minutes, no review.
- **Native change:** bump `version` in app.json → build → submit → Play
  review → phones auto-update (typically within a day on Wi-Fi).
- Old side-loaded APKs (≤ versionCode 4) never auto-update and can't receive
  OTA — walk existing partners onto the Play listing once it's live, then
  retire the WhatsApp-APK channel.
