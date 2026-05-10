'use client';

import { useEffect, useState } from 'react';
import { Loader2, ListVideo, Plus, Trash2, AlertCircle } from 'lucide-react';
import { getPlaylists, deletePlaylist, type Playlist } from '@/lib/backend-api';

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const inp = 'w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all';

export default function PlaylistsTab() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [newName,   setNewName]   = useState('');
  const [creating,  setCreating]  = useState(false);

  useEffect(() => {
    getPlaylists()
      .then(setPlaylists)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const del = async (id: string) => {
    if (!confirm('Delete this playlist?')) return;
    setDeleting(id);
    try {
      await deletePlaylist(id);
      setPlaylists((p) => p.filter((x) => x.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { createPlaylist } = await import('@/lib/backend-api');
      const pl = await createPlaylist({ name: newName.trim(), items: [] });
      setPlaylists((p) => [pl, ...p]);
      setNewName('');
    } catch { /* ignore */ }
    finally { setCreating(false); }
  };

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Backend not reachable</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* New playlist form */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">New playlist</h2>
        <form onSubmit={create} className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Playlist name (e.g. FMCG Brands Jul 2025)"
            className={inp}
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </button>
        </form>
        <p className="text-[10px] text-muted-foreground/60 mt-2">Add media items to a playlist via ALIVE-Backend or the Schedule Builder once content is uploaded.</p>
      </div>

      {!playlists.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">No playlists yet.</p>
      ) : (
        <div className="space-y-2">
          {playlists.map((pl) => (
            <div key={pl.id} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ListVideo className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{pl.name}</p>
                <p className="text-xs text-muted-foreground">{pl.items.length} items · Created {fmtDate(pl.createdAt)}</p>
              </div>
              <button
                onClick={() => del(pl.id)}
                disabled={deleting === pl.id}
                className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-[11px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40 shrink-0"
              >
                {deleting === pl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
