'use client';

// A single-playlist picker, replacing bare <select>s of playlist names across
// the admin (schedules, screens, house content, per-store filler overrides).
// A playlist has no single image to thumbnail, so identity here is the same
// icon-box + name + item-count row already used for playlist items in
// playlists-tab.tsx — colour and shape instead of a name buried in option text.

import { useState } from 'react';
import { Check, ListVideo } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

export type PlaylistLike = { id: string; name: string; itemCount: number };

export function PlaylistRow({ playlist }: { playlist: PlaylistLike | null }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <ListVideo className="h-4 w-4 text-primary" />
      </div>
      {playlist ? (
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">{playlist.name}</span>
          <span className="block text-[10px] text-muted-foreground">
            {playlist.itemCount} item{playlist.itemCount === 1 ? '' : 's'} rotating
          </span>
        </span>
      ) : (
        <span className="flex-1 text-xs text-muted-foreground">— none —</span>
      )}
    </div>
  );
}

export function PlaylistPickerField<T extends PlaylistLike>({
  playlists, value, onChange, unplayable,
}: {
  playlists: T[];
  value: string | null;
  onChange: (id: string | null) => void;
  /** Grey out and disable rows this predicate matches, e.g. an empty playlist. */
  unplayable?: (p: T) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = playlists.find((p) => p.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full rounded-lg border border-border bg-card px-2 py-1.5 text-left transition-colors hover:border-primary/40"
        >
          <PlaylistRow playlist={selected} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        {value && (
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="mb-2 w-full rounded-lg border border-dashed border-border px-2 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
          >
            Clear selection
          </button>
        )}
        {playlists.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No playlists yet.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {playlists.map((p) => {
              const on = p.id === value;
              const off = unplayable?.(p) ?? false;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={off}
                  onClick={() => { onChange(p.id); setOpen(false); }}
                  className={`relative w-full rounded-lg border px-2 py-1.5 text-left transition-colors ${
                    off ? 'cursor-not-allowed border-transparent opacity-40' : on ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/30'
                  }`}
                >
                  <PlaylistRow playlist={p} />
                  {off && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-muted-foreground">unplayable</span>}
                  {on && !off && (
                    <div className="absolute right-2 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full bg-primary">
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
