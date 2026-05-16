'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Trash2, Tag, TrendingDown, AlertCircle } from 'lucide-react';

type Offer = {
  id:          string;
  productName: string;
  weight:      string | null;
  mrp:         number;
  offerPrice:  number;
  validUntil:  string | null;
  createdAt:   string;
};

type FormState = {
  productName: string;
  weight:      string;
  mrp:         string;
  offerPrice:  string;
  validUntil:  string;
};

const EMPTY_FORM: FormState = { productName: '', weight: '', mrp: '', offerPrice: '', validUntil: '' };

function savings(mrp: number, offer: number) {
  return Math.round(((mrp - offer) / mrp) * 100);
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

const UNIT_SUGGESTIONS = ['250 g', '500 g', '1 kg', '2 kg', '5 kg', '100 ml', '200 ml', '500 ml', '1 L', '1 pcs', '6 pcs', '12 pcs', '1 pack'];

export default function OffersTab() {
  const [offers,  setOffers]  = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState<FormState>(EMPTY_FORM);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stores/offers');
      if (res.ok) setOffers(await res.json() as Offer[]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void fetchOffers(); }, [fetchOffers]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const mrpNum   = parseFloat(form.mrp)       || 0;
  const offerNum = parseFloat(form.offerPrice) || 0;
  const savePct  = mrpNum > 0 && offerNum > 0 && offerNum < mrpNum ? savings(mrpNum, offerNum) : 0;

  const canSubmit = form.productName.trim() && mrpNum > 0 && offerNum > 0 && offerNum < mrpNum;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/stores/offers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          productName: form.productName.trim(),
          weight:      form.weight.trim() || undefined,
          mrp:         mrpNum,
          offerPrice:  offerNum,
          validUntil:  form.validUntil || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error); }
      const newOffer = await res.json() as Offer;
      setOffers((p) => [newOffer, ...p]);
      setForm(EMPTY_FORM);
    } catch (e) { setError((e as Error).message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/stores/offers/${id}`, { method: 'DELETE' });
      setOffers((p) => p.filter((o) => o.id !== id));
    } finally { setDeleting(null); }
  };

  return (
    <div className="space-y-4">

      {/* Add offer form */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Add a product offer</h2>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          {/* Product name + weight */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Product name</label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => set('productName', e.target.value)}
                placeholder="e.g. Aashirvaad Atta"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Weight / qty</label>
              <input
                type="text"
                value={form.weight}
                onChange={(e) => set('weight', e.target.value)}
                placeholder="e.g. 1 kg"
                list="weight-suggestions"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <datalist id="weight-suggestions">
                {UNIT_SUGGESTIONS.map((u) => <option key={u} value={u} />)}
              </datalist>
            </div>
          </div>

          {/* MRP + offer price */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">MRP (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">₹</span>
                <input
                  type="number"
                  min="1"
                  value={form.mrp}
                  onChange={(e) => set('mrp', e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl border border-border bg-background pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Offer price (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-green-500 font-semibold">₹</span>
                <input
                  type="number"
                  min="1"
                  value={form.offerPrice}
                  onChange={(e) => set('offerPrice', e.target.value)}
                  placeholder="0"
                  className={`w-full rounded-xl border bg-background pl-7 pr-3 py-2.5 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 transition-all ${
                    offerNum >= mrpNum && offerNum > 0
                      ? 'border-destructive focus:border-destructive focus:ring-destructive/20 text-destructive'
                      : 'border-border focus:border-primary focus:ring-primary/20 text-foreground'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Live savings preview */}
          {savePct > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-green-500/8 border border-green-500/20 px-3 py-2">
              <TrendingDown className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <p className="text-xs text-green-700 font-semibold">
                Customer saves ₹{mrpNum - offerNum} ({savePct}% off MRP)
              </p>
            </div>
          )}
          {offerNum >= mrpNum && offerNum > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Offer price must be less than MRP
            </p>
          )}

          {/* Valid until */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              Valid until <span className="normal-case font-normal text-muted-foreground/50">(optional)</span>
            </label>
            <input
              type="date"
              value={form.validUntil}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => set('validUntil', e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {error && (
            <p className="flex items-center gap-1.5 text-xs text-destructive rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || saving}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 py-3 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(220,38,38,0.35)] hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Add offer'}
          </button>
        </form>
      </div>

      {/* Offer list */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Active offers</h2>
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full">{offers.length} offer{offers.length !== 1 ? 's' : ''}</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : offers.length === 0 ? (
          <div className="px-5 py-10 text-center space-y-2">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">No offers yet — add one above to display it on the deals page.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {offers.map((offer) => {
              const save = savings(offer.mrp, offer.offerPrice);
              const expired = offer.validUntil && new Date(offer.validUntil) < new Date();
              return (
                <div key={offer.id} className={`flex items-center gap-3 px-5 py-4 ${expired ? 'opacity-50' : ''}`}>
                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{offer.productName}</p>
                      {offer.weight && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{offer.weight}</span>
                      )}
                      {expired && (
                        <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">Expired</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground line-through">MRP ₹{offer.mrp}</span>
                      <span className="text-sm font-bold text-green-600">₹{offer.offerPrice}</span>
                      <span className="rounded-full bg-green-500/10 px-1.5 py-0.5 text-[9px] font-bold text-green-600 uppercase tracking-wide">{save}% off</span>
                    </div>
                    {offer.validUntil && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Until {fmtDate(offer.validUntil)}</p>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(offer.id)}
                    disabled={deleting === offer.id}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/8 transition-all disabled:opacity-30"
                  >
                    {deleting === offer.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {offers.length > 0 && (
          <div className="border-t border-border px-5 py-2.5">
            <p className="text-[10px] text-muted-foreground/50">
              Offers are shown to customers on the <a href="/deals" target="_blank" rel="noreferrer" className="text-primary hover:underline">deals page</a> and in the ALIVE customer app.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
