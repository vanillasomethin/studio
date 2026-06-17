// Remotion CLI config (preview + local render + Lambda deploy). Does not affect
// the Next.js build — Remotion bundles ./remotion separately.

import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setEntryPoint('./remotion/index.ts');
