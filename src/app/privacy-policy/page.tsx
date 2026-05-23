import { Logo } from '@/components/icons/logo';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — ALIVE Advertising',
  description: 'Privacy Policy for wearealive.in — how ALIVE Advertising collects, uses, and protects your personal information.',
};

const sections = [
  {
    id: 'introduction',
    title: '1. Introduction',
    content: [
      {
        type: 'p',
        text: 'ALIVE Advertising ("ALIVE", "we", "our", or "us"), operated by Vanilla & Somethin\' LLP, owns and operates the platform at wearealive.in (the "Platform"). This Privacy Policy explains how we collect, use, disclose, and protect personal information when you access our Platform or use our services.',
      },
      {
        type: 'p',
        text: 'By using the Platform, you consent to the practices described in this policy. If you do not agree, please discontinue use of the Platform.',
      },
    ],
  },
  {
    id: 'who-applies',
    title: '2. Who This Policy Applies To',
    content: [
      { type: 'p', text: 'This policy applies to:' },
      {
        type: 'ul',
        items: [
          'Brand partners and advertisers who use the Platform to create and manage digital signage campaigns',
          'Kirana store operators ("Screen Operators") who register their screens on the Platform',
          'Visitors to wearealive.in',
        ],
      },
    ],
  },
  {
    id: 'information-collected',
    title: '3. Information We Collect',
    subsections: [
      {
        heading: '3.1 Information You Provide',
        content: [
          { type: 'p', text: 'When you register or use our Platform, we collect:' },
          {
            type: 'ul',
            items: [
              'Full name and business name',
              'Email address',
              'Phone number',
              'Address, city, state, and PIN code',
              'GST number and billing details (for brand partners)',
              'Payment information processed via our payment partners',
            ],
          },
        ],
      },
      {
        heading: '3.2 Information Collected Automatically',
        content: [
          { type: 'p', text: 'When you access the Platform, we automatically collect:' },
          {
            type: 'ul',
            items: [
              'Device type, operating system, and browser information',
              'IP address and approximate location',
              'Pages visited, time spent, and navigation patterns',
              'Screen device identifiers and connectivity status (for registered screens)',
              'Content playback logs (Proof of Play data) from deployed screens',
            ],
          },
        ],
      },
      {
        heading: '3.3 Location Data',
        content: [
          {
            type: 'p',
            text: 'For Screen Operators, we collect the GPS coordinates of registered screen devices to display screen locations on our management map and to provide geo-targeted campaign features to advertisers. Location is collected only upon device registration and updated when changed by the operator.',
          },
        ],
      },
      {
        heading: '3.4 Analytics and Tracking',
        content: [
          { type: 'p', text: 'We use the following analytics tools to understand Platform usage and improve our services:' },
          {
            type: 'ul',
            items: [
              'Google Analytics — to track page views, session behaviour, and traffic sources',
              'Firebase — to monitor app performance, crash reporting, and user engagement',
            ],
          },
          {
            type: 'p',
            text: 'These tools may use cookies and similar tracking technologies. You may opt out of Google Analytics by installing the Google Analytics Opt-out Browser Add-on at tools.google.com/dlpage/gaoptout.',
          },
        ],
      },
    ],
  },
  {
    id: 'how-we-use',
    title: '4. How We Use Your Information',
    content: [
      { type: 'p', text: 'We use collected information to:' },
      {
        type: 'ul',
        items: [
          'Create and manage your account on the Platform',
          'Deliver, schedule, and track digital signage campaigns',
          'Process payments and generate invoices',
          'Send transactional emails (account confirmations, campaign reports, payment receipts)',
          'Send service announcements and product updates (you may unsubscribe at any time)',
          'Provide Proof of Play reports to brand partners',
          'Monitor screen uptime and connectivity',
          'Improve Platform features and fix bugs using analytics data',
          'Comply with applicable laws and regulations, including India\'s Digital Personal Data Protection Act, 2023 (DPDPA)',
        ],
      },
    ],
  },
  {
    id: 'advertising',
    title: '5. Advertising and the ALIVE Platform',
    content: [
      {
        type: 'p',
        text: 'ALIVE is a retail media platform. Brands pay to display advertisements on kirana store screens managed through our Platform. Advertisements are not shown on wearealive.in itself.',
      },
      {
        type: 'p',
        text: 'If you are a brand partner, your campaign content and associated metadata (brand name, creative assets, campaign schedule) are visible to the Screen Operators whose screens your campaign is deployed on.',
      },
      {
        type: 'p',
        text: 'We do not sell your personal information to third parties for their independent advertising purposes.',
      },
    ],
  },
  {
    id: 'payments',
    title: '6. Payments',
    content: [
      {
        type: 'p',
        text: 'Payments for advertising campaigns and subscriptions on the Platform are processed through authorised payment partners including Razorpay and bank transfer. We do not store your full card or bank account details on our servers. Payment data is handled directly by our payment processors in accordance with their respective privacy policies and PCI-DSS standards.',
      },
      {
        type: 'p',
        text: 'We retain transaction records (amount, date, invoice reference) for accounting and legal compliance purposes.',
      },
    ],
  },
  {
    id: 'sharing',
    title: '7. Sharing Your Information',
    content: [
      { type: 'p', text: 'We do not sell, rent, or trade your personal information. We may share it in the following limited circumstances:' },
      {
        type: 'ul',
        items: [
          'Service providers: Third-party vendors who assist us in operating the Platform (cloud hosting, analytics, payment processing, email delivery), bound by confidentiality obligations',
          'Business transfers: In connection with a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction',
          'Legal compliance: When required by law, court order, or governmental authority, or to protect the rights, property, or safety of ALIVE, our users, or others',
          'With your consent: In any other case where you have explicitly authorised sharing',
        ],
      },
    ],
  },
  {
    id: 'retention',
    title: '8. Data Retention',
    content: [
      { type: 'p', text: 'We retain personal information for as long as your account is active or as needed to provide services. Specifically:' },
      {
        type: 'ul',
        items: [
          'Account data is retained for the duration of your account and deleted within 90 days of account closure upon written request',
          'Payment and invoice records are retained for 7 years as required under Indian tax law',
          'Proof of Play and campaign logs are retained for 12 months and then aggregated or deleted',
          'Analytics data is retained per the default retention settings of Google Analytics and Firebase',
        ],
      },
    ],
  },
  {
    id: 'security',
    title: '9. Data Security',
    content: [
      {
        type: 'p',
        text: 'We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, alteration, disclosure, or destruction. These include:',
      },
      {
        type: 'ul',
        items: [
          'HTTPS encryption for all data in transit',
          'Access controls limiting data access to authorised personnel',
          'Regular security reviews of our infrastructure',
        ],
      },
      {
        type: 'p',
        text: 'No system is completely secure. If you believe your account has been compromised, contact us immediately at the details below.',
      },
    ],
  },
  {
    id: 'your-rights',
    title: '10. Your Rights Under India\'s DPDPA',
    content: [
      { type: 'p', text: 'Under the Digital Personal Data Protection Act, 2023, you have the right to:' },
      {
        type: 'ul',
        items: [
          'Access the personal data we hold about you',
          'Correct inaccurate or incomplete personal data',
          'Erasure of your personal data, subject to legal retention obligations',
          'Withdraw consent for processing, where processing is based on consent',
          'Nominate another individual to exercise these rights on your behalf',
        ],
      },
      {
        type: 'p',
        text: 'To exercise any of these rights, contact us at privacy@wearealive.in. We will respond within 30 days.',
      },
    ],
  },
  {
    id: 'cookies',
    title: '11. Cookies',
    content: [
      {
        type: 'p',
        text: 'We use cookies and similar technologies to maintain session state, remember preferences, and collect analytics data. You can control cookie settings through your browser. Disabling cookies may affect the functionality of certain parts of the Platform.',
      },
    ],
  },
  {
    id: 'childrens-privacy',
    title: '12. Children\'s Privacy',
    content: [
      {
        type: 'p',
        text: 'The Platform is intended for business users and is not directed at individuals under the age of 18. We do not knowingly collect personal information from minors. If you believe we have inadvertently collected such information, contact us and we will delete it promptly.',
      },
    ],
  },
  {
    id: 'third-party-links',
    title: '13. Third-Party Links',
    content: [
      {
        type: 'p',
        text: 'The Platform may contain links to third-party websites or services. We are not responsible for the privacy practices of those sites. We encourage you to review their privacy policies before providing any personal information.',
      },
    ],
  },
  {
    id: 'changes',
    title: '14. Changes to This Policy',
    content: [
      {
        type: 'p',
        text: 'We may update this Privacy Policy from time to time. When we do, we will revise the "Last Updated" date at the top and notify registered users by email if changes are material. Continued use of the Platform after changes constitutes acceptance of the updated policy.',
      },
    ],
  },
  {
    id: 'contact',
    title: '15. Contact Us',
    content: [
      { type: 'p', text: 'For privacy-related questions, requests, or concerns, contact:' },
      {
        type: 'address',
        lines: [
          'ALIVE Advertising',
          'Vanilla & Somethin\' LLP',
          'Mangaluru, Karnataka, India',
          'Email: privacy@wearealive.in',
          'Website: wearealive.in',
        ],
      },
      {
        type: 'p',
        text: 'This policy is governed by the laws of India.',
      },
    ],
  },
];

