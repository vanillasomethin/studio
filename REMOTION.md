# Offer Videos (Remotion) — POC

Auto-generate animated in-store offer/ad videos from the product catalogue.
React-based video templates (no Adobe After Effects, no Windows render box) —
the reason we chose Remotion over self-hosting nexrender.

## What's here

| Path | Purpose |
|------|---------|
| `remotion/OfferVideo.tsx` | The animated offer-card template (1920×1080, 8s). Props: product name, brand, size, price, offer line, image. |
| `remotion/Root.tsx` | Registers the `OfferVideo` composition. |
| `remotion/index.ts` | Remotion entry point (bundled separately — **not** part of the Next.js build). |
| `remotion.config.ts` | Remotion CLI config. |
| `src/lib/remotion-render.ts` | Triggers a render on **Remotion Lambda** and polls for the URL. |
| `src/app/api/admin/products/[id]/generate-video/route.ts` | Admin endpoint that renders a product's offer video. |

Admin UI: the 🎬 button on each product row in **Admin → Content/Products** renders
a video and opens a preview. Returns a clear "not configured" message until the
Lambda below is set up.

## Why rendering is off-Vercel

Remotion renders with headless Chrome + ffmpeg — too heavy for Vercel serverless.
The render runs on **AWS Lambda** (same "remote worker" pattern as the Maxun
scraper). The app only triggers + polls.

## Preview locally (no AWS needed)

```bash
npx remotion studio        # opens the template with an editable props form
```

## One-time Lambda setup

```bash
# AWS creds with Remotion Lambda permissions:
export REMOTION_AWS_ACCESS_KEY_ID=...
export REMOTION_AWS_SECRET_ACCESS_KEY=...

npx remotion lambda functions deploy --region=ap-south-1
npx remotion lambda sites create remotion/index.ts --site-name=alive-offers --region=ap-south-1
```

Then set in the deployment env:

```
REMOTION_LAMBDA_FUNCTION_NAME   # from "functions deploy" output
REMOTION_SERVE_URL              # from "sites create" output
REMOTION_REGION=ap-south-1
REMOTION_AWS_ACCESS_KEY_ID
REMOTION_AWS_SECRET_ACCESS_KEY
```

## Follow-ups (not in POC)

- Save the rendered MP4 into R2 + create a `Content` row so it can be scheduled to screens directly.
- More templates (multi-product, price-drop, store flyer) selectable per render.
- Trigger from the store-partner flyer flow, not just admin products.
