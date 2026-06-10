# ALIVE Store App

React Native / Expo mobile app for store partners (Android-first).

## Screens

| Screen | Path |
|--------|------|
| Sign in + forgot password | `app/(auth)/sign-in.tsx` |
| Register step 1 — store details + location | `app/(auth)/register/index.tsx` |
| Register step 2 — agreement + digital signature | `app/(auth)/register/agreement.tsx` |
| Dashboard: Overview (timeline, referral, agreement) | `app/(dashboard)/index.tsx` |
| Dashboard: Earnings + monthly claim | `app/(dashboard)/earnings.tsx` |
| Dashboard: Offers (post / delete deals) | `app/(dashboard)/offers.tsx` |
| Dashboard: Flyers (upload + gallery) | `app/(dashboard)/flyers.tsx` |
| Dashboard: KYC (PAN, Aadhaar, selfie) | `app/(dashboard)/kyc.tsx` |

## Backend

All API calls go to `https://wearealive.in` — the existing Studio backend.

| Endpoint | Purpose |
|----------|---------|
| `POST /api/stores/login` | Sign in with WhatsApp + password |
| `POST /api/stores/save` | Register store |
| `GET /api/stores/me` | Fetch store session |
| `PATCH /api/stores/me` | Update store (email, payout info) |
| `POST /api/stores/reset-password` | Request/verify OTP for password reset |
| `GET /api/stores/offers` | List store offers |
| `POST /api/stores/offers` | Post a new offer |
| `DELETE /api/stores/offers/:id` | Delete offer |
| `POST /api/stores/kyc` | Upload KYC document |
| `POST /api/payout-claim` | Submit monthly payout claim |

## Auth & session

Session is stored in `expo-secure-store` (`alive_store_session` key). On first launch `app/index.tsx` reads the key and routes to sign-in or dashboard.

## Run locally

```bash
cd store-app
npm install
npx expo start          # opens Expo Go / Metro dev server
npx expo start --android  # runs directly on connected Android device/emulator
```

## Build APK for Android

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

Requires an EAS account and `eas.json` (see [Expo docs](https://docs.expo.dev/build/setup/)).

## Colors / branding

All color constants live in `lib/colors.ts`. Primary is ALIVE red (`#ef4444`).
