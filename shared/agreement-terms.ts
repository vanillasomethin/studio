// ─── Single source-of-truth: edit here → both web and mobile update ──────────

export const AGREEMENT_TERMS: { heading: string; body: string }[] = [
  {
    heading: 'Remuneration',
    body: 'VS Collective LLP shall pay a base monthly rent of ₹500 per screen, reimburse the electricity the screen consumes, and pay a performance bonus for the advertising it carries. The total is settled within 10 working days of month end via UPI/NEFT.',
  },
  {
    heading: 'Electricity',
    body: 'Electricity consumed by the screens is reimbursed at screen rated power × actual hours of operation × prevailing tariff. Submit monthly electricity bills for accurate settlement.',
  },
  {
    heading: 'Equipment',
    body: 'Screens are installed free of charge and remain the exclusive property of VS Collective LLP at all times. No right, title or interest vests in the Shop Owner.',
  },
  {
    heading: 'Your obligations',
    body: 'Provide unobstructed space during business hours. Do not tamper, relocate, or allow competing advertising equipment on premises. Notify ALIVE 24 hrs before any planned closure.',
  },
  {
    heading: 'Exclusivity',
    body: 'VS Collective LLP will not install any screen within 200 m of your premises for the duration of this agreement.',
  },
  {
    heading: 'Operating hours',
    body: 'Screens run during your regular business hours (~8 AM–10 PM or as mutually agreed). Planned maintenance is scheduled off-peak and does not affect your remuneration.',
  },
  {
    heading: 'Exit',
    body: '30 days written notice by either party. ALIVE removes the screen within 15 working days at its own cost. All outstanding dues settled within 30 days of termination.',
  },
  {
    heading: 'Content',
    body: 'All advertising content is managed exclusively by VS Collective LLP. Screens must not be used for personal entertainment, CCTV, browsing, or any non-approved purpose.',
  },
  {
    heading: 'Governing law',
    body: 'This agreement is governed by the laws of India. Disputes resolved by arbitration in Mangaluru under the Arbitration and Conciliation Act, 1996.',
  },
  {
    heading: 'Digital execution',
    body: 'This agreement is executed electronically under the Information Technology Act, 2000. Electronic acceptance constitutes valid execution without physical signatures or witnesses.',
  },
];

// Premium store partners are paid a higher base rent (e.g. ₹1000). Returns the
// terms with the Remuneration clause's base figure substituted; all other
// clauses are unchanged.
export function agreementTermsFor(monthlyRupees: number): { heading: string; body: string }[] {
  return AGREEMENT_TERMS.map((t) =>
    t.heading === 'Remuneration'
      ? { ...t, body: `VS Collective LLP shall pay a base monthly rent of ₹${monthlyRupees.toLocaleString('en-IN')} per screen, reimburse the electricity the screen consumes, and pay a performance bonus for the advertising it carries. The total is settled within 10 working days of month end via UPI/NEFT.` }
      : t,
  );
}

// ─── Tiered remuneration (slot-mode partners) ────────────────────────────────
//
// A slot-mode partner is paid a guaranteed base rent for their tier, plus
// electricity, plus a performance bonus settled against the target schedule
// shared with them separately. The bonus formula itself is deliberately NOT
// stated in the agreement — partners see their tier's base and their actual
// payout total, not the network's per-slot economics.

export type AgreementTier = 'standard' | 'growth' | 'flagship';

/** Guaranteed base monthly rent per screen, in rupees, by tier. */
export const TIER_MONTHLY_MINIMUM_RUPEES: Record<AgreementTier, number> = {
  standard: 500,
  growth:   1000,
  flagship: 1500,
};

export function agreementTermsForTier(tier: AgreementTier): { heading: string; body: string }[] {
  const min = TIER_MONTHLY_MINIMUM_RUPEES[tier];
  return AGREEMENT_TERMS.map((t) =>
    t.heading === 'Remuneration'
      ? {
          ...t,
          body:
            `VS Collective LLP shall pay a guaranteed base monthly rent of ₹${min.toLocaleString('en-IN')} per screen, ` +
            `reimburse the electricity the screen consumes, and pay a performance bonus settled against the monthly ` +
            `target schedule communicated to the Shop Owner. ` +
            `The total payable is settled within 10 working days of month end via UPI/NEFT.`,
        }
      : t,
  );
}
