// The campaign agreement a brand accepts before booking.
//
// ONE source for two flows that both book the same product: the self-serve
// wizard (/brand-onboarding → StepAgreement) and the "new campaign" modal on
// the brand dashboard. They used to carry separate hand-maintained copies, and
// the dashboard's had drifted materially shorter — it was missing the minimum
// play guarantee, the peak-window frequency clause, the 2%-a-month late
// interest and the arbitration detail. Which contract a brand got depended on
// which button they happened to click. Render from here, never inline.
//
// Sibling: src/lib/advertise-agreement.ts covers the /advertise enquiry, which
// sells slots rather than screens. Text that differs between the two is a
// deliberate product difference, not drift.

import { brand } from '@/lib/brand';

/**
 * Bump on every material change to the clauses below. It is stored on the
 * Campaign, so an accepted agreement can always be reproduced exactly — a bare
 * "agreed: true" is not evidence of what was agreed to.
 *
 * Changing clause wording without bumping this is the one thing that breaks the
 * guarantee, because a stored version would then point at text nobody kept.
 */
export const BRAND_AGREEMENT_VERSION = '2026-09-07';

export const BRAND_AGREEMENT_TITLE = 'Alive Advertising — Terms of Service';

/** Executed electronically — the wording both flows show above the checkbox. */
export const BRAND_AGREEMENT_EXECUTION_NOTE =
  'This agreement is executed electronically under the Information Technology Act, 2000. '
  + 'Electronic acceptance via the ALIVE platform constitutes valid execution without physical signatures.';

export type BrandAgreementClause = { n: string; title: string; items: string[] };

/**
 * Evidence of acceptance: which clause text, and the moment the box was ticked.
 * Both booking flows hold this in form state and post it with the booking; null
 * means not accepted, which is the only thing that gates the continue button.
 */
export type BrandAgreementAcceptance = { version: string; at: string };

/** Stamp an acceptance at the current clause version. */
export function acceptBrandAgreement(): BrandAgreementAcceptance {
  return { version: BRAND_AGREEMENT_VERSION, at: new Date().toISOString() };
}

export type BrandAgreementTerms = {
  screens: number;
  months: number;
  /** Monthly fee, already formatted for display (e.g. "₹2,397"). */
  monthlyFee: string;
  /** A ₹0 trial booking — waives the fee clauses rather than removing them. */
  isTrial?: boolean;
};

/** The clauses, with this campaign's own numbers written into clauses 2 and 3. */
export function brandAgreementClauses(
  { screens, months, monthlyFee, isTrial = false }: BrandAgreementTerms,
): BrandAgreementClause[] {
  return [
    {
      n: '1', title: 'What we provide',
      items: [
        'We display your advertisements on digital screens installed inside kirana stores and retail outlets across your selected locations.',
        'You get a dedicated Account Manager who handles scheduling, creative formatting, and campaign reporting.',
        'We provide screen uptime reports and campaign performance summaries.',
      ],
    },
    {
      n: '2', title: 'Your campaign',
      items: [
        `This campaign runs for ${months} ${months === 1 ? 'month' : 'months'} across ${screens} ${screens === 1 ? 'screen' : 'screens'}.`,
        isTrial
          ? `This is a free trial campaign — the standard monthly fee of ${monthlyFee} plus GST is waived; nothing is payable.`
          : `The monthly fee is ${monthlyFee} plus applicable GST.`,
        isTrial
          ? 'Campaign dates are confirmed after creative submission.'
          : 'Campaign dates are confirmed after payment and creative submission.',
        'Minimum play guarantee: once your screens are booked, we guarantee the "Guaranteed plays/day" figure shown on your dashboard. If we fall short of that guarantee in a billing month, we will add the missed plays to your rotation the following month at no extra cost (make-good); if there is no following month, we will issue a pro-rated bill credit for the shortfall instead. We will never apply both remedies for the same shortfall.',
        'Peak-window frequency: during peak viewing windows (9–11am, 12:30–2:30pm, 5:30–7:30pm, 7:30–9:30pm), screens with a Peak Boost add-on active play more often than screens without it. Your ad still plays every rotation cycle even without Peak Boost — only its frequency during those specific windows is reduced relative to boosted campaigns. Outside peak windows, all screens rotate equally regardless of Peak Boost.',
      ],
    },
    {
      n: '3', title: 'Payment',
      items: [
        isTrial
          ? 'No payment is due for this trial campaign. Renewals after the trial are charged at the standard rates.'
          : 'Payment is collected upfront via Razorpay before your campaign is activated.',
        isTrial
          ? 'No invoice is raised for a ₹0 trial.'
          : 'A GST invoice will be sent to your registered email within 2 business days of payment.',
        'Fees for completed campaign months are non-refundable. If we cancel your campaign for reasons within our control, we will issue a prorated refund.',
        'Late or disputed payments attract interest of 2% per month.',
      ],
    },
    {
      n: '4', title: 'Your content',
      items: [
        'You are solely responsible for ensuring your ad content is accurate, lawful, and complies with applicable advertising regulations.',
        'We may reject or remove content that violates any law, is misleading, or conflicts with our content policies — without liability to you.',
        'Send your ad creative and logo to your Account Manager after payment. Specifications: MP4 or JPEG/PNG, 1920 × 1080 px, max 100 MB.',
      ],
    },
    {
      n: '5', title: 'Intellectual property',
      items: [
        'You retain full ownership of your ad content and brand assets.',
        'You grant us a non-exclusive licence to display your content on our screens for the campaign duration.',
        'We retain ownership of our platform, scheduling software, and reporting tools.',
      ],
    },
    {
      n: '6', title: 'Limitation of liability',
      items: [
        'Our total liability to you for any claim arising from these Terms is limited to the fees you paid for the affected campaign period.',
        'We are not liable for indirect, incidental, or consequential losses, including lost revenue or reputational damage.',
        'We are not liable for screen downtime caused by third-party store closures, power outages, or force majeure events. We will notify you and extend your campaign where reasonably possible.',
      ],
    },
    {
      n: '7', title: 'Ending this agreement',
      items: [
        'Either party may end this agreement with 30 days written notice.',
        'We may suspend or terminate immediately if you breach a material term, including non-payment or submission of unlawful content.',
        'On termination, outstanding fees become immediately due.',
      ],
    },
    {
      n: '8', title: 'Privacy',
      items: [
        'We collect your business details (name, email, phone, GSTIN) to manage your campaign and issue invoices.',
        'We do not sell your information to third parties.',
        'Payment processing is handled by Razorpay, subject to their privacy policy.',
      ],
    },
    {
      n: '9', title: 'Governing law',
      items: [
        'These Terms are governed by the laws of India.',
        `Any disputes will first be addressed through good-faith discussions. If unresolved within 30 days, disputes will be referred to arbitration in ${brand.city}, Karnataka, under the Arbitration and Conciliation Act, 1996.`,
        `Courts in ${brand.city}, Karnataka have exclusive jurisdiction for any proceedings.`,
      ],
    },
    {
      n: '10', title: 'Changes to these terms',
      items: [
        'We may update these Terms from time to time. We will notify you of material changes by email.',
        'Continued use of our services after changes take effect means you accept the revised Terms.',
      ],
    },
  ];
}
