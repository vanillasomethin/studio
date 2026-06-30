'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, Ticket, Trash2, Power, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Coupon = {
  id: string;
  code: string;
  type: 'FLAT' | 'PERCENT';
  value: number;
  active: boolean;
  expiresAt: string | null;
  maxRedemptions: number | null;
  redemptions: number;
  note: string | null;
  createdAt: string;
};

const authHeaders = () => ({
  'admin-password': sessionStorage.getItem('alive_admin_pw') ?? '',
  'Content-Type': 'application/json',
});

const FORM_INIT = { code: '', type: 'FLAT' as 'FLAT' | 'PERCENT', value: '', expiresAt: '', maxRedemptions: '', note: '' };

export default function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(FORM_INIT);
  const [creating, setCreating] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/coupons', { headers: authHeaders() });
      const body = await res.json() as { coupons?: Coupon[] };
      setCoupons(body.coupons ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          code:           form.code,
          type:           form.type,
          value:          Number(form.value),
          expiresAt:      form.expiresAt || null,
          maxRedemptions: form.maxRedemptions ? Number(form.maxRedemptions) : null,
          note:           form.note || null,
        }),
      });
      const body = await res.json() as { coupon?: Coupon; error?: string };
      if (!res.ok || !body.coupon) { setError(body.error ?? 'Could not create coupon.'); return; }
      setForm(FORM_INIT);
      await load();
    } catch { setError('Could not create coupon.'); }
    finally { setCreating(false); }
  };

  const toggle = async (c: Coupon) => {
    await fetch(`/api/coupons/${c.id}`, { method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ active: !c.active }) });
    await load();
  };

  const remove = async (c: Coupon) => {
    if (!confirm(`Delete coupon ${c.code}? This cannot be undone.`)) return;
    await fetch(`/api/coupons/${c.id}`, { method: 'DELETE', headers: authHeaders() });
    await load();
  };

  const discountLabel = (c: Coupon) => c.type === 'PERCENT' ? `${c.value}% off` : `₹${c.value} off`;
  const isExpired = (c: Coupon) => c.expiresAt != null && new Date(c.expiresAt).getTime() < Date.now();
  const isMaxed   = (c: Coupon) => c.maxRedemptions != null && c.redemptions >= c.maxRedemptions;

  return (
    <div className="space-y-6">
      <div className="page__head">
        <div>
          <h1 className="page__title"><span className="red">Coupons</span></h1>
          <p className="page__sub">Promo codes brands can apply during onboarding.</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Create form */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-neutral-100"><Plus className="h-4 w-4" /></span>
          <p className="text-sm font-bold text-foreground">New coupon</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Code</label>
            <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
              placeholder="DIWALI200" maxLength={24}
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-xs font-mono uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Type</label>
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as 'FLAT' | 'PERCENT' }))}
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="FLAT">₹ off</option>
              <option value="PERCENT">% off</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{form.type === 'PERCENT' ? 'Percent' : 'Rupees'}</label>
            <input value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value.replace(/\D/g, '') }))}
              inputMode="numeric" placeholder={form.type === 'PERCENT' ? '20' : '200'}
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Expires</label>
            <input type="date" value={form.expiresAt} onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-2 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Max uses</label>
            <input value={form.maxRedemptions} onChange={(e) => setForm((f) => ({ ...f, maxRedemptions: e.target.value.replace(/\D/g, '') }))}
              inputMode="numeric" placeholder="∞"
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="col-span-2 sm:col-span-2 lg:col-span-5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Label (internal)</label>
            <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Diwali 2026 campaign"
              className="mt-1 w-full h-9 rounded-lg border border-border bg-background px-3 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="flex items-end">
            <button onClick={create} disabled={creating || !form.code || !form.value}
              className="w-full h-9 rounded-lg bg-primary text-xs font-bold text-white transition-all hover:bg-primary/90 disabled:opacity-40 flex items-center justify-center gap-1.5">
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Create
            </button>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Ticket className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No coupons yet. Create one above.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {coupons.map((c) => {
              const dead = !c.active || isExpired(c) || isMaxed(c);
              return (
                <div key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="font-mono text-sm font-bold text-foreground">{c.code}</span>
                  <Badge variant="brand" className="text-[10px] py-0.5 px-2 font-bold">{discountLabel(c)}</Badge>
                  {dead
                    ? <Badge variant="warning" className="text-[10px] py-0.5 px-2 font-bold">{isExpired(c) ? 'Expired' : isMaxed(c) ? 'Used up' : 'Paused'}</Badge>
                    : <Badge variant="success" className="text-[10px] py-0.5 px-2 font-bold">Active</Badge>}
                  <div className="ml-auto flex items-center gap-4 text-[11px] text-muted-foreground">
                    {c.note && <span className="hidden md:inline truncate max-w-[180px]" title={c.note}>{c.note}</span>}
                    <span className="font-mono whitespace-nowrap">
                      {c.redemptions}{c.maxRedemptions != null ? ` / ${c.maxRedemptions}` : ''} used
                    </span>
                    {c.expiresAt && <span className="font-mono whitespace-nowrap hidden sm:inline">exp {new Date(c.expiresAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>}
                    <button onClick={() => toggle(c)} title={c.active ? 'Pause' : 'Activate'}
                      className={`inline-flex items-center justify-center h-7 w-7 rounded-lg border transition-colors ${c.active ? 'border-border text-muted-foreground hover:text-foreground' : 'border-green-200 bg-green-50 text-green-700'}`}>
                      <Power className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => remove(c)} title="Delete"
                      className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
