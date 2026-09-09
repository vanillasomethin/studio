'use client';

// House content — ALIVE's own creatives, which fill loop positions nobody bought.
//
// These are not campaigns and are managed apart from them on purpose: a campaign
// is something a brand bought and is billed for, house content is ours and is
// billed to nobody. Modelling them as one thing is what put filler in the
// campaigns list, the booking picker and revenue reports.
//
// What an operator needs to see at a glance, per the house UI rule: which filler
// the fleet falls back to, whether it can actually play, and how many stores
// override it. All three are on the card face; the rest is behind a click.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, AlertCircle, Plus, Trash2, Star, Check, X, Film, ListVideo, Power,
} from 'lucide-react';
import { ContentThumb, ContentPickerField, type ContentLike } from './content-picker';
import { PlaylistPickerField } from './playlist-picker';

type FillerContent = ContentLike & { durationMs: number | null };

type Filler = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  contentId: string | null;
  playlistId: string | null;
  content: FillerContent | null;
  playlist: { id: string; name: string; itemCount: number } | null;
  storeCount: number;
  isDefault: boolean;
};

type ContentRow = ContentLike & { durationMs?: number };
type PlaylistRow = { id: string; name: string; itemCount: number };

const SLOT_MS = 10_000;

/** A filler fills single empty positions, so every creative must be one slot. */
const isOneSlot = (ms: number | null | undefined) =>
  typeof ms === 'number' && ms > 0 && Math.ceil(ms / SLOT_MS) === 1;