type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'address'; lines: string[] };

function renderBlock(block: ContentBlock, idx: number) {
  if (block.type === 'p') {
    return <p key={idx} className="text-[15px] leading-relaxed text-gray-700">{block.text}</p>;
  }
  if (block.type === 'ul') {
    return (
      <ul key={idx} className="space-y-2 pl-0">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-gray-700">
            <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'address') {
    return (
      <div key={idx} className="rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 space-y-1">
        {block.lines.map((line, i) => (
          <p key={i} className={`text-[14px] ${i === 0 ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
            {line.startsWith('Email:') ? (
              <>Email: <a href="mailto:privacy@wearealive.in" className="text-red-600 hover:underline">privacy@wearealive.in</a></>
            ) : line.startsWith('Website:') ? (
              <>Website: <a href="https://wearealive.in" className="text-red-600 hover:underline">wearealive.in</a></>
            ) : line}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
            <Logo />
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Privacy Policy</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="mb-12 pb-8 border-b border-gray-100">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-500 mb-3">Legal</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">Privacy Policy</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-gray-500">
            <span><span className="font-semibold text-gray-700">Effective date:</span> 23 May 2026</span>
            <span><span className="font-semibold text-gray-700">Last updated:</span> 23 May 2026</span>
          </div>
        </div>

        {/* TOC */}
        <nav className="mb-12 rounded-2xl border border-gray-100 bg-gray-50 px-5 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Contents</p>
          <ol className="space-y-1.5 columns-1 sm:columns-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="text-[13px] text-gray-600 hover:text-red-600 transition-colors"
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        <div className="space-y-12">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-4 pb-3 border-b border-gray-100">
                {section.title}
              </h2>

              {'subsections' in section && section.subsections ? (
                <div className="space-y-6">
                  {section.subsections.map((sub) => (
                    <div key={sub.heading}>
                      <h3 className="text-[13px] font-bold uppercase tracking-widest text-gray-500 mb-3">{sub.heading}</h3>
                      <div className="space-y-3">
                        {sub.content.map((block, i) => renderBlock(block as ContentBlock, i))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {'content' in section && section.content?.map((block, i) => renderBlock(block as ContentBlock, i))}
                </div>
              )}
            </section>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center">
          <p className="text-[13px] text-gray-400">
            © {new Date().getFullYear()} Vanilla & Somethin&#39; LLP · All rights reserved ·{' '}
            <Link href="/" className="text-red-500 hover:underline">wearealive.in</Link>
          </p>
        </div>

      </main>
    </div>
  );
}
