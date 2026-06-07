// Remotion offer-video rendering. Remotion renders with headless Chrome + ffmpeg —
// it CANNOT run on Vercel serverless (binary size + time limits), so the actual
// render happens on AWS Lambda (Remotion Lambda). This app only triggers the render
// and polls for the result, exactly like the Maxun client only calls a remote scraper.
//
// One-time setup (CLI, done by an operator — not at runtime):
//   npx remotion lambda functions deploy
//   npx remotion lambda sites create remotion/index.ts --site-name=alive-offers
// then set the env vars below from the command output.
//
// Env:
//   REMOTION_LAMBDA_FUNCTION_NAME   deployed function name
//   REMOTION_SERVE_URL              deployed site (serve) URL
//   REMOTION_REGION                 e.g. ap-south-1 (Mumbai)
//   REMOTION_AWS_ACCESS_KEY_ID      read automatically by Remotion Lambda
//   REMOTION_AWS_SECRET_ACCESS_KEY  read automatically by Remotion Lambda

import type { AwsRegion } from '@remotion/lambda-client';
import { getRenderProgress, renderMediaOnLambda } from '@remotion/lambda/client';
import type { OfferVideoProps } from '../../remotion/OfferVideo';

const COMPOSITION_ID = 'OfferVideo';

function lambdaConfigured(): boolean {
  return !!(process.env.REMOTION_LAMBDA_FUNCTION_NAME && process.env.REMOTION_SERVE_URL && process.env.REMOTION_REGION);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Trigger a Lambda render and poll until it finishes. Returns the output video URL.
export async function renderOfferVideo(props: OfferVideoProps): Promise<string> {
  if (!lambdaConfigured()) {
    throw new Error('Remotion Lambda not configured. Set REMOTION_LAMBDA_FUNCTION_NAME, REMOTION_SERVE_URL and REMOTION_REGION.');
  }

  const region       = process.env.REMOTION_REGION as AwsRegion;
  const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME!;
  const serveUrl     = process.env.REMOTION_SERVE_URL!;

  const { renderId, bucketName } = await renderMediaOnLambda({
    region,
    functionName,
    serveUrl,
    composition: COMPOSITION_ID,
    inputProps:  props,
    codec:       'h264',
    imageFormat: 'jpeg',
    privacy:     'public',
    downloadBehavior: { type: 'play-in-browser' },
  });

  // Poll for completion (Lambda renders an 8s clip in well under a minute).
  const deadline = Date.now() + 110_000;
  while (Date.now() < deadline) {
    const progress = await getRenderProgress({ renderId, bucketName, functionName, region });
    if (progress.fatalErrorEncountered) {
      throw new Error(progress.errors[0]?.message ?? 'Render failed');
    }
    if (progress.done && progress.outputFile) {
      return progress.outputFile;
    }
    await sleep(2_500);
  }
  throw new Error('Render timed out');
}
