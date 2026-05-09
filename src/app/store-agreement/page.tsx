import { Logo } from '@/components/icons/logo';

const sections = [
  {
    id: 'parties',
    title: 'Parties to the Agreement',
    content: `This Agreement is made and entered into on this ___ day of ______, 2025, by and between:

VS COLLECTIVE LLP, a Limited Liability Partnership registered under the Limited Liability Partnership Act, 2008, having its registered office at #13, First Floor, Highland Manor, Falnir, Mangalore, Dakshina Kannada, Karnataka 575002. LLP Identification Number: IN-KA43598411418020V. GSTIN: 29AAXFV2589C1ZE (hereinafter referred to as "VS COLLECTIVE LLP", which expression shall, unless repugnant to the context or meaning thereof, include its successors and assigns);

AND

______________________, residing/operating at _____________________________, Aadhar No. / Business Registration No. / GSTIN: ________________ (hereinafter referred to as "Shop Owner", which expression shall, unless repugnant to the context or meaning thereof, include their heirs, successors, and assigns).`,
  },
  {
    id: 'recitals',
    title: 'Recitals',
    items: [
      { term: 'A.', def: 'VS COLLECTIVE LLP is engaged in providing digital advertising solutions, including the installation, operation, and maintenance of digital display screens ("32″ Q-LED Screens").' },
      { term: 'B.', def: 'The Shop Owner has agreed to provide space within their premises for the installation and operation of the Screens on the terms and conditions set forth in this Agreement.' },
    ],
  },
  {
    id: 'scope',
    title: '1. Scope of the Agreement',
    subsections: [
      { heading: '1.1', text: 'VS COLLECTIVE LLP shall install and operate the Screens at the Shop Owner\'s premises ("Premises").' },
      { heading: '1.2', text: 'The Shop Owner shall provide adequate, safe, and suitable space for the installation and uninterrupted operation of the Screens.' },
      { heading: '1.3', text: 'The Screens shall be used exclusively for advertising and promotional purposes as determined by VS COLLECTIVE LLP.' },
    ],
  },
  {
    id: 'term',
    title: '2. Term of the Agreement',
    subsections: [
      { heading: '2.1', text: 'This Agreement shall remain valid for an initial term of 1 year, commencing after a 3-week initial testing and commissioning phase from the date of execution of this Agreement ("Effective Date").' },
      { heading: '2.2', text: 'Upon mutual written consent, this Agreement may be renewed for additional periods under the same or revised terms.' },
    ],
  },
  {
    id: 'vs-responsibilities',
    title: '3. Responsibilities of VS Collective LLP',
    subsections: [
      { heading: '3.1', text: 'Install and maintain the Screens in proper working condition at its sole cost and expense.' },
      { heading: '3.2', text: 'Ensure that the Screens do not cause any physical damage or disruption to the Premises or the Shop Owner\'s operations.' },
      { heading: '3.3', text: 'Pay the Shop Owner a fixed monthly remuneration of ₹500, which may be revised after an evaluation conducted following the initial 3 months of operation.' },
      {
        heading: '3.4',
        text: 'Electricity Reimbursement: The Company will compensate the Shop Owner for electricity consumption based on each screen\'s rated power consumption and the actual number of hours the Screens operated during the month, at the prevailing electricity tariff rate applicable to the Premises. The Shop Owner shall submit actual electricity bills each month to facilitate accurate reimbursement.',
      },
      {
        heading: '3.5',
        text: 'Generator Usage Compensation: If the Screens operate during power cuts using the Shop\'s generator or backup power, the Company shall compensate the Shop Owner proportionally based on the Screens\' power consumption relative to the total load running on the generator, multiplied by the generator\'s fuel cost per hour and the hours of operation during power cuts.',
      },
    ],
  },
  {
    id: 'owner-responsibilities',
    title: '4. Responsibilities of the Shop Owner',
    subsections: [
      { heading: '4.1', text: 'Provide the designated area within the Premises for installation and operation of the Screens and display of products.' },
      { heading: '4.2', text: 'Ensure uninterrupted electricity supply to the Screens during business hours. If the Premises is equipped with a generator or backup power, the Shop Owner shall ensure continued supply to the Screens during business hours. If no backup is available, the Shop Owner shall not be held responsible for the outage but shall promptly restore supply once power is available.' },
      { heading: '4.3', text: 'Allow reasonable access to VS COLLECTIVE LLP\'s personnel for installation, maintenance, and repairs during business hours.' },
      { heading: '4.4', text: 'Refrain from tampering with, damaging, or modifying the Screens or related installations.' },
    ],
  },
  {
    id: 'running-hours',
    title: '5. Running Hours and Energy Costs',
    subsections: [
      { heading: '5.1', text: 'The Screens shall remain operational during the Shop Owner\'s official working hours. The Shop Owner shall intimate VS Collective LLP immediately in case the shop is closed during official working hours. Any such closures shall be resolved promptly to ensure continued operation of the Screens. If the Shop Owner fails to intimate the Company of such closures, VS Collective LLP shall have the right to deduct a proportionate amount from the Shop Owner\'s monthly compensation.' },
    ],
  },
  {
    id: 'restrictions',
    title: '6. Restrictions and Non-Interference',
    subsections: [
      { heading: '6.1', text: 'The Shop Owner shall not allow competing advertising equipment or services within the Premises without prior written consent of VS COLLECTIVE LLP.' },
      { heading: '6.2', text: 'The Shop Owner shall not relocate, obstruct, or disable the Screens without written approval from VS COLLECTIVE LLP.' },
      { heading: '6.3', text: 'All Screens remain the exclusive property of VS COLLECTIVE LLP, and no ownership or rights shall vest in the Shop Owner.' },
      { heading: '6.4', text: 'The Screens shall be used exclusively for advertisements and promotional content as determined by VS COLLECTIVE LLP. The Shop Owner shall not use, or permit the use of, the Screens for personal purposes such as movies, television, CCTV monitoring, internet browsing, or any other non-approved activity. Any violation of this clause shall entitle VS Collective LLP to terminate this Agreement immediately and/or recover damages.' },
    ],
  },
  {
    id: 'compensation',
    title: '7. Compensation and Payment Terms',
    subsections: [
      { heading: '7.1', text: 'The monthly remuneration and reimbursements specified in Clause 3.3 shall be paid by VS COLLECTIVE LLP to the Shop Owner within ten (10) working days of the end of each month, against receipt of a payment acknowledgment from the Shop Owner.' },
      { heading: '7.2', text: 'In case of any dispute relating to electricity or generator reimbursement calculations, both parties agree to resolve the matter amicably within fifteen (15) days by referring to electricity bills, fuel purchase records, or load-sharing calculations.' },
      { heading: '7.3', text: 'If the dispute remains unresolved, the matter shall be referred to an independent Chartered Accountant or Electrical Consultant mutually appointed by both parties, and their decision shall be final and binding.' },
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
          'Breach of any material terms, which remains unrectified for 15 days following written notice.',
          'Insolvency, bankruptcy, or permanent closure of either party\'s business.',
          'Force majeure events persisting beyond 60 days.',
        ],
      },
      {
        heading: '8.2',
        text: 'Upon termination:',
        bullets: [
          'VS COLLECTIVE LLP shall remove its Screens from the Premises within 15 days.',
          'All outstanding payments to the Shop Owner shall be settled within 30 days.',
        ],
      },
    ],
  },
  {
    id: 'indemnity',
    title: '9. Indemnity and Liability',
    subsections: [
      { heading: '9.1', text: 'VS COLLECTIVE LLP shall not be held liable for any damages to the Premises unless directly caused by its negligence.' },
      { heading: '9.2', text: 'The Shop Owner shall indemnify VS COLLECTIVE LLP against any claims, losses, or damages arising from intentional tampering, negligence, or unauthorized interference with the Screens.' },
    ],
  },
  {
    id: 'governing-law',
    title: '10. Governing Law and Dispute Resolution',
    subsections: [
      { heading: '10.1', text: 'This Agreement shall be governed by and construed in accordance with the laws of India, under the exclusive jurisdiction of the courts in Karnataka.' },
      { heading: '10.2', text: 'Disputes shall first be addressed through mutual discussions. If unresolved within 30 days, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996, with proceedings conducted in Bangalore, Karnataka, in English.' },
    ],
  },
  {
    id: 'safety',
    title: '11. Risk, Fire & Electrical Safety',
    subsections: [
      { heading: '11.1', text: 'The Company shall ensure that all its equipment, cabling, and installation are in compliance with applicable safety standards. Any loss, damage, fire, or short circuit arising directly due to defects in the Company\'s equipment shall be the sole responsibility of the Company, and the Company shall indemnify the Shop Owner against such losses.' },
      { heading: '11.2', text: 'The Shop Owner shall ensure that the premises have proper electrical wiring, earthing, and load capacity. Any loss, fire, or damage arising due to defective internal wiring, overloading, or unauthorized interference with the Company\'s equipment shall be the sole responsibility of the Shop Owner.' },
      { heading: '11.3', text: 'Each Party shall be responsible for insuring its own equipment, property, and stock against fire, short circuit, or accidental damage.' },
    ],
  },
  {
    id: 'miscellaneous',
    title: '12. Miscellaneous',
    items: [
      { term: '12.1 Amendments', def: 'Any modifications must be made in writing and signed by authorized representatives of both parties.' },
      { term: '12.2 Entire Agreement', def: 'This Agreement constitutes the full and final understanding between the parties and supersedes all prior communications.' },
      { term: '12.3 Notices', def: 'All notices shall be sent to the parties\' respective addresses as stated above.' },
    ],
  },
];

