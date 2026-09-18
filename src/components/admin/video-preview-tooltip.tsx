'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipPortal, TooltipTrigger } from '@/components/ui/tooltip';

type PreviewContent = { type: 'image' | 'video'; url: string };

type VideoPreviewTooltipProps = {
  content: PreviewContent | null;
  children: React.ReactNode;
};

/** Hover preview for a video creative.
 *
 *  Three things here are load-bearing — each one was a real failure:
 *
 *  1. NO `asChild` on TooltipContent. Radix renders the content's children plus
 *     a visually-hidden a11y span, so `asChild` hands Slot two children and
 *     `React.Children.only` throws — hovering a video crashed the whole admin
 *     page into the error boundary rather than merely failing to preview.
 *  2. Portalled to the body. The content is otherwise rendered inline, inside
 *     the Content tab's `overflow-hidden` table wrapper and the pickers'
 *     scrolling grid, which clip a 256px preview down to nothing.
 *  3. `muted`. Autoplay with sound is blocked by every browser, which left the
 *     preview on a permanently black frame.
 *
 *  Deliberately no <video controls>: a Radix tooltip closes on pointer-down, so
 *  the first click on play dismissed the preview. A hover preview is a glance;
 *  the full player lives in the Content tab's preview modal. */
export function VideoPreviewTooltip({ content, children }: VideoPreviewTooltipProps) {
  const [failed, setFailed] = useState(false);

  if (!content || content.type !== 'video') return <>{children}</>;

  return (
    <Tooltip>
      {/* inline-block, not a bare div: a block wrapper stretches to the width of
          its table cell or grid track, and Radix anchors the preview to THAT box —
          which pushed it off-screen instead of beside the thumbnail. */}
      <TooltipTrigger asChild>
        <div className="inline-block">{children}</div>
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          side="right"
          className="overflow-hidden rounded-lg border border-border bg-black/90 p-0 shadow-lg"
        >
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
              className="block max-h-64 max-w-xs rounded-lg"
              onError={() => setFailed(true)}
            />
          )}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  );
}
