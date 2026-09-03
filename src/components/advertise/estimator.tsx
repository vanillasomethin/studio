'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import {
  MAX_MONTHS,
  MAX_SLOTS_PER_STORE,
  MINUTES_PER_DAY_PER_SLOT,
  MIN_MONTHS,
  MIN_SLOTS_PER_STORE,
  NETWORK_STORES,
  PLAYS_PER_DAY_PER_SLOT,
  SLOT_SECONDS,
  STORES_BY_TIER,
  TIER_META,
  clamp,
  estimate,
  formatCount,
  formatInr,
  tierRate,
} from '@/lib/advertise-network';

/* ------------------------------------------------------------------ stepper */

type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  /** Rendered after the number, e.g. "slots" / "months". */
  unit: string;
  hint?: string;
};

/**
 * A number stepper that is still a real number input underneath, so it can be
 * typed into, arrowed through and read out by a screen reader — the −/+ buttons
 * are the mouse and thumb affordance on top of that.
 */
export function Stepper({ label, value, min, max, onChange, unit, hint }: StepperProps) {
  const id = useId();
  // The field holds a string while it is being typed: clamping on every
  // keystroke would fight the user as soon as they clear it to type a new value.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const step = (delta: number) => onChange(clamp(value + delta, min, max));

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
      </label>
      <div className="mt-2 flex items-stretch">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={value <= min}
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="adv-step rounded-l-md"
        >
          −
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={draft}
          onChange={e => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw);
            if (raw !== '' && Number.isFinite(n)) onChange(clamp(n, min, max));
          }}
          onBlur={() => setDraft(String(value))}
          className="w-16 border-y bg-white text-center text-base font-bold tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
          style={{ borderColor: 'var(--brand-line)' }}
        />
        <button
          type="button"
          onClick={() => step(1)}
          disabled={value >= max}
          aria-label={`Increase ${label.toLowerCase()}`}
          className="adv-step rounded-r-md"
        >
          +
        </button>
        <span className="ml-3 self-center text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
          {unit}
        </span>
      </div>
      {hint ? (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* --------------------------------------------------------------- estimator */

type Props = {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  slots: number;
  setSlots: (n: number) => void;
  months: number;
  setMonths: (n: number) => void;
};

export default function Estimator({
  selectedIds,
  setSelectedIds,
  slots,
  setSlots,
  months,
  setMonths,
}: Props) {
  const totals = useMemo(() => estimate(selectedIds, slots, months), [selectedIds, slots, months]);

  const toggle = (id: string) =>
    setSelectedIds(
      selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]
    );

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start lg:gap-10">
      <div>
        {/* -------------------------------------------------------- rate card */}
        <h3 className="text-lg font-bold">Rate card</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
          One slot is {SLOT_SECONDS} seconds, played {PLAYS_PER_DAY_PER_SLOT} times a day — that is{' '}
          {MINUTES_PER_DAY_PER_SLOT} minutes of screen time every day, in every store you pick. Price
          is per slot, per store, per month.
        </p>

        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {STORES_BY_TIER.map(({ tier, stores }) => (
            <li
              key={tier}
              className="rounded-lg border p-4"
              style={{ borderColor: 'var(--brand-line)' }}
            >
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--brand-accent-strong)' }}>
                {TIER_META[tier].label}
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight">{formatInr(tierRate(tier))}</p>
              <p className="text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
                per slot · per store · per month
              </p>
              <p className="mt-2 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
                {stores.length} store{stores.length === 1 ? '' : 's'}
              </p>
            </li>
          ))}
        </ul>

        {/* ---------------------------------------------------- store picker */}
        <h3 className="mt-10 text-lg font-bold">Pick your stores</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
          Tick a shop here or tap its pin on the map above. {totals.storeCount} of{' '}
          {NETWORK_STORES.length} selected.
        </p>

        {selectedIds.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="mt-3 text-sm font-bold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
            style={{ color: 'var(--brand-accent-strong)' }}
          >
            Clear all {selectedIds.length}
          </button>
        ) : null}

        <div className="mt-4 space-y-5">
          {STORES_BY_TIER.map(({ tier, stores }) => {
            const ids = stores.map(s => s.id);
            const allOn = ids.every(id => selectedIds.includes(id));
            return (
              <fieldset
                key={tier}
                className="rounded-lg border p-4"
                style={{ borderColor: 'var(--brand-line)' }}
              >
                <legend className="px-1 text-sm font-bold">
                  {TIER_META[tier].label} · {formatInr(tierRate(tier))} per slot / month
                </legend>
                <p className="text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
                  {TIER_META[tier].blurb}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedIds(
                      allOn
                        ? selectedIds.filter(id => !ids.includes(id))
                        : Array.from(new Set([...selectedIds, ...ids]))
                    )
                  }
                  className="mt-3 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors hover:bg-[var(--brand-accent-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)]"
                  style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent-strong)' }}
                >
                  {allOn ? `Clear all ${TIER_META[tier].label}` : `Select all ${TIER_META[tier].label}`}
                </button>

                <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                  {stores.map(store => {
                    const on = selectedIds.includes(store.id);
                    return (
                      <li key={store.id}>
                        <label
                          className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors"
                          style={{
                            borderColor: on ? 'var(--brand-accent)' : 'var(--brand-line)',
                            background: on ? 'var(--brand-accent-tint)' : 'transparent',
                            fontWeight: on ? 700 : 400,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(store.id)}
                            className="h-4 w-4 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-1"
                            style={{ accentColor: 'var(--brand-accent)' }}
                          />
                          {store.name}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            );
          })}
        </div>

        {/* -------------------------------------------------------- steppers */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Stepper
            label="Slots per store"
            value={slots}
            min={MIN_SLOTS_PER_STORE}
            max={MAX_SLOTS_PER_STORE}
            onChange={setSlots}
            unit={slots === 1 ? 'slot' : 'slots'}
            hint={`Maximum ${MAX_SLOTS_PER_STORE} slots per brand on any one screen.`}
          />
          <Stepper
            label="Duration"
            value={months}
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            onChange={setMonths}
            unit={months === 1 ? 'month' : 'months'}
            hint="Billed monthly. Longer runs are booked the same way."
          />
        </div>
      </div>

      {/* ---------------------------------------------------------- totals */}
      <aside
        className="rounded-lg border p-5 lg:sticky lg:top-24"
        style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface-muted)' }}
        aria-label="Your estimate"
      >
        <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--brand-accent-strong)' }}>
          Your estimate
        </h3>

        <div aria-live="polite">
          {totals.storeCount === 0 ? (
            <p className="mt-4 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
              Pick at least one store to see a price.
            </p>
          ) : (
            <>
              <p className="mt-4 text-3xl font-black tracking-tight" style={{ color: 'var(--brand-accent-strong)' }}>
                {formatInr(totals.monthlyRupees)}
                <span className="ml-1 text-sm font-bold" style={{ color: 'var(--brand-ink-muted)' }}>
                  / month
                </span>
              </p>
              <p className="mt-1 text-base font-bold">
                {formatInr(totals.totalRupees)}{' '}
                <span className="font-normal" style={{ color: 'var(--brand-ink-muted)' }}>
                  for {totals.months} month{totals.months === 1 ? '' : 's'}
                </span>
              </p>

              <dl className="mt-5 space-y-2 border-t pt-4 text-sm" style={{ borderColor: 'var(--brand-line)' }}>
                <Row label="Stores" value={String(totals.storeCount)} />
                <Row label="Slots per store" value={String(totals.slots)} />
                <Row label="Plays a day" value={formatCount(totals.playsPerDay)} />
                <Row label="Screen time a day" value={`${formatCount(totals.minutesPerDay)} min`} />
              </dl>

              <dl className="mt-4 space-y-2 border-t pt-4 text-xs" style={{ borderColor: 'var(--brand-line)' }}>
                {totals.byTier.map(row => (
                  <Row
                    key={row.tier}
                    label={`${TIER_META[row.tier].label} × ${row.storeCount}`}
                    value={`${formatInr(row.monthlyRupees)} / mo`}
                    muted
                  />
                ))}
              </dl>
            </>
          )}
        </div>

        <p className="mt-5 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          {/* TODO: confirm whether the published rate card is inclusive or exclusive of GST. */}
          Prices exclude GST. Your selection is carried into the enquiry form below.
        </p>

        <a
          href="#enquiry"
          className="mt-4 block rounded-md px-4 py-3 text-center text-sm font-bold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
          style={{ background: 'var(--brand-accent)' }}
        >
          Send this plan to us
        </a>
      </aside>

      <style>{`
        .adv-step{width:44px;display:flex;align-items:center;justify-content:center;
          border:1px solid var(--brand-line);background:#fff;font-size:20px;font-weight:700;
          line-height:1;color:var(--brand-ink);transition:background-color .15s ease;}
        .adv-step:hover:not(:disabled){background:var(--brand-accent-tint);}
        .adv-step:disabled{opacity:.4;cursor:not-allowed;}
        .adv-step:focus-visible{outline:2px solid var(--brand-accent);outline-offset:-2px;}
        /* The −/+ buttons are the stepper; the browser's own spinners crowd them out. */
        input[type=number].tabular-nums::-webkit-outer-spin-button,
        input[type=number].tabular-nums::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
        input[type=number].tabular-nums{-moz-appearance:textfield;}
      `}</style>
    </div>
  );
}

function Row({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt style={{ color: 'var(--brand-ink-muted)' }}>{label}</dt>
      <dd className="tabular-nums" style={{ fontWeight: muted ? 400 : 700 }}>
        {value}
      </dd>
    </div>
  );
}
