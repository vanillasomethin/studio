'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Logo } from '@/components/icons/logo';

// ─── Section data ────────────────────────────────────────────────────────────

const clauses = [
  {
    id: 'scope',
    title: '1. Scope of the Agreement',
    subsections: [
      { heading: '1.1', text: 'VS COLLECTIVE LLP shall install and operate the Screens at the Shop Owner\'s premises ("Premises") at its sole cost and expense.' },
      { heading: '1.2', text: 'The Shop Owner shall provide adequate, safe, and suitable space for the installation and uninterrupted operation of the Screens.' },
      { heading: '1.3', text: 'The Screens shall be used exclusively for advertising and promotional purposes as determined by VS COLLECTIVE LLP.' },
      { heading: '1.4', text: 'VS COLLECTIVE LLP guarantees that it shall not install any screen within a radius of 200 metres of the Shop Owner\'s Premises for the duration of this Agreement, ensuring exclusivity of the network node for the Shop Owner.' },
    ],
  },
  {
    id: 'term',
    title: '2. Term of the Agreement',
    subsections: [
      { heading: '2.1', text: 'This Agreement shall remain valid for an initial term of one (1) year, commencing after a three-week initial testing and commissioning phase from the date of execution ("Effective Date").' },
      { heading: '2.2', text: 'Upon mutual written consent, this Agreement may be renewed for additional one-year periods under the same or revised terms, unless either party provides written notice of non-renewal at least 30 days before expiry.' },
    ],
  },
  {
    id: 'vs-responsibilities',
    title: '3. Responsibilities of VS Collective LLP',
    subsections: [
      { heading: '3.1', text: 'Install and maintain the Screens in proper working condition at its sole cost and expense, including periodic servicing, software updates, and hardware repairs.' },
      { heading: '3.2', text: 'Ensure that the Screens, cabling, and allied equipment comply with applicable electrical safety standards and do not cause physical damage or disruption to the Premises or the Shop Owner\'s operations.' },
      { heading: '3.3', text: 'Pay the Shop Owner a fixed monthly remuneration of ₹500 (Rupees Five Hundred Only) per screen. This amount may be revised upward after a review following the initial three (3) months of operation, based on network performance and brand partner revenue.' },
      {
        heading: '3.4',
        text: 'Electricity Reimbursement: Compensate the Shop Owner for electricity consumed by the Screens based on each screen\'s rated power consumption, the actual hours of operation during the month, and the prevailing electricity tariff applicable to the Premises. The Shop Owner shall submit actual electricity bills to facilitate accurate monthly reimbursement.',
      },
      {
        heading: '3.5',
        text: 'Generator / Backup Power Compensation: If the Screens operate during power outages using the Shop\'s generator or UPS, VS COLLECTIVE LLP shall compensate the Shop Owner proportionally — calculated as the Screens\' share of total generator load, multiplied by the fuel cost per hour and the hours of generator operation during that period.',
      },
      {
        heading: '3.6',
        text: 'Referral Reward: For each new store partner who registers on the ALIVE platform using the Shop Owner\'s unique referral code, VS COLLECTIVE LLP shall pay the Shop Owner a one-time referral bonus of ₹500, settled within 10 working days of the referred partner\'s screen going live.',
      },
    ],
  },
  {
    id: 'owner-responsibilities',
    title: '4. Responsibilities of the Shop Owner',
    subsections: [
      { heading: '4.1', text: 'Provide the designated area within the Premises for installation and continuous operation of the Screens during business hours, free of obstruction.' },
      { heading: '4.2', text: 'Ensure uninterrupted electricity supply to the Screens during business hours. Where the Premises has a generator or UPS backup, the Shop Owner shall include the Screens on that backup supply. In the absence of backup, the Shop Owner shall promptly restore supply once power is available and shall not be penalised for force-majeure outages.' },
      { heading: '4.3', text: 'Allow reasonable access to VS COLLECTIVE LLP\'s authorised personnel for installation, inspection, maintenance, and repairs during business hours, with reasonable advance notice.' },
      { heading: '4.4', text: 'Refrain from tampering with, damaging, relocating, modifying, or obstructing the Screens or any related cabling and equipment without prior written consent from VS COLLECTIVE LLP.' },
      { heading: '4.5', text: 'Notify VS COLLECTIVE LLP at least 24 hours in advance of any planned closure of the Premises that would interrupt screen operation.' },
    ],
  },
  {
    id: 'running-hours',
    title: '5. Operating Hours and Downtime',
    subsections: [
      { heading: '5.1', text: 'The Screens shall remain operational throughout the Shop Owner\'s regular business hours, typically 8 AM to 10 PM or as mutually agreed.' },
      { heading: '5.2', text: 'If the Shop Owner fails to notify VS COLLECTIVE LLP of a closure that results in screen downtime exceeding two (2) hours, VS COLLECTIVE LLP reserves the right to proportionally adjust that month\'s remuneration, not exceeding ₹50 per incident.' },
      { heading: '5.3', text: 'Planned maintenance by VS COLLECTIVE LLP shall be scheduled during off-peak hours and shall not affect the Shop Owner\'s remuneration.' },
    ],
  },
  {
    id: 'restrictions',
    title: '6. Restrictions and Non-Interference',
    subsections: [
      { heading: '6.1', text: 'The Shop Owner shall not allow competing digital advertising equipment or services within the Premises without prior written consent of VS COLLECTIVE LLP.' },
      { heading: '6.2', text: 'The Shop Owner shall not relocate, obstruct, or disable the Screens or alter any cabling or mounts without written approval from VS COLLECTIVE LLP.' },
      { heading: '6.3', text: 'All Screens and related hardware remain the exclusive property of VS COLLECTIVE LLP at all times. No right, title, or interest in the equipment shall vest in the Shop Owner.' },
      { heading: '6.4', text: 'The Screens shall be used exclusively for approved advertising and promotional content managed by VS COLLECTIVE LLP. The Shop Owner shall not use, or permit the use of, the Screens for personal entertainment (movies, TV, gaming), CCTV monitoring, internet browsing, or any other non-approved purpose. Any violation shall entitle VS COLLECTIVE LLP to terminate this Agreement immediately and seek recovery of damages.' },
    ],
  },
  {
    id: 'compensation',
    title: '7. Compensation and Payment Terms',
    subsections: [
      { heading: '7.1', text: 'The monthly remuneration (Clause 3.3) and all reimbursements (Clauses 3.4, 3.5) shall be paid within ten (10) working days of the end of each calendar month, via UPI or NEFT to the bank account provided by the Shop Owner.' },
      { heading: '7.2', text: 'Referral bonuses (Clause 3.6) shall be paid within ten (10) working days of the referred partner\'s screen going live.' },
      { heading: '7.3', text: 'In the event of a dispute regarding reimbursement calculations, both parties agree to resolve the matter amicably within fifteen (15) days by reference to electricity bills, fuel purchase records, or load-sharing calculations.' },
      { heading: '7.4', text: 'If unresolved, the dispute shall be referred to an independent Chartered Accountant or Electrical Consultant mutually appointed by both parties, whose determination shall be final and binding.' },
    ],
  },
  {
    id: 'termination',
    title: '8. Termination',
    subsections: [
      {
        heading: '8.1',
        text: 'Either party may terminate this Agreement by giving 30 days\' prior written notice in the following cases:',
        bullets: [
          'Breach of any material term that remains unrectified for 15 days following written notice of breach.',
          'Insolvency, bankruptcy, or permanent closure of either party\'s business.',
          'Force majeure events that render performance impossible for more than 60 consecutive days.',
        ],
      },
      {
        heading: '8.2',
        text: 'VS COLLECTIVE LLP may terminate with immediate effect (without notice period) if the Shop Owner:',
        bullets: [
          'Uses the Screens for unauthorised purposes as described in Clause 6.4.',
          'Physically damages or attempts to remove/sell VS COLLECTIVE LLP\'s equipment.',
          'Permits a competitor advertising network to operate within the Premises.',
        ],
      },
      {
        heading: '8.3',
        text: 'Upon termination:',
        bullets: [
          'VS COLLECTIVE LLP shall remove its Screens from the Premises within 15 working days.',
          'All outstanding remuneration and reimbursements due to the Shop Owner shall be settled within 30 days of the effective termination date.',
          'The Shop Owner shall cooperate with the removal process and ensure reasonable access.',
        ],
      },
    ],
  },
  {
    id: 'indemnity',
    title: '9. Indemnity and Limitation of Liability',
    subsections: [
      { heading: '9.1', text: 'VS COLLECTIVE LLP shall indemnify the Shop Owner against any direct losses, claims, or third-party demands arising solely from VS COLLECTIVE LLP\'s negligence in operating the Screens.' },
      { heading: '9.2', text: 'The Shop Owner shall indemnify VS COLLECTIVE LLP against any claims, losses, or damages arising from the Shop Owner\'s intentional tampering, negligence, or unauthorised interference with the Screens.' },
      { heading: '9.3', text: 'Neither party shall be liable to the other for indirect, consequential, or punitive damages arising under this Agreement.' },
      { heading: '9.4', text: 'VS COLLECTIVE LLP\'s maximum aggregate liability to the Shop Owner under this Agreement shall not exceed the total remuneration paid to the Shop Owner in the preceding three (3) calendar months.' },
    ],
  },
  {
    id: 'governing-law',
    title: '10. Governing Law and Dispute Resolution',
    subsections: [
      { heading: '10.1', text: 'This Agreement shall be governed by and construed in accordance with the laws of India.' },
      { heading: '10.2', text: 'Disputes shall first be addressed through mutual discussions in good faith. If unresolved within 30 days, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, with proceedings conducted at Mangalore or Bangalore, Karnataka, in English. The arbitral award shall be final and binding.' },
      { heading: '10.3', text: 'For matters outside the scope of arbitration, the parties submit to the exclusive jurisdiction of courts in Dakshina Kannada, Karnataka.' },
    ],
  },
  {
    id: 'safety',
    title: '11. Electrical Safety and Risk Allocation',
    subsections: [
      { heading: '11.1', text: 'VS COLLECTIVE LLP shall ensure that all its equipment, cabling, and installation comply with applicable Indian electrical safety standards (IS 732, IS 3043 as applicable). Any damage, fire, or short circuit arising directly from defects in VS COLLECTIVE LLP\'s equipment shall be VS COLLECTIVE LLP\'s sole responsibility, and it shall indemnify the Shop Owner accordingly.' },
      { heading: '11.2', text: 'The Shop Owner shall ensure that the Premises has proper electrical wiring, adequate earthing, and sufficient load capacity as required by VS COLLECTIVE LLP. Any damage, fire, or incident arising from defective internal wiring, overloading, or the Shop Owner\'s unauthorised interference with VS COLLECTIVE LLP\'s equipment shall be the Shop Owner\'s sole responsibility.' },
      { heading: '11.3', text: 'Each party shall independently insure its own equipment, property, and stock against fire, electrical damage, theft, and accidental loss.' },
    ],
  },
  {
    id: 'confidentiality',
    title: '12. Confidentiality and Data',
    subsections: [
      { heading: '12.1', text: 'Both parties agree to keep the commercial terms of this Agreement (remuneration, reimbursement rates, referral bonuses) confidential and not disclose them to third parties without prior written consent, except as required by law.' },
      { heading: '12.2', text: 'VS COLLECTIVE LLP\'s digital signage system may collect anonymised audience analytics (impression counts, dwell time) for billing and campaign reporting purposes. No personally identifiable information of the Shop Owner\'s customers shall be collected or retained.' },
      { heading: '12.3', text: 'The Shop Owner\'s store details (name, location, contact) may be shared with brand partners of VS COLLECTIVE LLP solely for the purpose of campaign placement decisions.' },
    ],
  },
  {
    id: 'miscellaneous',
    title: '13. Miscellaneous',
    items: [
      { term: '13.1', label: 'Amendments', def: 'Any modification to this Agreement must be made in writing and signed by authorised representatives of both parties.' },
      { term: '13.2', label: 'Entire Agreement', def: 'This Agreement constitutes the complete and final understanding between the parties and supersedes all prior oral or written communications relating to its subject matter.' },
      { term: '13.3', label: 'Severability', def: 'If any provision of this Agreement is found to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.' },
      { term: '13.4', label: 'Waiver', def: 'Failure by either party to enforce any provision of this Agreement at any time shall not constitute a waiver of that party\'s right to enforce it subsequently.' },
      { term: '13.5', label: 'Notices', def: 'All formal notices shall be sent in writing to the addresses stated in this Agreement, via registered post or WhatsApp (with read confirmation), and shall be deemed received within 48 hours of dispatch.' },
      { term: '13.6', label: 'Language', def: 'This Agreement is executed in English. If translated into any other language for reference, the English version shall prevail in the event of conflict.' },
    ],
  },
];

