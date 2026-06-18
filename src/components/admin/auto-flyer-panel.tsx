'use client';
import { useState, useEffect, useMemo } from 'react';
import { Wand2, Loader2, CheckSquare, Square, Save, RefreshCw } from 'lucide-react';

type StoreRow = { id: string; storeName: string };
type Offer = {
  id: string;
  productName: string;
  weight: string | null;
  mrp: number;
  offerPrice: number;
  productImageUrl: string | null;
  validUntil: string | null;
};

const inp  = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary';
const lbl  = 'block text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 mb-1';

function todayBadgeDate(): string {
  const d = new Date();
  return `${d.getDate()} ${d.toLocaleString('en-US', { month: 'short' }).toUpperCase()}`;
}

export default function AutoFlyerPanel({ adminPassword, onSaved }: { adminPassword: string; onSaved: () => void }) {
  const headers = { 'admin-password': adminPassword };

  const [stores,   setStores]   = useState<StoreRow[]>([]);
  const [storeId,  setStoreId]  = useState('');
  const [offers,   setOffers]   = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingOffers, setLoadingOffers] = useState(false);

  const [title,       setTitle]       = useState("This Week's Best Deals");
  const [footerLine1, setFooterLine1] = useState('ALIVE — Live At Your Local Kirana');
  const [contactWebsite, setContactWebsite] = useState('wearealive.in');
  const [contactPhone,   setContactPhone]   = useState('+91 74113 24448');

  const [generating, setGenerating] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const [previewUrl,  setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [error,       setError]      = useState<string | null>(null);
  const [ok,          setOk]         = useState(false);

  useEffect(() => {
    fetch('/api/stores/save', { headers })
      .then(r => r.ok ? r.json() : [])
      .then((body) => setStores(Array.isArray(body) ? body : (body?.data ?? [])))
      .catch(() => setStores([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminPassword]);

  useEffect(() => {
    setOffers([]); setSelected(new Set()); setPreviewUrl(null); setPreviewBlob(null);
    if (!storeId) return;
    setLoadingOffers(true);
    fetch(`/api/admin/store-offers?storeId=${storeId}`, { headers })
      .then(r => r.json() as Promise<Offer[]>)
      .then(setOffers)
      .catch(() => setOffers([]))
      .finally(() => setLoadingOffers(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const selectedStore = stores.find(s => s.id === storeId);

  const toggleOffer = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 9) next.add(id);
      return next;
    });
  };

  const selectedOffers = useMemo(() => offers.filter(o => selected.has(o.id)), [offers, selected]);

  const maxDiscountPercent = useMemo(() => {
    const pcts = selectedOffers.map(o => o.mrp > 0 ? Math.round(((o.mrp - o.offerPrice) / o.mrp) * 100) : 0);
    return pcts.length ? Math.max(...pcts) : 0;
  }, [selectedOffers]);

  const generate = async () => {
    if (!selectedStore || !selectedOffers.length) return;
    setGenerating(true); setError(null); setOk(false);
    try {
      const qrTarget = `https://wearealive.in/deals`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=0&data=${encodeURIComponent(qrTarget)}`;

      const body = {
        brandLogoUrl: '',
        headerTitle:    title,
        headerDate:     todayBadgeDate(),
        headerBadgeText: maxDiscountPercent > 0 ? `UP TO ${maxDiscountPercent}% OFF` : 'SPECIAL OFFERS',
        storeName:      selectedStore.storeName,
        footerLine1,
        footerLine2:    selectedStore.storeName,
        contactWebsite,
        contactPhone,
        qrCodeUrl,
        offers: selectedOffers.map(o => ({
          productName:     o.weight ? `${o.productName} (${o.weight})` : o.productName,
          productImageUrl: o.productImageUrl ?? '',
          mrp:             o.mrp,
          discountPercent: o.mrp > 0 ? Math.round(((o.mrp - o.offerPrice) / o.mrp) * 100) : 0,
          offerPrice:      o.offerPrice,
        })),
      };

      const res = await fetch('/api/generate-flyer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Generation failed (${res.status})`);
      }
      const blob = await res.blob();
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError((e as Error).message ?? 'Failed to generate flyer');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!previewBlob || !selectedStore) return;
    setSaving(true); setError(null);
    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(previewBlob);
      });

      const validUntilDates = selectedOffers.map(o => o.validUntil).filter(Boolean) as string[];
      const validUntil = validUntilDates.length
        ? validUntilDates.sort()[0]
        : new Date(Date.now() + 14 * 86400000).toISOString();

      const res = await fetch('/api/flyers/save', {
        method:  'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeName:   selectedStore.storeName,
          title,
          description: `Auto-generated from ${selectedOffers.length} active offer${selectedOffers.length === 1 ? '' : 's'}`,
          validUntil:  validUntil.slice(0, 10),
          imageBase64,
        }),
      });
      const resBody = await res.json() as { error?: string };
      if (!res.ok || resBody.error) throw new Error(resBody.error ?? `HTTP ${res.status}`);

      setOk(true); setTimeout(() => setOk(false), 4000);
      setPreviewUrl(null); setPreviewBlob(null); setSelected(new Set());
      onSaved();
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save flyer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-primary" />
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Auto-generate flyer</h2>
      </div>
      <p className="text-[11px] text-muted-foreground/70 -mt-2">Pick a store and its active offers — a flyer is rendered from the live product catalogue, no design work needed.</p>

      <div>
        <label className={lbl}>Store</label>
        <select value={storeId} onChange={e => setStoreId(e.target.value)} className={inp}>
          <option value="">Select a store…</option>
          {stores.map(s => <option key={s.id} value={s.id}>{s.storeName}</option>)}
        </select>
      </div>

      {storeId && (
        <div>
          <label className={lbl}>Offers ({selected.size}/9 selected)</label>
          {loadingOffers ? (
            <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : !offers.length ? (
            <p className="text-xs text-muted-foreground/60 py-3">No active offers for this store yet.</p>
          ) : (
            <div className="max-h-56 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {offers.map(o => {
                const checked = selected.has(o.id);
                const disabled = !checked && selected.size >= 9;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleOffer(o.id)}
                    disabled={disabled}
                    className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted/50'} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {checked ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" /> : <Square className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />}
                    <span className="flex-1 truncate">{o.productName}{o.weight ? ` (${o.weight})` : ''}</span>
                    <span className="text-muted-foreground/60 shrink-0">₹{o.offerPrice} <span className="line-through">₹{o.mrp}</span></span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div><label className={lbl}>Offer title</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inp} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Website</label>
          <input type="text" value={contactWebsite} onChange={e => setContactWebsite(e.target.value)} className={inp} /></div>
        <div><label className={lbl}>Phone</label>
          <input type="text" value={contactPhone} onChange={e => setContactPhone(e.target.value)} className={inp} /></div>
      </div>

      {error && <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">{error}</p>}
      {ok    && <p className="text-xs text-green-600 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">Flyer published ✓</p>}

      <button
        type="button"
        onClick={() => void generate()}
        disabled={generating || !selectedOffers.length}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition-all hover:bg-muted/50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RefreshCw className="h-4 w-4" /> {previewUrl ? 'Regenerate preview' : 'Generate preview'}</>}
      </button>

      {previewUrl && (
        <div className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Flyer preview" className="w-full max-h-[480px] object-contain rounded-xl border border-border" />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Publish flyer</>}
          </button>
        </div>
      )}
    </div>
  );
}
