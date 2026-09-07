// Renders the ALIVE wordmark to the PWA icon set in public/icons/, and the
// browser-tab favicon at src/app/favicon.ico.
// Run: npm run icons:pwa
//
// Maskable variants keep the mark inside the inner 80% safe zone, since Android
// crops maskable icons to arbitrary shapes (circle, squircle, rounded square).
//
// The favicon does NOT use the full wordmark. At 16px "alive•" is a smudge, so
// the tab icon is the mark's distinctive part — the a with its red dot — on the
// same white ground. Same brand, legible at the size it is actually seen.

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
// Next serves app/favicon.ico at /favicon.ico, and it takes precedence over
// app/icon.tsx for the .ico link — so this is the file a browser tab shows.
const FAVICON = path.join(__dirname, '..', 'src', 'app', 'favicon.ico');
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

// scale = wordmark width as a fraction of the icon width
const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 0.78 },
  { file: 'icon-512.png', size: 512, scale: 0.78 },
  { file: 'icon-maskable-192.png', size: 192, scale: 0.56 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.56 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.78 },
];

const page$html = (size, scale) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;}
  body{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:#ffffff;}
  .mark{
    font-family:"Poppins",sans-serif;font-weight:800;
    font-size:${size * scale * 0.42}px;letter-spacing:-0.02em;
    color:#0a0a0a;display:inline-flex;align-items:center;line-height:1;
  }
  .dot{
    width:.18em;height:.18em;border-radius:50%;background:#dc2626;
    margin-left:.08em;display:inline-block;flex-shrink:0;transform:translateY(.04em);
  }
</style></head>
<body><span class="mark">alive<span class="dot"></span></span></body></html>`;

// The favicon sizes browsers actually ask for. 48 is used by Windows taskbar
// shortcuts and some readers.
const FAVICON_SIZES = [16, 32, 48];

const favicon$html = (size) => `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0;}
  body{width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;background:#ffffff;}
  .mark{
    font-family:"Poppins",sans-serif;font-weight:800;
    /* Sized off the icon box rather than a fixed px so 16 and 48 look alike. */
    font-size:${Math.round(size * 0.72)}px;
    color:#0a0a0a;display:inline-flex;align-items:baseline;line-height:1;
  }
  .dot{
    width:${Math.max(2, Math.round(size * 0.16))}px;
    height:${Math.max(2, Math.round(size * 0.16))}px;
    border-radius:50%;background:#dc2626;
    margin-left:${Math.max(1, Math.round(size * 0.04))}px;
    display:inline-block;flex-shrink:0;
  }
</style></head>
<body><span class="mark">a<span class="dot"></span></span></body></html>`;

/**
 * Pack PNGs into a multi-size .ico.
 *
 * ICO is a 6-byte header, one 16-byte directory entry per image, then the image
 * payloads. Every format since Vista accepts a PNG payload verbatim, so the PNGs
 * Playwright produces go in untouched — no BMP re-encoding, no extra dependency.
 * A 256px image would be written as 0 in the byte-wide width/height fields; we
 * only emit ≤48 so that case cannot arise.
 */
function buildIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);              // reserved
  header.writeUInt16LE(1, 2);              // type: 1 = icon
  header.writeUInt16LE(pngs.length, 4);    // image count

  const entries = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size, 0);                 // width
    e.writeUInt8(size, 1);                 // height
    e.writeUInt8(0, 2);                    // palette colours (0 = none)
    e.writeUInt8(0, 3);                    // reserved
    e.writeUInt16LE(1, 4);                 // colour planes
    e.writeUInt16LE(32, 6);                // bits per pixel
    e.writeUInt32LE(data.length, 8);       // payload size
    e.writeUInt32LE(offset, 12);           // payload offset
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXECUTABLE });
  try {
    for (const { file, size, scale } of TARGETS) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(page$html(size, scale), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(OUT_DIR, file), omitBackground: false });
      await page.close();
      console.log(`wrote public/icons/${file}  (${size}x${size})`);
    }

    // ── favicon.ico ──
    const pngs = [];
    for (const size of FAVICON_SIZES) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
      await page.setContent(favicon$html(size), { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      pngs.push({ size, data: await page.screenshot({ omitBackground: false }) });
      await page.close();
    }
    fs.writeFileSync(FAVICON, buildIco(pngs));
    console.log(`wrote src/app/favicon.ico  (${FAVICON_SIZES.join(', ')})`);
  } finally {
    await browser.close();
  }
})();
