'use client';

import { useState, useRef, useCallback, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  FileImage,
  FileVideo,
  Trash2,
  Loader2,
  AlertCircle,
  TrendingUp,
  Eye,
  Monitor,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

type UploadedFile = { name: string; size: number; type: string; url: string };

type OnboardingFormData = {
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  adCreative: UploadedFile | null;
  logo: UploadedFile | null;
  screens: number;
  months: number;
  startDate: string;
  agreementSigned: boolean;
  signatureName: string;
};

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCREEN_TIERS = [
  { screens: 1, pricePerScreen: 799, total: 799, playsPerDay: 144, monthlyViews: 4320 },
  { screens: 3, pricePerScreen: 699, total: 2097, playsPerDay: 432, monthlyViews: 12960, popular: true },
  { screens: 10, pricePerScreen: 599, total: 5990, playsPerDay: 1440, monthlyViews: 43200 },
  { screens: 20, pricePerScreen: 549, total: 10980, playsPerDay: 2880, monthlyViews: 86400 },
] as const;

const DURATION_OPTIONS = [
  { months: 1, label: '1 month' },
  { months: 2, label: '2 months' },
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
];

const STEPS = ['Details', 'Creatives', 'Campaign', 'Agreement', 'Payment'];

// ─── Utilities ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `₹${n.toLocaleString('en-IN')}`;

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof (window as Window & { Razorpay?: unknown }).Razorpay !== 'undefined') {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Razorpay failed to load'));
    document.head.appendChild(s);
  });
}

