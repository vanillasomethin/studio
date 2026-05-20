# PWA Icons

Generate these files from the ALIVE logo SVG and place them here.

## Required files

| File                      | Size      | Purpose                              |
|---------------------------|-----------|--------------------------------------|
| icon-192.png              | 192×192   | Android home screen icon             |
| icon-512.png              | 512×512   | Android splash screen / store        |
| icon-maskable-192.png     | 192×192   | Android adaptive icon (safe zone)    |
| icon-maskable-512.png     | 512×512   | Android adaptive icon (safe zone)    |
| apple-touch-icon.png      | 180×180   | iOS home screen icon                 |

## Quick generation (Node.js)

Install sharp once:
```
npm install -D sharp
```

Then run:
```js
const sharp = require('sharp');
const sizes = [192, 512];
for (const s of sizes) {
  sharp('../../favicon.svg').resize(s, s).png().toFile(`icon-${s}.png`);
  sharp('../../favicon.svg').resize(s, s).png().toFile(`icon-maskable-${s}.png`);
}
sharp('../../favicon.svg').resize(180, 180).png().toFile('apple-touch-icon.png');
```

## Free online tools

- https://www.pwabuilder.com/imageGenerator — upload your SVG, download all sizes
- https://realfavicongenerator.net — comprehensive favicon + PWA icon pack

## Maskable icon note

The maskable icon needs 10% safe-zone padding (the logo should be centred with 
at least 10% white/red background margin on all sides). Use pwabuilder.com's 
image generator which handles this automatically.
