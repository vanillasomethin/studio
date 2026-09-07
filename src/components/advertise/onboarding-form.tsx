'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { brand, brandLinks } from '@/lib/brand';
import {
  MAX_MONTHS,
  MAX_SLOTS_PER_STORE,
  MIN_MONTHS,
  MIN_SLOTS_PER_STORE,
  TIER_META,
  estimate,
  formatInr,
  storeById,
  type NetworkStore,
} from '@/lib/advertise-network';
import { Stepper } from './estimator';
import Agreement from './agreement';
import { AGREEMENT_VERSION } from '@/lib/advertise-agreement';

// TODO: confirm the category list with sales — these are the segments we sell to
// today, not a fixed taxonomy.
const CATEGORIES = [
  'Spices & masala',
  'Snacks & namkeen',
  'Ice cream & frozen',
  'Cashew & dry fruit',
  'Pickles & condiments',
  'Dairy',
  'Beverages',
  'Packaged foods',
  'Personal care',
  'Something else',
] as const;

// TODO: confirm the budget bands with sales.
const BUDGET_BANDS = [
  'Under ₹25,000 a month',
  '₹25,000 – ₹50,000 a month',
  '₹50,000 – ₹1,00,000 a month',
  '₹1,00,000 – ₹2,00,000 a month',
  'Above ₹2,00,000 a month',
  'Not decided yet',
] as const;

const CREATIVE_STATES = [
  { value: 'ready', label: 'Ready', hint: 'We have a 10-second video we can send you.' },
  { value: 'not-ready', label: 'Not ready yet', hint: 'We have footage or artwork, but no finished ad.' },
  { value: 'need-help', label: 'Need help', hint: 'Make the ad for us.' },
] as const;

type CreativeStatus = (typeof CREATIVE_STATES)[number]['value'];
type FieldKey =
  | 'brandName'
  | 'contactPerson'
  | 'phone'
  | 'whatsapp'
  | 'category'
  | 'budget'
  | 'creative'
  | 'agreement';

/** Reading order, so a failed submit sends focus to the first thing to fix. */
const FIELD_ORDER: FieldKey[] = [
  'brandName',
  'contactPerson',
  'phone',
  'whatsapp',
  'category',
  'budget',
  'creative',
  'agreement',
];

const FIELD_SELECTOR: Record<FieldKey, string> = {
  brandName: '#brand-name',
  contactPerson: '#contact-person',
  phone: '#phone',
  whatsapp: '#whatsapp',
  category: '#product-category',
  budget: '#monthly-budget',
  creative: 'input[name="creative"]',
  agreement: '#agreement-accepted',
};

