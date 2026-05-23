import { Logo } from '../icons/logo';

const footerLinks = [
    { title: "Company", links: ["About Us", "Team", "Careers"] },
    { title: "Solutions", links: ["For Brands", "For Kiranas", "For Consumers"] },
    { title: "Resources", links: ["Blog", "Case Studies", "Help Center"] },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Delete my data", href: "/delete-account" },
];

export default function Footer() {
  return (
    <footer className="bg-secondary" style={{ scrollSnapAlign: 'end' }}>
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div className="md:col-span-1 space-y-4">
                <Logo />
                <p className="text-sm text-muted-foreground">
                    Transforming kirana stores into discovery moments.
                </p>
            </div>
            <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-8">
                {footerLinks.map((section) => (
                    <div key={section.title}>
                        <h3 className="font-headline font-semibold text-foreground">{section.title}</h3>
                        <ul className="mt-4 space-y-2">
                            {section.links.map((link) => (
                                <li key={link}>
                                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                                        {link}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </div>
        <div className="mt-12 border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Vanilla &amp; Somethin&apos; LLP. All rights reserved.</p>
            <div className="flex gap-4">
              {legalLinks.map(l => (
                <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">{l.label}</a>
              ))}
            </div>
        </div>
      </div>
    </footer>
  );
}
