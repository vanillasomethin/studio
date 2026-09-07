// Renders the ALIVE wordmark to the PWA icon set in public/icons/.
// Run: npm run icons:pwa
//
// Maskable variants keep the mark inside the inner 80% safe zone, since Android
// crops maskable icons to arbitrary shapes (circle, squircle, rounded square).

const { chromium } = require('playwright-core');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');
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
  } finally {
    await browser.close();
  }
})();
