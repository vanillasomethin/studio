'use client';

import { useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ContentThumb, type ContentLike } from '@/components/admin/content-picker';

type VideoPreviewTooltipProps = {
  content: ContentLike | null;
  className?: string;
  children?: React.ReactNode;
};

export function VideoPreviewTooltip({ content, className, children }: VideoPreviewTooltipProps) {
  const [open, setOpen] = useState(false);

  if (!content || content.type !== 'video') {
    return children ? <>{children}</> : <ContentThumb content={content} className={className} />;
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <div>
          {children ? children : <ContentThumb content={content} className={className} />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="w-auto p-0 border-0 bg-transparent shadow-none" asChild>
        <div className="rounded-lg border border-border overflow-hidden bg-black/90 shadow-lg">
          <video
            src={content.url}
            controls
            autoPlay
            className="max-w-xs max-h-64 rounded-lg"
            onMouseLeave={() => setOpen(false)}
          />
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
