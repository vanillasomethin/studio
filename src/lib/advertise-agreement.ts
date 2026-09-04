// The advertiser agreement shown on /advertise before an enquiry is sent.
//
// Same legal voice as the brand-onboarding Terms of Service
// (src/app/brand-onboarding/page.tsx → StepAgreement), restated for the slot
// model this page sells: a brand buys N positions in a store's daily loop, not
// N screens. Clause text that differs between the two flows is a deliberate
// difference, not drift — anything a lawyer has not signed off carries a TODO.
//
// BRAND-FACING ONLY, like the rest of the /advertise tree: never state what a
// store is paid.

import {
  MAX_SLOTS_PER_STORE,
  PLAYS_PER_DAY_PER_SLOT,
  SLOT_SECONDS,
  formatInr,
  type Estimate,
} from '@/lib/advertise-network';
import { brand } from '@/lib/brand';

/**
 * Bump on every material change to the clauses below. It is stored with the
 * enquiry, so an accepted agreement can always be reproduced exactly — a bare
 * "accepted: true" is not evidence of what was accepted.
 */
export const AGREEMENT_VERSION = '2026-09-03';

export const AGREEMENT_TITLE = `${brand.name} advertising — Terms of Service`;

export type Clause = { n: string; title: string; items: string[] };

/** The clauses, with the brand's own numbers written into clause 2. */
export function agreementClauses(totals: Estimate): Clause[] {
  const stores = `${totals.storeCount} store${totals.storeCount === 1 ? '' : 's'}`;
  const slots = `${totals.slots} slot${totals.slots === 1 ? '' : 's'}`;
  const months = `${totals.months} month${totals.months === 1 ? '' : 's'}`;

  return [
    {
      n: '1',
      title: 'What we provide',
      items: [
        `We play your advertisement on the screen inside each store you book, as one position in that store's daily loop.`,
        `Each slot is ${SLOT_SECONDS} seconds and plays ${PLAYS_PER_DAY_PER_SLOT} times a day in that store.`,
        'You get a named contact who handles scheduling, creative checks and your monthly report.',
      ],
    },
    {
      n: '2',
      title: 'Your booking',
      items: [
        totals.storeCount > 0
          ? `This booking is ${slots} per store across ${stores}, for ${months}.`
          : 'Your stores, slot count and duration are confirmed in writing before the booking starts.',
        totals.storeCount > 0
          ? `The fee is ${formatInr(totals.monthlyRupees)} a month plus applicable GST, ${formatInr(totals.totalRupees)} plus GST over the full term.`
          : 'The fee is quoted per store per month at the tier rate, plus applicable GST.',
        'Prices are per slot, per store, per month, and are confirmed in writing before the booking starts. An estimate on this page is not a quote.',
        `A brand may hold at most ${MAX_SLOTS_PER_STORE} slots in any one store's loop, so no single advertiser can take over a screen.`,
        'Store availability is confirmed at the time of booking. If a store you picked is full, we will offer the nearest alternative before charging you.',
        // TODO: confirm with ops that a store's loop position is not guaranteed.
        'Your position within the loop may change between days. The number of plays a day does not.',
      ],
    },
    {
      n: '3',
      title: 'Payment',
      items: [
        // TODO: confirm payment terms with finance — mirrors the FAQ on this page.
        'The first month is payable in advance, before your campaign goes live. Longer runs are billed monthly in advance after that.',
        `A GST invoice is raised by ${brand.legalName}, GSTIN ${brand.gstin}, and emailed within two working days of payment.`,
        'Fees for completed months are non-refundable. If we cancel for reasons within our control, we refund the unused part of the term pro-rata.',
        // TODO: confirm the late-payment interest rate with finance.
        'Late or disputed payments attract interest at 2% a month.',
      ],
    },
    {
      n: '4',
      title: 'Screen uptime',
      items: [
        'Screens report in through the day and we monitor them.',
        // TODO: confirm the downtime threshold and the make-good rule with ops.
        'Short outages are made good by extending your run. If a store is dark for more than a full day, that store is credited pro-rata on your next invoice.',
        'You are never billed for plays that did not happen.',
        'We are not liable for downtime caused by store closures, power cuts or events outside our control, but the credit above still applies.',
      ],
    },
    {
      n: '5',
      title: 'Your creative',
      items: [
        `You supply one ${SLOT_SECONDS}-second MP4 (H.264), 1920 × 1080, 16:9, that works with no sound.`,
        'You are responsible for your advertisement being accurate, lawful and compliant with Indian advertising rules.',
        'We may refuse or pull content that breaks a law, misleads, or conflicts with our content policy, without liability to you.',
        // TODO: confirm the free-swap allowance and notice period with ops.
        'One creative swap a month is free with three working days notice. Further swaps in the same month carry a handling fee.',
      ],
    },
    {
      n: '6',
      title: 'Intellectual property',
      items: [
        'You keep full ownership of your advertisement and your brand assets.',
        'You grant us a non-exclusive licence to display that content on our screens for the term of the booking.',
        'We keep ownership of our platform, scheduling software and reporting tools.',
      ],
    },
    {
      n: '7',
      title: 'Reporting',
      items: [
        // TODO: confirm the report format and delivery date with ops.
        'You get a proof-of-play report each month, listing plays by store and by date.',
        'Play counts recorded by our players are the reference figure for billing and for any make-good.',
      ],
    },
    {
      n: '8',
      title: 'Limitation of liability',
      items: [
        'Our total liability for any claim under this agreement is limited to the fees you paid for the affected period.',
        'We are not liable for indirect or consequential loss, including lost revenue or reputational harm.',
      ],
    },
    {
      n: '9',
      title: 'Ending this agreement',
      items: [
        'Either side may end this agreement with 30 days written notice, effective at the end of a paid month.',
        'We may suspend or end it immediately if you breach a material term, including non-payment or unlawful content.',
        'On termination, outstanding fees fall due immediately.',
      ],
    },
    {
      n: '10',
      title: 'Privacy and governing law',
      items: [
        'We collect your business details to run your campaign and raise invoices. We do not sell your information.',
        'This agreement is governed by the laws of India.',
        `Disputes go first to good-faith discussion, then to arbitration in ${brand.city}, Karnataka under the Arbitration and Conciliation Act, 1996. Courts in ${brand.city} have exclusive jurisdiction.`,
      ],
    },
  ];
}
