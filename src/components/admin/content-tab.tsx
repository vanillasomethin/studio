'use client';

import { useEffect, useState } from 'react';
import { Loader2, Film, ImageIcon, Trash2, AlertCircle } from 'lucide-react';
import { getContent, deleteContent, type Content } from '@/lib/backend-api';

function fmtBytes(b: number): string {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function ContentTab() {
  const [content,  setContent]  = useState<Content[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getContent()
      .then(setContent)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const del = async (id: string) => {
    if (!confirm('Delete this content item?')) return;
    setDeleting(id);
    try {
      await deleteContent(id);
      setContent((c) => c.filter((x) => x.id !== id));
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  };

  const images = content.filter((c) => c.type === 'image').length;
  const videos = content.filter((c) => c.type === 'video').length;
  const totalMB = content.reduce((s, c) => s + c.sizeBytes, 0) / (1024 * 1024);

  if (error) return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-foreground">Backend not reachable</p>
        <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
        <p className="text-xs text-muted-foreground/60 mt-2">
          Content is managed via ALIVE-Backend. Set <code className="text-primary">NEXT_PUBLIC_BACKEND_URL</code> to connect.
        </p>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Images', value: images, icon: ImageIcon, color: 'text-blue-500'  },
          { label: 'Videos', value: videos, icon: Film,      color: 'text-purple-500' },
          { label: 'Storage', value: `${totalMB.toFixed(1)} MB`, icon: Film, color: 'text-orange-500' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <s.icon className={`h-4 w-4 ${s.color} mb-2`} />
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload note */}
      <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        Upload media via the ALIVE-Backend admin API or S3 bucket directly. Files uploaded there will appear here once the backend is connected.
      </div>

      {!content.length ? (
        <p className="text-sm text-muted-foreground text-center py-10">No content in library yet.</p>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                {['Name', 'Type', 'Size', 'MD5', 'Uploaded'].map((h) => (
                  <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {content.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.type === 'video' ? 'bg-purple-500/10 text-purple-600' : 'bg-blue-500/10 text-blue-600'
                    }`}>
                      {c.type === 'video' ? <Film className="h-2.5 w-2.5" /> : <ImageIcon className="h-2.5 w-2.5" />}
                      {c.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtBytes(c.sizeBytes)}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground/60">{c.md5.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-muted-foreground/60">{fmtDate(c.uploadedAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => del(c.id)}
                      disabled={deleting === c.id}
                      className="flex items-center gap-1 rounded-lg border border-destructive/30 bg-destructive/5 px-2 py-1 text-[10px] font-semibold text-destructive hover:bg-destructive/15 transition-colors disabled:opacity-40"
                    >
                      {deleting === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
