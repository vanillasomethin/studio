'use client';

// A single-content picker with real thumbnails, replacing bare <select>s of
// content names across the admin — house content, per-slot fallbacks, etc.
// Per the house UI rule ("show the creative, don't hide identity behind IDs"),
// an operator should recognise a creative by its picture, not read every name
// in a dropdown. Mirrors the thumbnail grid already built for playlists-tab.tsx's
// "Add content" picker, and the Popover pattern from proof-of-play-tab.tsx's
// date-range picker.

import { useState } from 'react';
import { Check, Film, ImageIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export type ContentLike = { id: string; name: string; type: 'image' | 'video'; url: string };

/** A single content item's thumbnail — image, or a muted video frame with a
 *  film-strip corner badge. Reusable standalone wherever a card face needs to
 *  show a creative's identity, not just inside the picker below. */
export function ContentThumb({ content, className = 'h-9 w-14' }: { content: ContentLike | null; className?: string }) {
  if (!content) {
    return (
      <div className={`flex shrink-0 items-center justify-center rounded-lg bg-muted ${className}`}>
        <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>
    );
  }
  return content.type === 'image' ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={content.url} alt="" className={`shrink-0 rounded-lg bg-muted object-cover ${className}`} />
  ) : (
    <div className={`relative shrink-0 overflow-hidden rounded-lg bg-purple-500/10 ${className}`}>
      <video src={content.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
      <Film className="pointer-events-none absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-white drop-shadow" />
    </div>
  );
}

export function ContentPickerField<T extends ContentLike>({
  content, value, onChange, filter, placeholder = '— none —',
}: {
  content: T[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Narrow the offered items — e.g. house content only offers one-slot creatives. */
  filter?: (c: T) => boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const items = filter ? content.filter(filter) : content;
  const selected = content.find((c) => c.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-left text-xs transition-colors hover:border-primary/40"
        >
          <ContentThumb content={selected} className="h-7 w-11" />
          <span className={`flex-1 truncate ${selected ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {selected ? selected.name : placeholder}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="mb-2 w-full rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            Clear selection
          </button>
        )}
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Nothing to pick from.</p>
        ) : (
          <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto">
            {items.map((c) => {
              const on = c.id === value;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { onChange(c.id); setOpen(false); }}
                  className={`relative overflow-hidden rounded-lg border text-left transition-all ${
                    on ? 'border-primary ring-1 ring-primary/40' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <ContentThumb content={c} className="h-16 w-full" />
                  <p className="truncate px-1.5 py-1 text-[10px] font-semibold text-foreground">{c.name}</p>
                  {on && (
                    <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
