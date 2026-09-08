import { Logo } from '@/components/icons/logo';

const sections = [
  {
    id: 'commitment',
    title: 'Our Commitment to Your Privacy',
    content: 'VS Collective LLP, operating the ALIVE network ("ALIVE," "we," "us," or "our"), is committed to protecting the privacy and personal information of all individuals who interact with our services. This Privacy Policy explains how we collect, use, disclose, and protect information when you use our Platform — the wearealive.in website, the ALIVE Store mobile app for store partners, and our in-store screen network — or engage with our services as a Store Partner, Brand Partner, or general user.\n\nThis Policy is published in compliance with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011, and, to the extent applicable, the Digital Personal Data Protection Act, 2023 ("DPDPA").',
  },
  {
    id: 'collection',
    title: '1. Information We Collect',
    subsections: [
      {
        heading: '1.1 Information You Provide Directly',
        text: 'When you register on our Platform or engage with our services, we collect:',
        bullets: [
          'Identity Information: Full name, business/store name, designation, and PAN/GSTIN for compliance purposes.',
          'Contact Information: Email address, phone/WhatsApp number, and business/store address.',
          'Account Credentials: Your password, stored only as a salted hash — never in plain text.',
          'Financial Information: Bank account details and UPI information for processing revenue share payments to Store Partners.',
          'Campaign Information: Ad creatives, target parameters, campaign budgets, and scheduling preferences submitted by Brand Partners.',
          'Communications: Records of your correspondence with our support team, feedback, and survey responses.',
        ],
      },
      {
        heading: '1.2 KYC Documents (Store Partners)',
        text: 'To verify store partners and comply with our payout obligations, the ALIVE Store app and dashboard collect photographs of your PAN card, Aadhaar card, and a selfie. These identity documents are stored in access-controlled private storage — never in any publicly reachable location — and are served only through authenticated endpoints to you and to authorised ALIVE staff for verification.',
      },
      {
        heading: '1.3 ALIVE Store Mobile App',
        text: 'The ALIVE Store Android app for store partners collects, with your permission:',
        bullets: [
          'Location: A one-time device location fix, used solely to place your shop on the ALIVE network map when no location is on file. Photos of your shop that you upload may carry embedded GPS coordinates (EXIF), which we use for the same purpose. The app does not track your location in the background or continuously.',
          'Camera and Photos: Used only when you initiate an action — taking your KYC selfie, photographing identity documents, or uploading shop photos and offer flyers.',
          'Push Notification Token: A device push token registered to your store account so we can send service alerts, such as your screen going offline or coming back online. Unregistered automatically when you sign out.',
          'Device Information: Device model, operating system version, and app version, used for diagnostics and support.',
        ],
      },
      {
        heading: '1.4 Information Collected Automatically',
        text: 'When you use our Platform or Screens, we may automatically collect:',
        bullets: [
          'Usage Data: Log data, pages visited, features used, session duration, and IP addresses from Platform usage.',
          'Performance Data: Screen uptime metrics, Proof-of-Play logs, content delivery timestamps, and connectivity status.',
        ],
      },
      {
        heading: '1.5 Aggregated and Anonymised In-Store Data',
        text: 'Our Screens may use technical tools (such as basic motion detection or footfall counters, if deployed) to generate aggregated, anonymised audience estimates for campaign reporting. ALIVE does NOT collect biometric data, facial recognition data, or any information that identifies individual shoppers. All in-store audience data is processed at the aggregate level only.',
      },
      {
        heading: '1.6 Information from Third Parties',
        text: 'We may receive information from payment processors and government databases for GST/identity validation. All such data sharing is conducted under applicable contractual and legal protections.',
      },
    ],
  },
  {
    id: 'use',
    title: '2. How We Use Your Information',
    subsections: [
      {
        heading: '2.1 Service Delivery',
        bullets: [
          'To operate, maintain, and improve the ALIVE Platform and services.',
          'To install and manage Screens at Store Partner locations.',
          'To deliver, track, and report on Brand Partner Campaigns.',
          'To process payments and revenue share to Store Partners.',
          'To send service notifications — such as screen offline/online alerts — to the ALIVE Store app.',
          'To provide technical support and respond to user queries.',
        ],
      },
      {
        heading: '2.2 Platform Improvement',
        bullets: [
          'To analyse usage patterns and improve Platform features.',
          'To develop new products, services, and advertising solutions.',
          'To generate anonymised industry insights and benchmarks.',
        ],
      },
      {
        heading: '2.3 Legal and Compliance',
        bullets: [
          'To comply with applicable laws, regulations, and court orders.',
          'To verify identity and prevent fraud, money laundering, and misuse of services.',
          'To enforce our Terms of Service and associated agreements.',
        ],
      },
      {
        heading: '2.4 Marketing and Communications',
        text: 'With your consent, we may send you updates about new features, promotions, and opportunities. You may opt out of marketing communications at any time by clicking "unsubscribe" in our emails or contacting us at hello@wearealive.in.',
      },
    ],
  },
  {
    id: 'legal-basis',
    title: '3. Legal Basis for Processing',
    text: 'Under applicable Indian data protection law, we process your personal data on the following legal bases:',
    bullets: [
      'Contractual Necessity: Processing required to perform our agreement with you as a Store Partner or Brand Partner.',
      'Legitimate Interests: Processing necessary for our business operations, fraud prevention, and Platform improvement, where such interests are not overridden by your rights.',
      'Legal Obligation: Processing required to comply with applicable laws and regulatory requirements.',
      'Consent: Where we rely on your consent (e.g., for marketing, or the app permissions above), you have the right to withdraw it at any time.',
    ],
  },
  {
    id: 'sharing',
    title: '4. Sharing and Disclosure of Information',
    subsections: [
      {
        heading: '4.1 Within the ALIVE Network',
        text: 'Brand Partners receive aggregated campaign performance reports including Proof-of-Play data and anonymised audience estimates. Individual shopper information is never shared with Brand Partners, and store partner identity documents are never shared with anyone outside ALIVE.',
      },
      {
        heading: '4.2 Service Providers',
        text: 'We share information with trusted third-party providers only to the extent needed to run the Platform: cloud hosting (Vercel), database services (Neon), file storage (Cloudflare), payment processing (Razorpay), WhatsApp/SMS delivery (e.g., MSG91, Twilio), and push notification delivery (Expo). These providers are bound by confidentiality obligations and may only use your data for the specific purposes we authorise.',
      },
      {
        heading: '4.3 Legal Requirements',
        text: 'We may disclose your information when required by law, court order, government authority, or to protect the rights, property, or safety of ALIVE, our users, or the public.',
      },
      {
        heading: '4.4 Business Transfers',
        text: 'In the event of a merger, acquisition, or sale of ALIVE\'s business or assets, user information may be transferred as part of that transaction. We will notify affected users prior to any such transfer and ensure adequate protections are in place.',
      },
      {
        heading: '4.5 No Sale of Personal Data',
        text: 'ALIVE does not and will not sell, rent, or trade your personal information to third parties for their independent marketing or commercial purposes.',
      },
    ],
  },
  {
    id: 'retention',
    title: '5. Data Retention',
    text: 'We retain personal information for as long as necessary to fulfil the purposes described in this Policy, unless a longer retention period is required by law. Specifically:',
    bullets: [
      'Account Information: Retained for the duration of your account and for 5 years thereafter for legal compliance purposes.',
      'KYC Documents: Retained while your partnership is active and as required by law; deleted on account deletion (see Section 9).',
      'Financial Records: Retained for 7 years as required under applicable tax and accounting regulations.',
      'Campaign Data and Proof-of-Play Records: Retained for 3 years from campaign completion.',
      'Platform Usage Logs: Retained for 12 months.',
    ],
    footer: 'When data is no longer required, we securely delete or anonymise it in accordance with our data disposal procedures.',
  },
  {
    id: 'cookies',
    title: '6. Cookies and Tracking Technologies',
    text: 'Our web-based Platform may use cookies and similar tracking technologies to enhance user experience, maintain sessions, and analyse usage. Types of cookies we use:',
    bullets: [
      'Essential Cookies: Required for the Platform to function correctly (e.g., login sessions, security tokens).',
      'Analytics Cookies: Used to understand how users interact with the Platform. These are anonymised and aggregated.',
      'Preference Cookies: Used to remember your settings and preferences.',
    ],
    footer: 'You can control cookies through your browser settings. Disabling essential cookies may affect Platform functionality. The ALIVE Store mobile app does not use cookies; it stores your session securely on your device.',
  },
  {
    id: 'security',
    title: '7. Data Security',
    text: 'ALIVE implements appropriate technical and organisational security measures to protect your information against unauthorised access, alteration, disclosure, or destruction. These measures include:',
    bullets: [
      'Encryption of data in transit using TLS/SSL protocols.',
      'Identity documents stored in private, access-controlled storage separated from public media.',
      'Secure access controls, role-based permissions, and multi-factor authentication for administrative access.',
      'Passwords stored only as salted hashes.',
      'Restricted access to personal data on a need-to-know basis.',
    ],
    footer: 'While we take all reasonable precautions, no method of transmission over the internet or electronic storage is completely secure. We cannot guarantee absolute security.',
  },
  {
    id: 'rights',
    title: '8. Your Rights',
    text: 'Under applicable Indian law, including the DPDPA, you have the following rights regarding your personal data:',
    bullets: [
      'Right to Access: You may request a copy of the personal data we hold about you.',
      'Right to Correction: You may request correction of inaccurate or incomplete personal data.',
      'Right to Erasure: You may request deletion of your personal data in certain circumstances, subject to legal and contractual obligations (see Section 9).',
      'Right to Withdraw Consent: Where processing is based on consent, you may withdraw consent at any time. App permissions (location, camera, photos, notifications) can be revoked in your device settings.',
      'Right to Grievance Redressal: You may raise a grievance with our designated Grievance Officer.',
    ],
    footer: 'To exercise any of these rights, please write to us at hello@wearealive.in. We will respond to your request within 30 days.',
  },
  {
    id: 'delete-account',
    title: '9. Account and Data Deletion',
    text: 'You can request deletion of your ALIVE account — including accounts created through the ALIVE Store mobile app — at any time:',
    bullets: [
      'Email hello@wearealive.in with the subject "Delete my account" from your registered email, or',
      'WhatsApp or call +91 96060 72227 from your registered number.',
    ],
    footer: 'After verifying your identity, we will delete your account, profile, KYC documents, uploaded photos, and push notification tokens within 30 days. We retain only what the law requires us to keep — financial and payout records (up to 7 years under tax regulations) — and aggregated data that no longer identifies you. If you have an active store partnership or campaign, deletion takes effect after outstanding contractual obligations (such as pending payouts) are settled.',
  },
  {
    id: 'children',
    title: '10. Children\'s Privacy',
    content: 'ALIVE\'s services are not directed at children under the age of 18. We do not knowingly collect personal information from minors. If we become aware that we have inadvertently collected information from a child, we will take prompt steps to delete such information. Parents or guardians who believe their child\'s information has been collected should contact us at hello@wearealive.in.',
  },
  {
    id: 'cross-border',
    title: '11. Cross-Border Data Transfers',
    content: 'As ALIVE primarily operates within India, most data processing occurs within India. Where our cloud service providers process data outside India, we ensure appropriate contractual safeguards are in place and that such transfers comply with applicable Indian data protection law.',
  },
  {
    id: 'updates',
    title: '12. Updates to This Policy',
    content: 'ALIVE may update this Privacy Policy from time to time to reflect changes in our practices, technology, legal requirements, or other factors. Material changes will be communicated via email notification or a prominent notice on the Platform at least 14 days before they take effect. We encourage you to review this Policy periodically. The "Effective Date" at the top of this Policy indicates when it was last revised.',
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-70 hover:opacity-100 transition-opacity"><Logo /></a>
          <a href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service →</a>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-12 sm:py-16">
        {/* Header */}
        <div className="mb-12 space-y-3 border-b border-border pb-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Legal</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">How We Collect, Use, and Protect Your Information — on wearealive.in and the ALIVE Store app</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-muted-foreground/70">
            <span><strong className="text-muted-foreground">Effective date:</strong> September 7, 2026</span>
            <span><strong className="text-muted-foreground">Company:</strong> VS Collective LLP</span>
            <span><strong className="text-muted-foreground">Location:</strong> Mangaluru, Karnataka, India</span>
            <span><strong className="text-muted-foreground">Privacy email:</strong> hello@wearealive.in</span>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-muted-foreground">
          {sections.map((s) => (
            <section key={s.id} id={s.id}>
              <h2 className="text-base font-bold text-foreground mb-3">{s.title}</h2>

              {'content' in s && s.content && (
                <div className="space-y-3">
                  {s.content.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                </div>
              )}

              {'text' in s && s.text && <p className="mb-3">{s.text}</p>}

              {'bullets' in s && s.bullets && (
                <ul className="space-y-2 pl-4">
                  {s.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {'footer' in s && s.footer && <p className="mt-3 text-muted-foreground/70 italic">{s.footer}</p>}

              {'subsections' in s && s.subsections && (
                <div className="space-y-5">
                  {s.subsections.map((sub) => (
                    <div key={sub.heading}>
                      <h3 className="font-semibold text-foreground text-[13px] mb-1.5">{sub.heading}</h3>
                      {'text' in sub && sub.text && <p>{sub.text}</p>}
                      {'bullets' in sub && sub.bullets && (
                        <ul className="mt-2 space-y-1.5 pl-4">
                          {sub.bullets.map((b, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                              <span>{b}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Grievance Officer */}
          <section id="grievance" className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-base font-bold text-foreground">13. Grievance Officer</h2>
            <p>In accordance with the Information Technology Act, 2000 and associated rules, ALIVE has designated a Grievance Officer to address any concerns or complaints relating to the processing of personal data.</p>
            <div className="text-foreground font-medium space-y-0.5">
              <p>Grievance Officer — VS Collective LLP</p>
              <p className="text-muted-foreground font-normal">217, Milestone 25, Balmatta, Mangalore, Karnataka, India</p>
              <p>Email: <a href="mailto:hello@wearealive.in" className="text-primary hover:underline">hello@wearealive.in</a></p>
              <p className="text-muted-foreground font-normal text-xs">Response time: within 30 days of receipt of grievance</p>
            </div>
          </section>

          {/* Contact */}
          <section id="contact" className="rounded-xl border border-border bg-card p-6 space-y-3">
            <h2 className="text-base font-bold text-foreground">14. Contact Us</h2>
            <p>If you have any questions, concerns, or requests relating to this Privacy Policy, please contact:</p>
            <div className="text-foreground font-medium space-y-0.5">
              <p>VS Collective LLP (ALIVE)</p>
              <p className="text-muted-foreground font-normal">217, Milestone 25, Balmatta, Mangalore, Karnataka, India</p>
              <p>Email: <a href="mailto:hello@wearealive.in" className="text-primary hover:underline">hello@wearealive.in</a></p>
              <p>Phone / WhatsApp: <a href="tel:+919606072227" className="text-primary hover:underline">+91 96060 72227</a></p>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-border/30 py-6 text-center">
        <p className="text-xs text-muted-foreground/40">
          © {new Date().getFullYear()} VS Collective LLP · Mangaluru, Karnataka, India
        </p>
      </footer>
    </div>
  );
}