export default function StoreAgreementPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
          <a href="/store" className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back to registration</a>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-12 sm:py-16">

        {/* Letterhead */}
        <div className="mb-10 rounded-2xl border border-border overflow-hidden">
          {/* Red top bar */}
          <div className="h-2" style={{ background: 'linear-gradient(90deg,#dc2626,#991b1b)' }} />

          <div className="p-6 sm:p-8">
            {/* Logo + entity name */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 pb-6 border-b border-border">
              <div>
                <Logo />
                <p className="text-xs text-muted-foreground mt-2">An entity of VS Collective LLP</p>
              </div>
              <div className="text-right space-y-0.5 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">VS Collective LLP</p>
                <p>#13, First Floor, Highland Manor</p>
                <p>Falnir, Mangalore, Karnataka 575002</p>
                <p className="pt-1">GST: 29AAXFV2589C1ZE</p>
                <p>PAN: AAXFV2589C</p>
                <p>LLP: IN-KA43598411418020V</p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2 mb-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Legal Document</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Store Partner Agreement
              </h1>
              <p className="text-sm text-muted-foreground">In-Store Kirana Live Advertisement Solutions</p>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground/70">
                <span><strong className="text-muted-foreground">Contact:</strong> 7411349844</span>
                <span><strong className="text-muted-foreground">Email:</strong> hello@wearealive.in</span>
                <span><strong className="text-muted-foreground">Web:</strong> wearealive.in</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">

          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-base font-bold text-foreground mb-3">{s.title}</h2>

              {'content' in s && s.content && (
                <div className="space-y-3">
                  {s.content.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}

              {'items' in s && s.items && (
                <dl className="space-y-3">
                  {s.items.map((item) => (
                    <div key={item.term} className="flex gap-3">
                      <dt className="shrink-0 font-semibold text-foreground w-12">{item.term}</dt>
                      <dd>{item.def}</dd>
                    </div>
                  ))}
                </dl>
              )}

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
            </section>
          ))}

          {/* Signature block */}
          <section id="signatures" className="mt-12">
            <h2 className="text-base font-bold text-foreground mb-6">Execution</h2>
            <p className="mb-8">IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above:</p>

            <div className="grid sm:grid-cols-2 gap-8">
              {/* VS Collective */}
              <div className="rounded-xl border border-border p-5 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">For VS Collective LLP</p>
                  <p className="text-sm font-semibold text-foreground">Authorized Signatory</p>
                </div>
                {[
                  { label: 'Signature', lines: 2 },
                  { label: 'Name',      lines: 1 },
                  { label: 'Designation', lines: 1 },
                  { label: 'Date',      lines: 1 },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{f.label}</p>
                    {Array.from({ length: f.lines }).map((_, i) => (
                      <div key={i} className="border-b border-border mt-3" />
                    ))}
                  </div>
                ))}
                {/* Stamp box */}
                <div className="rounded-lg border border-dashed border-border h-20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/40">Company Seal / Stamp</p>
                </div>
              </div>

              {/* Shop Owner */}
              <div className="rounded-xl border border-border p-5 space-y-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">For Shop Owner</p>
                  <p className="text-sm font-semibold text-foreground">Signature & Acknowledgment</p>
                </div>
                {[
                  { label: 'Signature', lines: 2 },
                  { label: 'Name',      lines: 1 },
                  { label: 'Date',      lines: 1 },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">{f.label}</p>
                    {Array.from({ length: f.lines }).map((_, i) => (
                      <div key={i} className="border-b border-border mt-3" />
                    ))}
                  </div>
                ))}
                {/* Stamp box */}
                <div className="rounded-lg border border-dashed border-border h-20 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground/40">Shop Seal / Stamp (if any)</p>
                </div>
              </div>
            </div>

            {/* Witnesses */}
            <div className="mt-8">
              <p className="text-sm font-semibold text-foreground mb-4">Witnesses</p>
              <div className="grid sm:grid-cols-2 gap-6">
                {[1, 2].map((n) => (
                  <div key={n} className="rounded-xl border border-border p-5 space-y-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Witness {n}</p>
                    {['Name', 'Signature', 'Date'].map((f) => (
                      <div key={f}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1">{f}</p>
                        <div className="border-b border-border mt-3" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 mt-16 py-6 text-center">
        <p className="text-xs text-muted-foreground/40">
          © 2025 VS Collective LLP · ALIVE Advertising · Mangaluru, Karnataka, India
        </p>
        <p className="text-xs text-muted-foreground/30 mt-1">
          GST: 29AAXFV2589C1ZE · PAN: AAXFV2589C · hello@wearealive.in · wearealive.in
        </p>
      </footer>
    </div>
  );
}
