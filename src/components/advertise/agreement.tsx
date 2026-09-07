'use client';

import { brand } from '@/lib/brand';
import {
  AGREEMENT_TITLE,
  AGREEMENT_VERSION,
  agreementClauses,
} from '@/lib/advertise-agreement';
import {
  SLOT_SECONDS,
  TIER_META,
  formatInr,
  type Estimate,
  type NetworkStore,
} from '@/lib/advertise-network';

type Props = {
  /** Live values from the form above, so the party block names the real advertiser. */
  brandName: string;
  contactPerson: string;
  phone: string;
  stores: NetworkStore[];
  totals: Estimate;
  accepted: boolean;
  onAccept: (v: boolean) => void;
  error?: string;
};

/** "3 September 2026" — the date the brand accepts, which is today by definition. */
function today(): string {
  return new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The advertiser agreement, accepted as part of sending the enquiry.
 *
 * The commercial terms — who, which stores, how much — stay visible; the ten
 * clauses sit one tap away in a disclosure so the form is still usable on a
 * phone. Acceptance is a real checkbox tied to the submit, and what was accepted
 * is pinned by AGREEMENT_VERSION in the payload.
 */
export default function Agreement({
  brandName,
  contactPerson,
  phone,
  stores,
  totals,
  accepted,
  onAccept,
  error,
}: Props) {
  const clauses = agreementClauses(totals);
  const date = today();

  return (
    <section
      aria-labelledby="agreement-heading"
      className="rounded-lg border"
      style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface)' }}
    >
      <div className="border-b px-5 py-4" style={{ borderColor: 'var(--brand-line)' }}>
        <h3 id="agreement-heading" className="text-base font-bold">
          {AGREEMENT_TITLE}
        </h3>
        <p className="mt-0.5 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          Version {AGREEMENT_VERSION} · effective {date}
        </p>
      </div>

      <div className="space-y-5 px-5 py-5">
        <p className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
          Accepting this makes a booking agreement between{' '}
          <strong style={{ color: 'var(--brand-ink)' }}>{brand.legalName}</strong>, operating as{' '}
          {brand.name}, and{' '}
          <strong style={{ color: 'var(--brand-ink)' }}>{brandName.trim() || 'your business'}</strong>
          . We confirm store availability and the final price in writing before anything is charged.
        </p>

        {/* The parties — filled live from the form above. */}
        <div
          className="grid gap-4 rounded-md border p-4 sm:grid-cols-2"
          style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface-muted)' }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--brand-ink-muted)' }}
            >
              Party A — the network
            </p>
            <p className="mt-1 text-sm font-bold">{brand.legalName}</p>
            <p className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              {brand.address}
              <br />
              GSTIN {brand.gstin}
              <br />
              {brand.email} · {brand.phoneDisplay}
            </p>
          </div>
          <div className="sm:border-l sm:pl-4" style={{ borderColor: 'var(--brand-line)' }}>
            <p
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: 'var(--brand-ink-muted)' }}
            >
              Party B — the advertiser
            </p>
            <p className="mt-1 text-sm font-bold">{brandName.trim() || '—'}</p>
            <p className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              {contactPerson.trim() ? (
                <>
                  {contactPerson.trim()}
                  <br />
                </>
              ) : null}
              {phone.trim() ? phone.trim() : 'Phone as given above'}
            </p>
          </div>
        </div>

        {/* What is actually being agreed, in numbers. */}
        <dl className="rounded-md border" style={{ borderColor: 'var(--brand-line)' }}>
          <Row
            first
            k="Stores"
            v={
              stores.length === 0
                ? 'To be confirmed with you'
                : stores.map(s => `${s.name} (${TIER_META[s.tier].label})`).join(', ')
            }
          />
          <Row k="Slots per store" v={`${totals.slots} × ${SLOT_SECONDS}-second slot${totals.slots === 1 ? '' : 's'} in each store's daily loop`} />
          <Row k="Term" v={`${totals.months} month${totals.months === 1 ? '' : 's'}`} />
          <Row
            k="Fee"
            v={
              totals.storeCount === 0
                ? 'Quoted at the tier rate per slot, per store, per month, plus GST'
                : `${formatInr(totals.monthlyRupees)} a month plus GST · ${formatInr(totals.totalRupees)} plus GST over the term`
            }
          />
        </dl>

        <details className="group rounded-md border" style={{ borderColor: 'var(--brand-line)' }}>
          <summary
            className="cursor-pointer list-none px-4 py-3 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
            style={{ color: 'var(--brand-accent-strong)' }}
          >
            Read the full terms — {clauses.length} clauses
            <span className="ml-1 font-normal group-open:hidden" aria-hidden="true">
              ▸
            </span>
            <span className="ml-1 hidden font-normal group-open:inline" aria-hidden="true">
              ▾
            </span>
          </summary>
          <div
            className="space-y-4 border-t px-4 py-4 text-sm"
            style={{ borderColor: 'var(--brand-line)', color: 'var(--brand-ink-muted)' }}
          >
            {clauses.map(clause => (
              <div key={clause.n}>
                <p className="font-bold" style={{ color: 'var(--brand-ink)' }}>
                  <span style={{ color: 'var(--brand-accent-strong)' }}>{clause.n}.</span>{' '}
                  {clause.title}
                </p>
                <ul className="mt-1.5 space-y-1.5 pl-4">
                  {clause.items.map((item, i) => (
                    <li key={i} className="list-disc">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="border-t pt-4 text-xs" style={{ borderColor: 'var(--brand-line)' }}>
              Accepted electronically under the Information Technology Act, 2000. Electronic
              acceptance is valid execution and needs no physical signature.
            </p>
          </div>
        </details>

        {/* Acceptance */}
        <div>
          <label
            className="flex cursor-pointer items-start gap-3 rounded-md border p-4 text-sm"
            style={{
              borderColor: accepted ? 'var(--brand-accent)' : 'var(--brand-line)',
              background: accepted ? 'var(--brand-accent-tint)' : 'transparent',
            }}
          >
            <input
              id="agreement-accepted"
              type="checkbox"
              checked={accepted}
              onChange={e => onAccept(e.target.checked)}
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'agreement-error' : undefined}
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ accentColor: 'var(--brand-accent)' }}
            />
            <span>
              I have read and agree to these terms, and I am authorised to accept them on behalf of{' '}
              <strong>{brandName.trim() || 'my business'}</strong>. I understand this is an enquiry
              and that nothing is charged until we confirm the booking in writing.
            </span>
          </label>
          {error ? (
            <p
              id="agreement-error"
              className="mt-1.5 text-sm font-bold"
              style={{ color: 'var(--brand-accent-strong)' }}
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, first = false }: { k: string; v: string; first?: boolean }) {
  return (
    <div
      className="flex flex-col gap-1 p-4 sm:flex-row sm:gap-6"
      style={{ borderTop: first ? 'none' : '1px solid var(--brand-line)' }}
    >
      <dt className="text-sm font-bold sm:w-36 sm:shrink-0">{k}</dt>
      <dd className="text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
        {v}
      </dd>
    </div>
  );
}