/** Accepts 9876543210, 09876543210, +91 98765 43210. Returns the 10 digits, or null. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  const local =
    digits.length === 12 && digits.startsWith('91')
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith('0')
        ? digits.slice(1)
        : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : null;
}

type Props = {
  selectedIds: string[];
  slots: number;
  setSlots: (n: number) => void;
  months: number;
  setMonths: (n: number) => void;
};

export default function OnboardingForm({ selectedIds, slots, setSlots, months, setMonths }: Props) {
  const [brandName, setBrandName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [category, setCategory] = useState('');
  const [budget, setBudget] = useState('');
  const [creative, setCreative] = useState<CreativeStatus | ''>('');
  const [notes, setNotes] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  // Set on a failed submit, consumed by the effect below — the field can only be
  // focused after React has painted the error state onto it.
  const focusTarget = useRef<FieldKey | null>(null);

  const totals = useMemo(() => estimate(selectedIds, slots, months), [selectedIds, slots, months]);
  const chosenStores = selectedIds
    .map(storeById)
    .filter((s): s is NetworkStore => Boolean(s));

  const effectiveWhatsapp = sameWhatsapp ? phone : whatsapp;

  useEffect(() => {
    const key = focusTarget.current;
    if (!key) return;
    focusTarget.current = null;
    const el = formRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR[key]);
    el?.focus();
    el?.scrollIntoView({ block: 'center' });
  }, [errors]);

  // Swapping the form for the confirmation is a big change with no focus move —
  // announce it by sending focus to the heading.
  useEffect(() => {
    if (reference) successRef.current?.focus();
  }, [reference]);

  function validate(): Partial<Record<FieldKey, string>> {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!brandName.trim()) next.brandName = 'Tell us the brand name.';
    if (!contactPerson.trim()) next.contactPerson = 'Who should we call?';
    if (!normalisePhone(phone)) next.phone = 'Enter a 10-digit Indian mobile number.';
    if (!sameWhatsapp && !normalisePhone(whatsapp)) {
      next.whatsapp = 'Enter a 10-digit WhatsApp number, or tick the box above.';
    }
    if (!category) next.category = 'Pick a category.';
    if (!budget) next.budget = 'Pick a budget band.';
    if (!creative) next.creative = 'Tell us where your creative stands.';
    if (!agreed) next.agreement = 'Please read and accept the terms to continue.';
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Send focus to the first thing that needs fixing rather than leaving the
      // reader to hunt for the red text. The effect above does it after paint.
      focusTarget.current = FIELD_ORDER.find(key => found[key]) ?? null;
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/advertise/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandName: brandName.trim(),
          contactPerson: contactPerson.trim(),
          phone: normalisePhone(phone),
          whatsapp: normalisePhone(effectiveWhatsapp),
          category,
          budgetBand: budget,
          storeIds: selectedIds,
          slotsPerStore: slots,
          months,
          creativeStatus: creative,
          notes: notes.trim(),
          agreementAccepted: agreed,
          agreementVersion: AGREEMENT_VERSION,
          agreementAcceptedAt: new Date().toISOString(),
          estimatedMonthlyRupees: totals.monthlyRupees,
          estimatedTotalRupees: totals.totalRupees,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { reference?: string; error?: string };
      if (!res.ok) throw new Error(data.error || 'We could not send that. Please try again.');
      setReference(data.reference ?? 'received');
    } catch (err) {
      // A dropped connection surfaces as "Failed to fetch", which tells a shop
      // owner nothing — only show a message the server actually wrote.
      const msg = (err as Error).message;
      setSubmitError(
        msg && !/fetch/i.test(msg)
          ? msg
          : 'We could not send that. Check your connection and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div
        className="rounded-lg border p-6 sm:p-8"
        style={{ borderColor: 'var(--brand-accent)', background: 'var(--brand-accent-tint)' }}
      >
        <h3
          ref={successRef}
          tabIndex={-1}
          className="text-xl font-black tracking-tight focus-visible:outline-none"
        >
          Got it. We&apos;ll call you.
        </h3>
        <p className="mt-3 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
          Your enquiry reference is <strong className="font-bold" style={{ color: 'var(--brand-ink)' }}>{reference}</strong>.
          {/* TODO: confirm the real response-time commitment before publishing. */}{' '}
          Someone from {brand.name} will call you on the number you gave us within one working day
          with store availability and a written quote.
        </p>
        <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-bold">What you asked for</dt>
            <dd style={{ color: 'var(--brand-ink-muted)' }}>
              {totals.storeCount} store{totals.storeCount === 1 ? '' : 's'} · {slots} slot
              {slots === 1 ? '' : 's'} each · {months} month{months === 1 ? '' : 's'}
            </dd>
          </div>
          <div>
            <dt className="font-bold">Estimate</dt>
            <dd style={{ color: 'var(--brand-ink-muted)' }}>
              {formatInr(totals.monthlyRupees)} a month · {formatInr(totals.totalRupees)} in total
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          You accepted the {brand.name} advertising terms (version {AGREEMENT_VERSION}) with this
          enquiry. We will send you a copy with the written quote.
        </p>
        <p className="mt-5 text-sm">
          In a hurry?{' '}
          <a
            href={brandLinks.whatsapp}
            className="font-bold underline underline-offset-4"
            style={{ color: 'var(--brand-accent-strong)' }}
          >
            WhatsApp us on {brand.phoneDisplay}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Brand name" error={errors.brandName}>
          {p => (
            <input
              {...p}
              type="text"
              autoComplete="organization"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              placeholder="e.g. Kadri Masala Works"
              className="adv-input"
            />
          )}
        </Field>

        <Field label="Contact person" error={errors.contactPerson}>
          {p => (
            <input
              {...p}
              type="text"
              autoComplete="name"
              value={contactPerson}
              onChange={e => setContactPerson(e.target.value)}
              placeholder="Who we should ask for"
              className="adv-input"
            />
          )}
        </Field>

        <Field label="Phone" error={errors.phone} hint="10-digit Indian mobile.">
          {p => (
            <input
              {...p}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="98765 43210"
              className="adv-input"
            />
          )}
        </Field>

        <div>
          <Field label="WhatsApp" error={errors.whatsapp}>
            {p => (
              <input
                {...p}
                type="tel"
                inputMode="tel"
                value={sameWhatsapp ? phone : whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                disabled={sameWhatsapp}
                placeholder="98765 43210"
                className="adv-input disabled:opacity-60"
              />
            )}
          </Field>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sameWhatsapp}
              onChange={e => setSameWhatsapp(e.target.checked)}
              className="h-4 w-4"
              style={{ accentColor: 'var(--brand-accent)' }}
            />
            Same as my phone number
          </label>
        </div>

        <Field label="Product category" error={errors.category}>
          {p => (
            <select
              {...p}
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="adv-input"
            >
              <option value="">Choose one</option>
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Monthly budget" error={errors.budget}>
          {p => (
            <select {...p} value={budget} onChange={e => setBudget(e.target.value)} className="adv-input">
              <option value="">Choose a band</option>
              {BUDGET_BANDS.map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>

      {/* ------------------------------------------ carried over from the estimator */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--brand-line)', background: 'var(--brand-surface-muted)' }}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">
            Stores you picked ({chosenStores.length})
          </h3>
          <a
            href="#pricing"
            className="text-sm font-bold underline underline-offset-4"
            style={{ color: 'var(--brand-accent-strong)' }}
          >
            Change selection
          </a>
        </div>

        {chosenStores.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: 'var(--brand-ink-muted)' }}>
            None yet — you can send this without picking, and we&apos;ll suggest stores for your
            category.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {chosenStores.map(store => (
              <li
                key={store.id}
                className="rounded-full border px-3 py-1 text-xs"
                style={{ borderColor: 'var(--brand-accent)', color: 'var(--brand-accent-strong)' }}
              >
                {store.name}
                {/* Not a dimmed accent — that lands under 4.5:1 on this panel. */}
                <span className="ml-1.5" style={{ color: 'var(--brand-ink-muted)' }}>
                  {TIER_META[store.tier].label}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <Stepper
            label="Slots per store"
            value={slots}
            min={MIN_SLOTS_PER_STORE}
            max={MAX_SLOTS_PER_STORE}
            onChange={setSlots}
            unit={slots === 1 ? 'slot' : 'slots'}
          />
          <Stepper
            label="Duration"
            value={months}
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            onChange={setMonths}
            unit={months === 1 ? 'month' : 'months'}
          />
        </div>

        {totals.storeCount > 0 ? (
          <p className="mt-4 text-sm font-bold" aria-live="polite">
            Estimate: {formatInr(totals.monthlyRupees)} a month, {formatInr(totals.totalRupees)} in
            total.
          </p>
        ) : null}
      </div>

      {/* ----------------------------------------------------- creative status */}
      <fieldset aria-describedby={errors.creative ? 'creative-error' : undefined}>
        <legend className="text-sm font-bold">Your creative</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {CREATIVE_STATES.map(state => {
            const on = creative === state.value;
            return (
              <label
                key={state.value}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
                style={{
                  borderColor: on ? 'var(--brand-accent)' : 'var(--brand-line)',
                  background: on ? 'var(--brand-accent-tint)' : 'transparent',
                }}
              >
                <input
                  type="radio"
                  name="creative"
                  value={state.value}
                  checked={on}
                  onChange={() => setCreative(state.value)}
                  aria-invalid={errors.creative ? 'true' : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0"
                  style={{ accentColor: 'var(--brand-accent)' }}
                />
                <span>
                  <span className="block font-bold">{state.label}</span>
                  <span className="block text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
                    {state.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.creative ? (
          <p id="creative-error" className="mt-1.5 text-sm font-bold" style={{ color: 'var(--brand-accent-strong)' }}>
            {errors.creative}
          </p>
        ) : null}
      </fieldset>

      <Field label="Anything else?" optional>
        {p => (
          <textarea
            {...p}
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Launch dates, a product we should know about, stores you want that aren't on the list."
            className="adv-input"
          />
        )}
      </Field>

      <Agreement
        brandName={brandName}
        contactPerson={contactPerson}
        phone={phone}
        stores={chosenStores}
        totals={totals}
        accepted={agreed}
        onAccept={setAgreed}
        error={errors.agreement}
      />

      {submitError ? (
        <p role="alert" className="text-sm font-bold" style={{ color: 'var(--brand-accent-strong)' }}>
          {submitError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md px-6 py-3.5 text-base font-bold text-white transition-colors disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-accent)] focus-visible:ring-offset-2"
          style={{ background: 'var(--brand-accent)' }}
        >
          {submitting ? 'Sending…' : 'Send my enquiry'}
        </button>
        <p className="text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          Or WhatsApp{' '}
          <a href={brandLinks.whatsapp} className="font-bold underline underline-offset-4">
            {brand.phoneDisplay}
          </a>
          . No payment is taken here.
        </p>
      </div>

      <style>{`
        .adv-input{width:100%;border:1px solid var(--brand-line);border-radius:6px;
          background:#fff;padding:10px 12px;font-size:16px;color:var(--brand-ink);}
        /* 5.3:1 on white — a lighter grey would read as decoration, not text. */
        .adv-input::placeholder{color:#6b6b6b;}
        .adv-input:focus-visible{outline:2px solid var(--brand-accent);outline-offset:-1px;}
        .adv-input[aria-invalid="true"]{border-color:var(--brand-accent);border-width:2px;}
      `}</style>
    </form>
  );
}

/* ------------------------------------------------------------------- field */

type FieldChildProps = {
  id: string;
  'aria-invalid': 'true' | undefined;
  'aria-describedby': string | undefined;
  required: boolean;
};

/**
 * Label + control + error, wired together by id so the error and hint are
 * announced with the field rather than floating next to it.
 */
function Field({
  label,
  error,
  hint,
  optional = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: FieldChildProps) => React.ReactNode;
}) {
  const id = label.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
        {optional ? (
          <span className="ml-1.5 font-normal" style={{ color: 'var(--brand-ink-muted)' }}>
            optional
          </span>
        ) : null}
      </label>
      <div className="mt-2">
        {children({
          id,
          'aria-invalid': error ? 'true' : undefined,
          'aria-describedby': describedBy || undefined,
          required: !optional,
        })}
      </div>
      {hint ? (
        <p id={hintId} className="mt-1.5 text-xs" style={{ color: 'var(--brand-ink-muted)' }}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-1.5 text-sm font-bold" style={{ color: 'var(--brand-accent-strong)' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
