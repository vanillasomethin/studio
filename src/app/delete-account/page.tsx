'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/icons/logo';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function DeleteAccountPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', accountType: 'brand', message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() && !form.phone.trim()) {
      setError('Please provide your email or phone so we can identify your account.');
      return;
    }
    setError('');
    setStatus('loading');
    try {
      const res = await fetch('/api/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Request failed');
      }
      setStatus('done');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="opacity-80 hover:opacity-100 transition-opacity">
            <Logo />
          </Link>
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Data Deletion</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 sm:px-6 py-12 sm:py-16">

        {status === 'done' ? (
          <div className="text-center space-y-4 py-16">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-black tracking-tight text-gray-900">Request received</h1>
            <p className="text-gray-600 max-w-sm mx-auto leading-relaxed">
              We&apos;ll verify your identity and process your deletion request within <strong>30 days</strong> as required under India&apos;s DPDPA.
              You&apos;ll receive a confirmation at the email or phone you provided.
            </p>
            <p className="text-sm text-gray-400">
              Questions? Email{' '}
              <a href="mailto:privacy@wearealive.in" className="text-red-600 hover:underline">privacy@wearealive.in</a>
            </p>
            <Link href="/" className="inline-block mt-4 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors">
              ← Back to home
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-500 mb-3">Your rights · DPDPA 2023</p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gray-900 mb-4">
                Request account &amp; data deletion
              </h1>
              <p className="text-gray-600 leading-relaxed">
                You have the right to request erasure of your personal data under India&apos;s Digital Personal Data Protection Act, 2023.
                Fill in the form below and we&apos;ll process your request within 30 days.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">Full name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Ramesh Sharma"
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                    Account type
                  </label>
                  <select
                    value={form.accountType}
                    onChange={e => set('accountType', e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all bg-white"
                  >
                    <option value="brand">Brand / Advertiser</option>
                    <option value="store">Kirana Store Partner</option>
                    <option value="consumer">Shopper / Consumer</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Email address <span className="text-red-400 normal-case font-normal tracking-normal">*</span>
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Phone / WhatsApp <span className="text-gray-400 normal-case font-normal tracking-normal">(if registered with phone)</span>
                </label>
                <div className="flex">
                  <span className="flex items-center px-3 rounded-l-xl text-sm font-bold border-y border-l border-gray-200 bg-gray-50 text-gray-600">+91</span>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="98765 43210"
                    className="flex-1 rounded-r-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500">
                  Additional details <span className="text-gray-400 normal-case font-normal tracking-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={form.message}
                  onChange={e => set('message', e.target.value)}
                  placeholder="Any additional context about your account or the data you'd like deleted…"
                  className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 transition-all resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {status === 'loading' ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                ) : 'Submit deletion request'}
              </button>

              <p className="text-xs text-center text-gray-400 leading-relaxed">
                We&apos;ll verify your identity before processing. Deletion is permanent and irreversible.
                Some data may be retained for up to 7 years for tax and legal compliance.{' '}
                <Link href="/privacy-policy#retention" className="text-gray-500 hover:text-gray-700 underline">
                  See our retention policy.
                </Link>
              </p>
            </form>

            <div className="mt-10 rounded-xl border border-gray-100 bg-gray-50 px-5 py-4 text-[13px] text-gray-500 space-y-1">
              <p className="font-semibold text-gray-700">Prefer email?</p>
              <p>
                Send your request directly to{' '}
                <a href="mailto:privacy@wearealive.in?subject=Data%20Deletion%20Request" className="text-red-600 hover:underline">
                  privacy@wearealive.in
                </a>{' '}
                with your registered email or phone and we&apos;ll respond within 30 days.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
