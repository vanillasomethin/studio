'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';

type ContactFormProps = {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  title: string;
};

export default function ContactForm({ isOpen, onOpenChange, title }: ContactFormProps) {
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [message, setMessage] = useState('');
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const reset = () => {
    setName(''); setEmail(''); setPhone(''); setMessage('');
    setDone(false); setError(null);
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, message, subject: title }),
      });
      if (!res.ok) throw new Error('Failed to send');
      setDone(true);
    } catch {
      setError('Something went wrong. Please email us at hello@wearealive.in directly.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">{title}</DialogTitle>
          <DialogDescription>
            Fill out the form and your dedicated Account Manager will reach out within 24 hours.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="space-y-1">
              <p className="font-bold text-foreground text-lg">We got your message!</p>
              <p className="text-sm text-muted-foreground">Your Account Manager will reach out within 24 hours.</p>
            </div>
            <Button variant="outline" onClick={() => handleClose(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {error && (
              <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2.5">{error}</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210" type="tel"
                  className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email *</label>
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@company.com"
                className="w-full h-10 rounded-lg border border-border bg-card px-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Message</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us about your brand, product, or campaign goals…"
                rows={3}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none" />
            </div>

            <Button type="submit" disabled={busy} className="w-full h-11">
              {busy ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</> : 'Send message'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
