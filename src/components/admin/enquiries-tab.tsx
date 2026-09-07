'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Inbox,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { adminGetObject } from '@/lib/admin-fetch';
import { formatInr } from '@/lib/advertise-network';

type Status = 'new' | 'contacted' | 'won' | 'lost';

type Enquiry = {
  id: string;
  reference: string;
  brandName: string;
  contactPerson: string;
  phone: string;
  whatsapp: string | null;
  category: string | null;
  budgetBand: string | null;
  storeSlugs: string[];
  storeNames: string[];
  slotsPerStore: number;
  months: number;
  creativeStatus: string | null;
  notes: string | null;
  agreementVersion: string;
  agreementAcceptedAt: string;
  estMonthlyPaise: number;
  estTotalPaise: number;
  status: Status;
  createdAt: string;
};

// Status carries a colour AND an icon AND a word: an operator scanning the list
// should not have to distinguish red from amber to know what needs working.
const STATUS_META: Record<Status, { label: string; icon: React.ElementType; chip: string; dot: string }> = {
  new:       { label: 'New',       icon: Inbox,        chip: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
  contacted: { label: 'Contacted', icon: Phone,        chip: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  won:       { label: 'Won',       icon: CheckCircle2, chip: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-600' },
  lost:      { label: 'Lost',      icon: XCircle,      chip: 'bg-neutral-100 text-neutral-600 border-neutral-200', dot: 'bg-neutral-400' },
};

const STATUS_ORDER: Status[] = ['new', 'contacted', 'won', 'lost'];

const CREATIVE_LABEL: Record<string, string> = {
  ready: 'Creative ready',
  'not-ready': 'Creative not ready',
  'need-help': 'Wants us to make the ad',
};

const authHeaders = () => ({
  'admin-password': sessionStorage.getItem('alive_admin_pw') ?? '',
  'Content-Type': 'application/json',
});

const rupees = (paise: number) => formatInr(Math.round(paise / 100));

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} day${days === 1 ? '' : 's'} ago` : new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fullDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function EnquiriesTab() {
  const [rows, setRows] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'value'>('newest');
  const [openId, setOpenId] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await adminGetObject<{ enquiries: Enquiry[] }>('/api/admin/enquiries');
      setRows(body.enquiries ?? []);
    } catch (e) {
      // AdminAuthError already bounced to the gate; anything else is this panel's
      // problem to show rather than swallow.
      if ((e as Error).name !== 'AdminAuthError') setError('Could not load enquiries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { new: 0, contacted: 0, won: 0, lost: 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = rows.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.brandName.toLowerCase().includes(q) ||
        r.contactPerson.toLowerCase().includes(q) ||
        r.phone.includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        (r.category ?? '').toLowerCase().includes(q) ||
        r.storeNames.some(n => n.toLowerCase().includes(q))
      );
    });
    return [...matched].sort((a, b) => {
      if (sort === 'value') return b.estTotalPaise - a.estTotalPaise;
      const at = new Date(a.createdAt).getTime();
      const bt = new Date(b.createdAt).getTime();
      return sort === 'oldest' ? at - bt : bt - at;
    });
  }, [rows, filter, query, sort]);

  const setStatus = async (row: Enquiry, status: Status) => {
    if (row.status === status) return;
    setSaving(row.id);
    // Optimistic: the row moves the moment it is clicked, and is put back if the
    // write is refused.
    const previous = row.status;
    setRows(rs => rs.map(r => (r.id === row.id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/admin/enquiries/${row.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRows(rs => rs.map(r => (r.id === row.id ? { ...r, status: previous } : r)));
      setError('Could not update that enquiry.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="page__head">
        <div>
          <h1 className="page__title"><span className="red">Enquiries</span></h1>
          <p className="page__sub">Advertiser leads from the /advertise page. Each one accepted the terms.</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5${loading ? ' animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Status filters double as the at-a-glance count of what needs working. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterChip label="All" count={rows.length} active={filter === 'all'} onClick={() => setFilter('all')} />
        {STATUS_ORDER.map(s => (
          <FilterChip
            key={s}
            label={STATUS_META[s].label}
            count={counts[s]}
            dot={STATUS_META[s].dot}
            active={filter === s}
            onClick={() => setFilter(s)}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search brand, person, phone, reference, store…"
            aria-label="Search enquiries"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          Sort
          <select
            value={sort}
            onChange={e => setSort(e.target.value as typeof sort)}
            className="rounded-lg border border-border bg-card px-2 py-2 text-xs font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="value">Biggest value</option>
          </select>
        </label>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading enquiries…
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-bold text-foreground">
            {rows.length === 0 ? 'No enquiries yet' : 'Nothing matches that'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length === 0
              ? 'Leads sent from the /advertise form land here.'
              : 'Try a different search or filter.'}
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map(row => (
            <EnquiryCard
              key={row.id}
              row={row}
              open={openId === row.id}
              busy={saving === row.id}
              onToggle={() => setOpenId(openId === row.id ? null : row.id)}
              onStatus={s => setStatus(row, s)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ label, count, active, onClick, dot }: {
  label: string; count: number; active: boolean; onClick: () => void; dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? 'border-primary bg-primary/5 text-foreground' : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}
      {label}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function EnquiryCard({ row, open, busy, onToggle, onStatus }: {
  row: Enquiry; open: boolean; busy: boolean; onToggle: () => void; onStatus: (s: Status) => void;
}) {
  const meta = STATUS_META[row.status];
  const StatusIcon = meta.icon;
  const waNumber = row.whatsapp ?? row.phone;

  return (
    <li className="rounded-2xl border border-border bg-card">
      {/* Card face: identity and status only — detail is one click away. */}
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-neutral-50"
      >
        <span className={`mt-0.5 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-bold ${meta.chip}`}>
          <StatusIcon className="h-3 w-3" />
          {meta.label}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-bold text-foreground">{row.brandName}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{row.reference}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {row.contactPerson} · {row.phone}
            {row.category ? ` · ${row.category}` : ''}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {row.storeNames.length} store{row.storeNames.length === 1 ? '' : 's'} · {row.slotsPerStore} slot
            {row.slotsPerStore === 1 ? '' : 's'} · {row.months} month{row.months === 1 ? '' : 's'} · {ago(row.createdAt)}
          </span>
        </span>

        <span className="shrink-0 text-right">
          <span className="block text-sm font-bold text-foreground tabular-nums">{rupees(row.estMonthlyPaise)}</span>
          <span className="block text-[11px] text-muted-foreground">per month</span>
        </span>

        <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform${open ? ' rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Detail k="Stores" v={row.storeNames.length ? row.storeNames.join(', ') : 'None picked — suggest stores for their category'} />
            <Detail k="Estimate" v={`${rupees(row.estMonthlyPaise)} a month · ${rupees(row.estTotalPaise)} over ${row.months} month${row.months === 1 ? '' : 's'} (ex GST)`} />
            <Detail k="Budget band" v={row.budgetBand ?? '—'} />
            <Detail k="Creative" v={row.creativeStatus ? (CREATIVE_LABEL[row.creativeStatus] ?? row.creativeStatus) : '—'} />
            <Detail k="Enquired" v={fullDate(row.createdAt)} />
            <Detail k="Terms accepted" v={`Version ${row.agreementVersion} · ${fullDate(row.agreementAcceptedAt)}`} />
            {row.notes && <Detail k="Notes" v={row.notes} wide />}
          </dl>

          <div className="flex flex-wrap gap-2">
            <a
              href={`tel:+91${row.phone}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-50"
            >
              <Phone className="h-3.5 w-3.5" /> Call {row.phone}
            </a>
            <a
              href={`https://wa.me/91${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-neutral-50"
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </a>
          </div>

          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Move to</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STATUS_ORDER.map(s => {
                const m = STATUS_META[s];
                const Icon = m.icon;
                const current = row.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onStatus(s)}
                    disabled={current || busy}
                    aria-current={current}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-default ${
                      current ? m.chip : 'border-border text-muted-foreground hover:text-foreground hover:bg-neutral-50'
                    }`}
                  >
                    {busy && !current ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                    {m.label}
                    {current && ' · now'}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Detail({ k, v, wide = false }: { k: string; v: string; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{v}</dd>
    </div>
  );
}