export default function FillersTab() {
  const [fillers,   setFillers]   = useState<Filler[]>([]);
  const [content,   setContent]   = useState<ContentRow[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [busy,      setBusy]      = useState<string | null>(null);

  const [adding,  setAdding]  = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, c, p] = await Promise.all([
        fetch('/api/admin/fillers').then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))),
        fetch('/api/content').then((r) => (r.ok ? r.json() : { content: [] })).catch(() => ({ content: [] })),
        fetch('/api/playlists').then((r) => (r.ok ? r.json() : { playlists: [] })).catch(() => ({ playlists: [] })),
      ]);
      setFillers(f.fillers ?? []);
      setDefaultId(f.defaultFillerId ?? null);
      setContent(Array.isArray(c) ? c : (c.content ?? []));
      const rawPlaylists: { id: string; name: string; items?: unknown[] }[] = Array.isArray(p) ? p : (p.playlists ?? []);
      setPlaylists(rawPlaylists.map((pl) => ({ id: pl.id, name: pl.name, itemCount: pl.items?.length ?? 0 })));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const call = async (init: RequestInit & { url?: string }, id = 'x') => {
    setBusy(id);
    try {
      const res = await fetch(init.url ?? '/api/admin/fillers', init);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      setError(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const create = () => {
    if (!newName.trim()) return;
    void call({
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }, 'new').then(() => { setNewName(''); setAdding(false); });
  };

  const patch = (id: string, body: Record<string, unknown>) =>
    call({ method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }, id);

  const remove = (id: string) =>
    call({ method: 'DELETE', url: `/api/admin/fillers?id=${encodeURIComponent(id)}` }, id);

  // The fleet default lives on PlayerConfig, which the slot settings route owns.
  const makeDefault = (id: string) =>
    call({
      url: '/api/slots/settings', method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultFillerCreativeId: id }),
    }, id);

  const playable = (f: Filler) =>
    f.active && (!!f.contentId || (f.playlist?.itemCount ?? 0) > 0);

  if (loading && fillers.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading house content…</p>;
  }

  const nothingPlayable = fillers.length > 0 && !fillers.some((f) => f.isDefault && playable(f));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-foreground">House content</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            ALIVE&apos;s own creatives, played in loop positions nobody bought. Not campaigns — nothing here is billed,
            and none of it appears in the brands&apos; lists.
          </p>
        </div>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Plus className="h-3 w-3" /> New filler
        </button>
      </div>

      {/* The one failure that matters: no usable default means unsold positions
          have nothing to play, which is the outcome the loop exists to prevent. */}
      {nothingPlayable && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">No playable fleet default.</strong> Stores with unsold positions fall back
            to replaying sold campaigns; if a store has no sales that day, its screen has nothing to show. Mark an active
            filler with a creative as the default.
          </p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      )}

      {adding && (
        <div className="flex gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') setAdding(false); }}
            placeholder="Name it — e.g. House ads, Diwali filler"
            className="flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs"
          />
          <button
            onClick={create}
            disabled={!newName.trim() || busy === 'new'}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            {busy === 'new' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Create
          </button>
          <button onClick={() => setAdding(false)} className="rounded-lg border border-border px-2 py-1.5 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {fillers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/10 py-12 text-center">
          <Film className="mx-auto h-6 w-6 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">No house content yet.</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Create one and point it at a creative or a playlist.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fillers.map((f) => {
            const ok = playable(f);
            return (
              <div key={f.id} className={`rounded-xl border bg-card p-4 ${f.isDefault ? 'border-primary/40' : 'border-border'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-foreground">{f.name}</p>
                      {f.isDefault && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          <Star className="h-2.5 w-2.5" /> Fleet default
                        </span>
                      )}
                      {!f.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">Off</span>
                      )}
                      {!ok && f.active && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600">
                          No creative
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {f.content && <ContentThumb content={f.content} className="h-6 w-9" />}
                      {f.content
                        ? <>Single creative · <span className="text-foreground">{f.content.name}</span>
                            {!isOneSlot(f.content.durationMs) && <span className="ml-1 text-amber-600">(longer than one slot)</span>}</>
                        : f.playlist
                          ? <>Playlist · <span className="text-foreground">{f.playlist.name}</span> · {f.playlist.itemCount} item{f.playlist.itemCount === 1 ? '' : 's'} rotating</>
                          : 'Nothing attached yet'}
                      {f.storeCount > 0 && <> · {f.storeCount} store{f.storeCount === 1 ? '' : 's'} pick this one</>}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {!f.isDefault && (
                      <button
                        onClick={() => makeDefault(f.id)}
                        disabled={!ok || busy === f.id}
                        title={ok ? 'Use this everywhere unless a store overrides it' : 'Attach a creative first'}
                        className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40"
                      >
                        <Star className="h-3 w-3" /> Make default
                      </button>
                    )}
                    <button
                      onClick={() => patch(f.id, { active: !f.active })}
                      disabled={busy === f.id}
                      title={f.active ? 'Take out of rotation' : 'Put back in rotation'}
                      className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                    >
                      <Power className="h-3 w-3" /> {f.active ? 'Turn off' : 'Turn on'}
                    </button>
                    <button
                      onClick={() => remove(f.id)}
                      disabled={busy === f.id}
                      title={f.isDefault ? 'Pick another default first' : 'Delete'}
                      className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                    >
                      {busy === f.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Point it at one creative OR a rotating playlist. Only one-slot
                    creatives are offered: filler fills single empty positions, and
                    the API rejects anything longer anyway. */}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <Film className="h-3 w-3" /> Single creative
                    </span>
                    <ContentPickerField
                      content={content}
                      value={f.contentId}
                      onChange={(id) => patch(f.id, { contentId: id })}
                      filter={(c) => isOneSlot(c.durationMs)}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      <ListVideo className="h-3 w-3" /> …or a rotating playlist
                    </span>
                    <PlaylistPickerField
                      playlists={playlists}
                      value={f.playlistId}
                      onChange={(id) => patch(f.id, { playlistId: id })}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A store can override the fleet default in <strong className="text-foreground">Programming → Slots → store settings</strong>.
        Setting one of the two pickers above clears the other — a filler plays a single creative or a playlist, never both.
      </p>
    </div>
  );
}
