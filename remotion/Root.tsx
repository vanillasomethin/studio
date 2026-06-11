// Remotion composition registry. Preview with `npx remotion studio`.

import { Composition } from 'remotion';
import { OfferVideo, offerVideoDefaults } from './OfferVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="OfferVideo"
      component={OfferVideo}
      durationInFrames={240}   // 8s @ 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={offerVideoDefaults}
    />
  );
};
