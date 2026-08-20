# PWA Icons

These are generated — don't hand-edit them.

```
npm run icons:pwa
```

`scripts/generate-pwa-icons.js` renders the canonical ALIVE wordmark (Poppins 800
+ red dot, matching `src/components/icons/logo.tsx`) in headless Chromium and
writes the full set. Re-run it if the wordmark ever changes.

| File                      | Size      | Purpose                              |
|---------------------------|-----------|--------------------------------------|
| icon-192.png              | 192×192   | Android home screen icon             |
| icon-512.png              | 512×512   | Android splash screen / store        |
| icon-maskable-192.png     | 192×192   | Android adaptive icon (safe zone)    |
| icon-maskable-512.png     | 512×512   | Android adaptive icon (safe zone)    |
| apple-touch-icon.png      | 180×180   | iOS home screen icon                 |

The maskable variants render the mark smaller so it stays inside the inner 80%
safe zone — Android crops maskable icons to a circle, squircle, or rounded
square depending on the launcher.

Chrome will not fire `beforeinstallprompt` (so the install banner never appears)
unless valid 192px and 512px icons resolve, which is why these must exist.