// ─── Main page ───────────────────────────────────────────────────────────────

function AgreementContent() {
  const params    = useSearchParams();
  const storeName = params.get('name')    ?? '______________________';
  const ownerName = params.get('owner')   ?? '______________________';
  const address   = params.get('address') ?? '_____________________________';
  const phone     = params.get('phone')   ?? '';
  const gstin     = params.get('gstin')   ?? '';
  const today     = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const isPrefilled = params.get('name');

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Print / Save PDF
            </button>
            <a href="/store" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
              Back to registration
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-12 sm:py-16 print:py-4 print:px-0">

        {/* Prefilled notice */}
        {isPrefilled && (
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2 text-xs text-primary font-semibold print:hidden">
            <span className="h-2 w-2 rounded-full bg-primary inline-block" />
            This agreement is prefilled with your registration details.
          </div>
        )}

        {/* Letterhead */}
        <div className="mb-10 rounded-2xl border border-border overflow-hidden">
          <div className="h-2" style={{ background: 'linear-gradient(90deg,#dc2626,#991b1b)' }} />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-6 border-b border-border">
              <div>
                <Logo />
                <p className="text-xs text-muted-foreground mt-2">An entity of VS Collective LLP</p>
              </div>
              <div className="text-right space-y-0.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">VS Collective LLP</p>
                <p>#13, First Floor, Highland Manor</p>
                <p>Falnir, Mangalore, Karnataka 575002</p>
                <p className="pt-1">GST: 29AAXFV2589C1ZE · PAN: AAXFV2589C</p>
                <p>LLP: IN-KA43598411418020V</p>
                <p className="pt-1">+91 74113 24448 · hello@wearealive.in</p>
              </div>
            </div>

            <div className="text-center space-y-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Legal Document</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Store Partner Agreement
              </h1>
              <p className="text-sm text-muted-foreground">In-Store Kirana Live Advertising Network — ALIVE</p>
              <p className="text-xs text-muted-foreground/60 pt-1">Effective date: {today}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">

          {/* Parties */}
          <section id="parties">
            <h2 className="text-base font-bold text-foreground mb-3">Parties to the Agreement</h2>
            <p className="mb-3">
              This Store Partner Agreement (&ldquo;Agreement&rdquo;) is entered into as of{' '}
              <strong className="text-foreground">{today}</strong>, by and between:
            </p>
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Party A — Company</p>
                <p className="font-semibold text-foreground">VS COLLECTIVE LLP</p>
                <p className="text-xs mt-0.5">Registered under the Limited Liability Partnership Act, 2008.</p>
                <p className="text-xs">Office: #13, First Floor, Highland Manor, Falnir, Mangalore, Karnataka 575002.</p>
                <p className="text-xs">LLP No: IN-KA43598411418020V · GSTIN: 29AAXFV2589C1ZE</p>
                <p className="text-xs italic mt-0.5">(hereinafter referred to as &ldquo;<strong>VS COLLECTIVE LLP</strong>&rdquo; or &ldquo;<strong>the Company</strong>&rdquo;)</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Party B — Store Partner</p>
                <p className="font-semibold text-foreground">{storeName}</p>
                {ownerName !== '______________________' && <p className="text-xs mt-0.5">Owner / Authorised Signatory: <strong className="text-foreground">{ownerName}</strong></p>}
                <p className="text-xs">Operating at: {address}</p>
                {phone && <p className="text-xs">Contact: +91 {phone}</p>}
                {gstin && <p className="text-xs">GSTIN: <strong className="text-foreground">{gstin}</strong></p>}
                <p className="text-xs italic mt-0.5">(hereinafter referred to as &ldquo;<strong>Shop Owner</strong>&rdquo; or &ldquo;<strong>Store Partner</strong>&rdquo;)</p>
              </div>
            </div>
            <p className="mt-4">
              <strong className="text-foreground">Whereas</strong>, VS COLLECTIVE LLP operates ALIVE — a kirana store digital advertising network that installs and manages 32&Prime; Q-LED screens inside kirana stores and delivers brand advertisements to local shoppers; and the Shop Owner has agreed to host an ALIVE screen at their Premises on the terms set out below.
            </p>
          </section>

          {/* Numbered clauses */}
          {clauses.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-base font-bold text-foreground mb-3">{s.title}</h2>

              {'subsections' in s && s.subsections && (
                <div className="space-y-4">
                  {s.subsections.map((sub) => (
                    <div key={sub.heading} className="flex gap-3">
                      <span className="shrink-0 font-semibold text-foreground w-10">{sub.heading}</span>
                      <div className="flex-1 space-y-2">
                        {'text' in sub && sub.text && <p>{sub.text}</p>}
                        {'bullets' in sub && sub.bullets && (
                          <ul className="space-y-1.5 pl-2">
                            {sub.bullets.map((b, i) => (
                              <li key={i} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {'items' in s && s.items && (
                <div className="space-y-3">
                  {s.items.map((item) => (
                    <div key={item.term} className="flex gap-3">
                      <span className="shrink-0 font-semibold text-foreground w-10">{item.term}</span>
                      <p><strong className="text-foreground">{item.label}:</strong> {item.def}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Digital Acceptance */}
          <section id="acceptance" className="mt-12">
            <h2 className="text-base font-bold text-foreground mb-4">Digital Acceptance</h2>

            <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 space-y-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This Agreement is executed electronically under the <strong className="text-foreground">Information Technology Act, 2000</strong>. Electronic acceptance via the ALIVE platform constitutes valid execution without the need for physical signatures or witnesses. Both parties confirm they have read and understood all terms above.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Party A */}
                <div className="rounded-xl border border-border bg-background p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Party A — VS Collective LLP</p>
                  <p className="text-sm font-semibold text-foreground">VS Collective LLP</p>
                  <p className="text-xs text-muted-foreground">Accepted by: ALIVE Platform</p>
                  <p className="text-xs text-muted-foreground">Date: {today}</p>
                  <p className="text-xs text-muted-foreground">GSTIN: 29AAXFV2589C1ZE</p>
                </div>

                {/* Party B */}
                <div className="rounded-xl border border-border bg-background p-4 space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Party B — Store Partner</p>
                  <p className="text-sm font-semibold text-foreground">{storeName}</p>
                  {ownerName !== '______________________' && <p className="text-xs text-muted-foreground">Authorised by: {ownerName}</p>}
                  {phone && <p className="text-xs text-muted-foreground">Phone: +91 {phone}</p>}
                  {gstin && <p className="text-xs text-muted-foreground">GSTIN: {gstin}</p>}
                  <p className="text-xs text-muted-foreground">Date of acceptance: {today}</p>
                </div>
              </div>

              <p className="text-xs text-muted-foreground/50 text-center">
                Document generated by ALIVE Platform · wearealive.in · hello@wearealive.in
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default function StoreAgreementPage() {
  return (
    <Suspense>
      <AgreementContent />
    </Suspense>
  );
}
