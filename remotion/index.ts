// Remotion entry point — bundled separately by the Remotion CLI / Lambda deploy.
// Not imported by the Next.js app (the app only triggers renders via @remotion/lambda).

import { registerRoot } from 'remotion';
import { RemotionRoot } from './Root';

registerRoot(RemotionRoot);