// ─── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  // current is 1-indexed; STEPS covers steps 2-6 of the 7-step wizard
  const active = current - 1; // 1-5
  return (
    <div className="flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = active > n;
        const isActive = active === n;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? 'bg-primary text-primary-foreground'
                    : isActive
                      ? 'bg-primary text-primary-foreground ring-[3px] ring-primary/25'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </div>
              <span
                className={`hidden sm:block text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  isActive ? 'text-foreground' : 'text-muted-foreground/60'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px mx-2 sm:mx-3 mb-5 w-8 sm:w-12 transition-colors duration-300 ${
                  done ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Drop Zone ─────────────────────────────────────────────────────────────────

function DropZone({
  label,
  accept,
  spec,
  file,
  onFile,
  onClear,
  Icon,
}: {
  label: string;
  accept: string;
  spec: string;
  file: UploadedFile | null;
  onFile: (f: UploadedFile) => void;
  onClear: () => void;
  Icon: ComponentType<{ className?: string }>;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files?.length) return;
      const f = files[0];
      onFile({ name: f.name, size: f.size, type: f.type, url: URL.createObjectURL(f) });
    },
    [onFile],
  );

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      {file ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground leading-none">{file.name}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs font-semibold text-green-500">
              <Check className="h-3 w-3" /> Uploaded
            </span>
            <button
              type="button"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragEnter={() => setDragging(true)}
          onDragLeave={() => setDragging(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`group flex w-full items-center gap-4 rounded-lg border px-5 py-4 text-left transition-all ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-dashed border-border hover:border-primary/40 hover:bg-muted/30'
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors group-hover:bg-primary/10">
            <Icon className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Drop file or{' '}
              <span className="text-primary underline underline-offset-2">browse</span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{spec}</p>
          </div>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

// ─── Steps ─────────────────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-12 py-10">
      <div className="space-y-6 max-w-xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Brand Onboarding
        </p>
        <h1 className="text-[42px] sm:text-[56px] font-bold tracking-tight leading-[1.08] text-foreground">
          Your brand.
          <br />
          <span className="text-primary">Every kirana. Every day.</span>
        </h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          Alive places your ads on digital screens inside kirana stores across
          the city — reaching millions of daily shoppers at the exact moment they
          make purchase decisions.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-lg">
        {[
          { n: '01', title: 'Upload', sub: 'Ad creative + logo' },
          { n: '02', title: 'Configure', sub: 'Screens & duration' },
          { n: '03', title: 'Launch', sub: 'Sign & pay online' },
        ].map(({ n, title, sub }) => (
          <div
            key={n}
            className="rounded-xl border border-border bg-card p-5 text-left space-y-3"
          >
            <span className="text-[10px] font-black tracking-[0.2em] text-primary/60 uppercase">
              {n}
            </span>
            <div>
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4">
        <Button
          size="lg"
          onClick={onNext}
          className="gap-2 px-10 h-12 text-sm font-bold tracking-wide"
        >
          Begin onboarding <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-xs text-muted-foreground/50 tracking-wide">
          Takes less than 10 minutes · 2025 · Alive Media Pvt. Ltd.
        </p>
      </div>
    </div>
  );
}

function StepDetails({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.brandName && data.contactName && data.email;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Brand details</h2>
        <p className="text-sm text-muted-foreground">
          Basic information to set up your advertiser account.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {[
          { id: 'brandName', label: 'Brand name', placeholder: 'e.g. Amul, Parle, Haldirams', req: true },
          { id: 'contactName', label: 'Your name', placeholder: 'Full name', req: true },
          { id: 'email', label: 'Work email', placeholder: 'you@brand.com', type: 'email', req: true },
          { id: 'phone', label: 'Phone / WhatsApp', placeholder: '+91 98765 43210', type: 'tel', req: false },
        ].map(({ id, label, placeholder, type, req }) => (
          <div key={id} className="space-y-1.5">
            <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {label}{req && <span className="text-primary ml-0.5">*</span>}
            </Label>
            <Input
              id={id}
              type={type ?? 'text'}
              placeholder={placeholder}
              value={(data as Record<string, string>)[id]}
              onChange={(e) => onChange(id as keyof OnboardingFormData, e.target.value)}
              className="h-11"
            />
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 h-11 px-7">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepCreatives({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: UploadedFile | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const CreativeIcon = data.adCreative?.type.startsWith('video') ? FileVideo : FileImage;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Upload creatives</h2>
        <p className="text-sm text-muted-foreground">
          Your ad and logo are all we need. Our team handles the rest.
        </p>
      </div>

      <div className="space-y-6">
        <DropZone
          label="Ad creative"
          accept="video/mp4,image/jpeg,image/png"
          spec="MP4 · JPEG · PNG  ·  1920 × 1080 px  ·  Max 100 MB  ·  10 / 15 / 30 sec for video"
          file={data.adCreative}
          onFile={(f) => onChange('adCreative', f)}
          onClear={() => onChange('adCreative', null)}
          Icon={CreativeIcon}
        />
        <DropZone
          label="Brand logo"
          accept="image/png"
          spec="PNG with transparent background  ·  Min 500 px wide  ·  RGB colour"
          file={data.logo}
          onFile={(f) => onChange('logo', f)}
          onClear={() => onChange('logo', null)}
          Icon={FileImage}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!data.adCreative || !data.logo}
          className="gap-1.5 h-11 px-7"
        >
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepCampaign({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: number | string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const selectedTier = SCREEN_TIERS.find((t) => t.screens === data.screens) ?? SCREEN_TIERS[0];
  const total = selectedTier.total * data.months;
  const valid = data.screens > 0 && data.months > 0 && data.startDate;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Campaign setup</h2>
        <p className="text-sm text-muted-foreground">
          Choose your screen count, start date, and duration.
        </p>
      </div>

      {/* Screen tiers */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Screen plan
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SCREEN_TIERS.map((tier) => {
            const selected = data.screens === tier.screens;
            return (
              <button
                key={tier.screens}
                type="button"
                onClick={() => onChange('screens', tier.screens)}
                className={`relative rounded-xl border p-4 text-left transition-all duration-200 ${
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                {'popular' in tier && tier.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                    Best value
                  </span>
                )}
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-black text-foreground leading-none">
                      {tier.screens}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {tier.screens === 1 ? 'screen' : 'screens'}
                    </p>
                  </div>
                  <div className="border-t border-border pt-3 space-y-1">
                    <p className="text-sm font-bold text-foreground">{fmt(tier.pricePerScreen)}</p>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      per screen / month
                    </p>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 shrink-0" />
                      ~{tier.playsPerDay.toLocaleString('en-IN')} plays/day
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3 shrink-0" />
                      {tier.monthlyViews.toLocaleString('en-IN')} views/mo
                    </div>
                  </div>
                </div>
                {selected && (
                  <div className="absolute right-3 top-3">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration + Start date */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Campaign duration
          </p>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map(({ months, label }) => (
              <button
                key={months}
                type="button"
                onClick={() => onChange('months', months)}
                className={`rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                  data.months === months
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label
            htmlFor="startDate"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Campaign start date <span className="text-primary">*</span>
          </Label>
          <Input
            id="startDate"
            type="date"
            value={data.startDate}
            onChange={(e) => onChange('startDate', e.target.value)}
            className="h-11"
          />
        </div>
      </div>

      {/* Live total */}
      {data.screens > 0 && data.months > 0 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Campaign total
              </p>
              <p className="text-sm text-muted-foreground">
                {fmt(selectedTier.pricePerScreen)} × {data.screens}{' '}
                {data.screens === 1 ? 'screen' : 'screens'} × {data.months}{' '}
                {data.months === 1 ? 'month' : 'months'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-foreground tracking-tight">{fmt(total)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">incl. GST to be invoiced</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4">
            {[
              { icon: Monitor, label: 'Screens', value: data.screens.toString() },
              { icon: TrendingUp, label: 'Daily plays', value: `~${(selectedTier.playsPerDay * data.months / data.months).toLocaleString('en-IN')}` },
              { icon: Eye, label: 'Total views', value: `~${(selectedTier.monthlyViews * data.months).toLocaleString('en-IN')}` },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-center">
                <Icon className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                <p className="text-sm font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 h-11 px-7">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepAgreement({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: OnboardingFormData;
  onChange: (k: keyof OnboardingFormData, v: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.agreementSigned && data.signatureName.trim().length > 2;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Advertiser agreement</h2>
        <p className="text-sm text-muted-foreground">
          Please review and sign before proceeding to payment.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 h-64 overflow-y-auto p-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-bold text-[13px] uppercase tracking-wider">
          Alive Advertiser Agreement · 2025
        </p>
        <p>
          This Agreement is entered into between{' '}
          <strong className="text-foreground">{data.brandName || '[Brand Name]'}</strong>{' '}
          ("Advertiser") and Alive Media Pvt. Ltd. ("Alive"), effective as of the campaign
          start date provided during onboarding.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          1 · Services
        </p>
        <p>
          Alive agrees to display the Advertiser's creative on its network of digital screens
          inside kirana retail stores for the campaign duration and screen count selected during
          onboarding.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          2 · Creative content
        </p>
        <p>
          Advertiser warrants ownership of all rights to the submitted creative content,
          including trademarks, imagery, and music. Advertiser indemnifies Alive against any
          third-party claims arising from the content.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          3 · Content standards
        </p>
        <p>
          All creatives must comply with applicable advertising standards. Alive reserves the
          right to reject or remove content that is misleading, offensive, or illegal, without
          refund.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          4 · Payment
        </p>
        <p>
          Campaign fees are due in advance. Alive will issue a GST invoice within 2 business
          days of payment confirmation. Campaigns go live only after payment is received.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          5 · Reporting
        </p>
        <p>
          Alive will provide a mid-campaign and end-of-campaign performance report covering
          estimated impressions, screen uptime, and store-level breakdowns.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          6 · Cancellations
        </p>
        <p>
          Cancellations made more than 5 business days before campaign start are eligible for a
          full refund. Cancellations within 5 days of campaign start are non-refundable.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          7 · Liability
        </p>
        <p>
          Alive's total liability shall not exceed the fees paid for the relevant campaign.
          Alive is not liable for indirect or consequential losses.
        </p>
        <p className="font-semibold text-foreground text-xs uppercase tracking-wider">
          8 · Governing law
        </p>
        <p>
          This Agreement is governed by the laws of India. Disputes shall be resolved by
          arbitration in Mumbai under the Arbitration and Conciliation Act, 1996.
        </p>
      </div>

      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <Checkbox
            id="agree"
            checked={data.agreementSigned}
            onCheckedChange={(v) => onChange('agreementSigned', !!v)}
            className="mt-0.5"
          />
          <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer text-muted-foreground">
            I have read and agree to the Alive Advertiser Agreement. I confirm I am authorised
            to sign on behalf of{' '}
            <strong className="text-foreground">{data.brandName || 'my brand'}</strong>.
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="sig"
            className="text-xs font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Full name — digital signature <span className="text-primary">*</span>
          </Label>
          <Input
            id="sig"
            placeholder="Type your full name to sign"
            value={data.signatureName}
            onChange={(e) => onChange('signatureName', e.target.value)}
            className="h-11"
            style={data.signatureName.length > 2 ? { fontStyle: 'italic', fontSize: '1.05rem' } : {}}
          />
          {data.signatureName.length > 2 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-500" />
              Signed as{' '}
              <span className="font-semibold text-foreground">{data.signatureName}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5 h-11">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 h-11 px-7">
          Proceed to payment <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepPayment({
  data,
  onSuccess,
  onBack,
}: {
  data: OnboardingFormData;
  onSuccess: (paymentId: string) => void;
  onBack: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tier = SCREEN_TIERS.find((t) => t.screens === data.screens) ?? SCREEN_TIERS[0];
  const total = tier.total * data.months;

  const handlePay = async () => {
    setLoading(true);
    setError(null);

    try {
      await loadRazorpayScript();

      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: total,
          receipt: `alive_${Date.now()}`,
          notes: {
            brand: data.brandName,
            email: data.email,
            screens: data.screens,
            months: data.months,
          },
        }),
      });

      if (!res.ok) throw new Error('Could not create payment order');
      const order = await res.json();

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: 'INR',
        name: 'Alive Media',
        description: `${data.screens} screen${data.screens > 1 ? 's' : ''} · ${data.months} month${data.months > 1 ? 's' : ''}`,
        order_id: order.id,
        handler: async (response: RazorpayResponse) => {
          const verify = await fetch('/api/razorpay/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          });
          const result = await verify.json();
          if (result.success) {
            onSuccess(response.razorpay_payment_id);
          } else {
            setError('Payment verification failed. Please contact hello@alive.agency.');
            setLoading(false);
          }
        },
        prefill: { name: data.contactName, email: data.email, contact: data.phone },
        theme: { color: '#dc2626' },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new (window as Window & { Razorpay: new (o: typeof options) => { open: () => void; on: (e: string, cb: (r: { error: { description: string } }) => void) => void } }).Razorpay(options);
      rzp.on('payment.failed', (r) => {
        setError(r.error.description ?? 'Payment failed. Please try again.');
        setLoading(false);
      });
      rzp.open();
    } catch (e) {
      setError((e as Error).message ?? 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Payment</h2>
        <p className="text-sm text-muted-foreground">
          Review your order and pay securely via Razorpay.
        </p>
      </div>

      {/* Order summary */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Order summary
          </p>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          {[
            ['Brand', data.brandName],
            ['Screens', `${data.screens} screen${data.screens > 1 ? 's' : ''}`],
            ['Duration', `${data.months} month${data.months > 1 ? 's' : ''}`],
            ['Price per screen / month', fmt(tier.pricePerScreen)],
            ['Start date', data.startDate ? new Date(data.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
            ['Estimated daily plays', `~${(tier.playsPerDay).toLocaleString('en-IN')}`],
            ['Total campaign views', `~${(tier.monthlyViews * data.months).toLocaleString('en-IN')}`],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-sm font-bold text-foreground uppercase tracking-wide">Total due</span>
          <span className="text-2xl font-black text-foreground">{fmt(total)}</span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="space-y-3">
        <Button
          onClick={handlePay}
          disabled={loading}
          className="w-full h-13 text-sm font-bold gap-2.5 py-3.5"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Opening Razorpay…
            </>
          ) : (
            <>
              Pay {fmt(total)} with Razorpay <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-center text-xs text-muted-foreground/70">
          Secured by Razorpay · 256-bit SSL · PCI DSS compliant
        </p>
      </div>

      <Button variant="ghost" onClick={onBack} className="gap-1.5 -mt-2">
        <ArrowLeft className="h-4 w-4" /> Back to agreement
      </Button>
    </div>
  );
}

function StepDone({ data, paymentId }: { data: OnboardingFormData; paymentId: string }) {
  const tier = SCREEN_TIERS.find((t) => t.screens === data.screens) ?? SCREEN_TIERS[0];
  const total = tier.total * data.months;

  return (
    <div className="flex flex-col items-center text-center gap-10 py-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-8 ring-green-500/5">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-black tracking-tight text-foreground">
          Campaign confirmed.
        </h2>
        <p className="max-w-md mx-auto text-muted-foreground leading-relaxed">
          Welcome to Alive,{' '}
          <strong className="text-foreground">{data.brandName}</strong>. Your payment of{' '}
          <strong className="text-foreground">{fmt(total)}</strong> is confirmed and your
          campaign is now scheduled. Expect a GST invoice at{' '}
          <strong className="text-foreground">{data.email}</strong> within 2 business days.
        </p>
      </div>

      <div className="w-full max-w-md space-y-2">
        {[
          { label: 'Payment ID', value: paymentId, done: true },
          { label: 'Screens booked', value: `${data.screens} screen${data.screens > 1 ? 's' : ''}`, done: true },
          { label: 'Campaign duration', value: `${data.months} month${data.months > 1 ? 's' : ''}`, done: true },
          { label: 'Creatives reviewed by our team', value: 'Within 1 business day', done: false },
          { label: 'Ads go live', value: data.startDate ? new Date(data.startDate + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Per schedule', done: false },
        ].map(({ label, value, done }) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <div className="flex items-center gap-2.5">
              <div className={`flex h-5 w-5 items-center justify-center rounded-full ${done ? 'bg-green-500/15' : 'bg-muted'}`}>
                {done ? <Check className="h-3 w-3 text-green-500" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />}
              </div>
              <span className="text-muted-foreground">{label}</span>
            </div>
            <span className="font-semibold text-foreground font-mono text-xs">{value}</span>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <p>
          Questions?{' '}
          <a href="mailto:hello@alive.agency" className="text-primary underline underline-offset-2 hover:no-underline">
            hello@alive.agency
          </a>
        </p>
        <p className="text-xs text-muted-foreground/60">
          Your brand deserves to be seen — and now it will be.
        </p>
      </div>

      <a
        href="/"
        className="text-xs text-muted-foreground/50 hover:text-muted-foreground underline underline-offset-2 transition-colors"
      >
        Return to alive.agency
      </a>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

const INITIAL: OnboardingFormData = {
  brandName: '',
  contactName: '',
  email: '',
  phone: '',
  adCreative: null,
  logo: null,
  screens: 3,
  months: 1,
  startDate: '',
  agreementSigned: false,
  signatureName: '',
};

export default function BrandOnboardingPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingFormData>(INITIAL);
  const [paymentId, setPaymentId] = useState('');

  const update = (key: keyof OnboardingFormData, value: OnboardingFormData[keyof OnboardingFormData]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  const showIndicator = step >= 2 && step <= 6;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/30 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="opacity-80 hover:opacity-100 transition-opacity">
            <Logo />
          </a>
          {showIndicator && <StepIndicator current={step - 1} />}
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50">
            Confidential
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {step === 1 && <StepWelcome onNext={next} />}
            {step === 2 && (
              <StepDetails
                data={form}
                onChange={(k, v) => update(k, v as string)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 3 && (
              <StepCreatives
                data={form}
                onChange={(k, v) => update(k, v)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 4 && (
              <StepCampaign
                data={form}
                onChange={(k, v) => update(k, v as number | string)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 5 && (
              <StepAgreement
                data={form}
                onChange={(k, v) => update(k, v)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 6 && (
              <StepPayment
                data={form}
                onSuccess={(pid) => {
                  setPaymentId(pid);
                  next();
                }}
                onBack={back}
              />
            )}
            {step === 7 && <StepDone data={form} paymentId={paymentId} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-5 text-center">
        <p className="text-xs text-muted-foreground/40 tracking-wide">
          © 2025 Alive Media Pvt. Ltd. ·{' '}
          <a href="mailto:hello@alive.agency" className="hover:text-muted-foreground transition-colors">
            hello@alive.agency
          </a>
        </p>
      </footer>
    </div>
  );
}
