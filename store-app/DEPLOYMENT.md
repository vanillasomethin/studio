# ALIVE Store — Android Deployment

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Node.js ≥ 18 | `node -v` to check |
| Expo account | Free at [expo.dev](https://expo.dev) |
| Google Play Console account | One-time $25 fee at [play.google.com/console](https://play.google.com/console) |

---

## Step 1 — Install EAS CLI

```bash
npm install -g eas-cli
eas --version   # should print 12.x or higher
```

## Step 2 — Login & link the project

```bash
cd store-app
eas login                 # enter your expo.dev credentials
eas build:configure       # creates / links the EAS project, writes projectId into app.json
```

After `eas build:configure`, open `app.json` and confirm `extra.eas.projectId` is filled in.

## Step 3 — Install dependencies

```bash
npm install
```

---

## Building

### Internal test APK (share via WhatsApp / Drive)

```bash
eas build --platform android --profile preview
```

- Produces a direct-install **.apk**
- No Play Store account needed
- Download link emailed + shown in EAS dashboard
- Install on any Android phone with "Unknown sources" enabled

### Production AAB (Play Store)

```bash
eas build --platform android --profile production
```

- Produces a signed **.aab** (Android App Bundle)
- EAS manages the keystore automatically on first build — **back it up** from the EAS dashboard
- Download the `.aab` from the EAS dashboard

---

## Step 4 — Publish to Play Store

### Option A — Manual upload (recommended for first release)

1. Go to [Play Console](https://play.google.com/console) → **Create app**
2. Fill in: App name = **ALIVE Store**, Default language = **Hindi / English**, App category = **Business**
3. Complete the store listing (description, screenshots, icon)
4. Go to **Release → Internal testing → Create new release**
5. Upload the `.aab` from the EAS dashboard
6. Roll out to internal testers first, then promote to production

### Option B — `eas submit` (automated)

1. Create a Google Play service account:
   - Play Console → Setup → API access → Link to Google Cloud project
   - Create a service account with **Release Manager** role
   - Download the JSON key → save as `store-app/google-service-account.json`
   - Add `google-service-account.json` to `.gitignore`

2. Submit:
   ```bash
   eas submit --platform android --profile production
   ```

---

## Updating the app

Every new release to Play Store **must** bump `versionCode` in `app.json`:

```json
"versionCode": 2   ← increment this each time
```

Then rebuild + submit:

```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

---

## Build profiles summary

| Profile | Output | Use for |
|---------|--------|--------|
| `development` | APK | Local dev with Expo Go / dev client |
| `preview` | APK | Internal testing, share directly |
| `production` | AAB | Play Store releases |

---

## Secrets & signing

- EAS automatically generates and stores the Android keystore on first production build.
- **Critical:** Download and back up the keystore from the EAS dashboard (Setup → Credentials). Losing it means you cannot update the Play Store app.
- Never commit `google-service-account.json` to git.
