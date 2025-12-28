import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Package, Store, Users, ShoppingBag, BarChart, Info, Briefcase, Newspaper, UsersRound } from 'lucide-react';
import { Logo } from '../icons/logo';
import Link from 'next/link';

const navLinks = [
  { href: '#how-it-works', label: 'How It Works', icon: Info, isHash: true },
  { href: '#features', label: 'Features', icon: Package, isHash: true },
  { href: '#market-proof', label: 'Market Proof', icon: BarChart, isHash: true },
  { href: '#testimonials', label: 'Testimonials', icon: Users, isHash: true },
];

const pageLinks = [
  { href: '/team', label: 'Team', icon: UsersRound },
  { href: '/careers', label: 'Careers', icon: Briefcase },
  { href: '/blog', label: 'Blog', icon: Newspaper },
];

type HeaderProps = {
  onGetStartedClick: () => void;
};


export default function Header({ onGetStartedClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="container flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a href="#" className="flex items-center gap-2">
          <Logo />
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
          {pageLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Button className="hidden md:flex" onClick={onGetStartedClick}>
            Get Started
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <div className="flex flex-col gap-6 p-6">
                <a href="#" className="flex items-center gap-2">
                    <Logo />
                </a>
                <nav className="flex flex-col gap-4">
                  {navLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      className="flex items-center gap-3 rounded-md p-2 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </a>
                  ))}
                  {pageLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="flex items-center gap-3 rounded-md p-2 text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <link.icon className="h-5 w-5" />
                      {link.label}
                    </Link>
                  ))}
                </nav>
                 <Button variant="default" onClick={onGetStartedClick}>
                    Get Started
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
