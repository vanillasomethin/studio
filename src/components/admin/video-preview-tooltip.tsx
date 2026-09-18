'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type PreviewContent = { type: 'image' | 'video'; url: string };

type VideoPreviewTooltipProps = {
  content: PreviewContent | null;
  children: React.ReactNode;
};

/** Hover preview for a video creative. Deliberately has NO <video controls>:
 *  a Radix tooltip closes on pointer-down, so the controls were unusable — the
 *  first click on play dismissed the preview. A hover preview is a glance, so it
 *  autoplays muted and loops; the full player with controls is a click away in
 *  the Content tab's preview modal.
 *
 *  `muted` is load-bearing, not decoration: autoplay with sound is blocked by
 *  every browser, which left the old version showing a permanently black frame. */
export function VideoPreviewTooltip({ content, children }: VideoPreviewTooltipProps) {
  const [failed, setFailed] = useState(false);

  if (!content || content.type !== 'video') return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{children}</div>
      </TooltipTrigger>
      <TooltipContent side="right" className="w-auto border-0 bg-transparent p-0 shadow-none" asChild>
        <div className="overflow-hidden rounded-lg border border-border bg-black/90 shadow-lg">
          {failed ? (
            <p className="px-3 py-2 text-[11px] font-semibold text-white/80">Preview unavailable</p>
          ) : (
            <video
              key={content.url}
              src={content.url}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="max-h-64 max-w-xs rounded-lg"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
