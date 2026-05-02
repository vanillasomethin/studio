'use client';

import { useState, useRef, useCallback, type ComponentType } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Logo } from '@/components/icons/logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  FileVideo,
  FileImage,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Calendar,
  MapPin,
  CreditCard,
  Shield,
  FileText,
  Trash2,
  AlertCircle,
  Check,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadedFile = {
  name: string;
  size: number;
  type: string;
  url: string;
};

type FormData = {
  brandName: string;
  contactName: string;
  email: string;
  phone: string;
  adCreative: UploadedFile | null;
  logo: UploadedFile | null;
  startDate: string;
  duration: string;
  targetAreas: string;
  specialInstructions: string;
  agreementSigned: boolean;
  signatureName: string;
  cardNumber: string;
  cardExpiry: string;
  cardCvc: string;
  billingName: string;
};

const STEPS = [
  { id: 1, label: 'Welcome', icon: Sparkles },
  { id: 2, label: 'Your Details', icon: FileText },
  { id: 3, label: 'Upload Creatives', icon: Upload },
  { id: 4, label: 'Campaign', icon: Calendar },
  { id: 5, label: 'Agreement', icon: Shield },
  { id: 6, label: 'Payment', icon: CreditCard },
  { id: 7, label: 'Done', icon: CheckCircle2 },
];

const DURATION_OPTIONS = ['1 week', '2 weeks', '1 month', '3 months', '6 months', 'Custom'];

// ─── File Drop Zone ────────────────────────────────────────────────────────────

function DropZone({
  label,
  accept,
  hint,
  file,
  onFile,
  onClear,
  icon: Icon,
}: {
  label: string;
  accept: string;
  hint: string;
  file: UploadedFile | null;
  onFile: (f: UploadedFile) => void;
  onClear: () => void;
  icon: ComponentType<{ className?: string }>;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const f = files[0];
      const url = URL.createObjectURL(f);
      onFile({ name: f.name, size: f.size, type: f.type, url });
    },
    [onFile],
  );

  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-foreground">{label}</Label>
      {file ? (
        <div className="flex items-center justify-between rounded-xl border border-primary/40 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <button
              type="button"
              onClick={onClear}
              className="rounded-md p-1 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
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
          className={`group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-all ${
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/60 hover:bg-muted/40'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
            <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Drop file here or <span className="text-primary">browse</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
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

// ─── Spec Table ───────────────────────────────────────────────────────────────

function SpecTable({
  title,
  rows,
}: {
  title: string;
  rows: [string, string][];
}) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/50 px-4 py-2 border-b border-border">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([key, val], i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
              <td className="px-4 py-2 text-muted-foreground font-medium w-2/5">{key}</td>
              <td className="px-4 py-2 text-foreground">{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Step Components ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-8">
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Welcome aboard!
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your brand. Every kirana.{' '}
          <span className="text-primary">Every day.</span>
        </h1>
        <p className="max-w-xl mx-auto text-lg text-muted-foreground leading-relaxed">
          We run digital screens inside kirana stores across the city — and now
          your brand gets to show up there too. Getting started takes less than
          10 minutes.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {[
          { step: '01', title: 'Upload your creatives', desc: 'Ad video or image + your logo' },
          { step: '02', title: 'Set campaign details', desc: 'Pick dates, duration & target zones' },
          { step: '03', title: 'Sign & pay', desc: 'Digital agreement + secure payment' },
        ].map((item) => (
          <div
            key={item.step}
            className="rounded-xl border border-border bg-card p-5 text-left space-y-2"
          >
            <span className="text-xs font-bold text-primary tracking-wider">{item.step}</span>
            <p className="font-semibold text-foreground text-sm">{item.title}</p>
            <p className="text-xs text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>

      <Button size="lg" onClick={onNext} className="gap-2 px-8">
        Let's get started <ArrowRight className="h-4 w-4" />
      </Button>
      <p className="text-xs text-muted-foreground">2025 · Confidential · alive.agency</p>
    </div>
  );
}

function StepDetails({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.brandName && data.contactName && data.email;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Tell us about your brand</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Basic details so we can set up your account.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="brandName">Brand name *</Label>
          <Input
            id="brandName"
            placeholder="e.g. Amul, Parle, Haldirams"
            value={data.brandName}
            onChange={(e) => onChange('brandName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Your name *</Label>
          <Input
            id="contactName"
            placeholder="Full name"
            value={data.contactName}
            onChange={(e) => onChange('contactName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@yourbrand.com"
            value={data.email}
            onChange={(e) => onChange('email', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">WhatsApp / Phone</Label>
          <Input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={data.phone}
            onChange={(e) => onChange('phone', e.target.value)}
          />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5">
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
  data: FormData;
  onChange: (k: keyof FormData, v: UploadedFile | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Upload your creatives</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Your ad file and logo — that's all we need to get started.
        </p>
      </div>

      <div className="space-y-5">
        <DropZone
          label="Ad Creative (video or image) *"
          accept="video/mp4,image/jpeg,image/png"
          hint="MP4 · JPEG · PNG — 1920×1080px, max 100 MB"
          file={data.adCreative}
          onFile={(f) => onChange('adCreative', f)}
          onClear={() => onChange('adCreative', null)}
          icon={data.adCreative?.type.startsWith('video') ? FileVideo : FileImage}
        />

        <DropZone
          label="Logo (PNG with transparent background) *"
          accept="image/png"
          hint="PNG · transparent background · min 500px wide"
          file={data.logo}
          onFile={(f) => onChange('logo', f)}
          onClear={() => onChange('logo', null)}
          icon={FileImage}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <SpecTable
          title="Video ads"
          rows={[
            ['Format', 'MP4 (H.264)'],
            ['Aspect ratio', '16:9'],
            ['Resolution', '1920 × 1080 px'],
            ['Duration', '10, 15, or 30 sec'],
            ['Max size', '100 MB'],
            ['Audio', 'Optional'],
          ]}
        />
        <SpecTable
          title="Static image ads"
          rows={[
            ['Format', 'JPEG or PNG'],
            ['Aspect ratio', '16:9'],
            ['Resolution', '1920 × 1080 px'],
            ['Max size', '5 MB'],
            ['Colour mode', 'RGB'],
          ]}
        />
        <SpecTable
          title="Logo"
          rows={[
            ['Format', 'PNG'],
            ['Background', 'Transparent'],
            ['Min width', '500 px'],
            ['Colour', 'RGB (not CMYK)'],
          ]}
        />
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">No designer?</span> Ask your Account
          Manager about our creative production add-on.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!data.adCreative || !data.logo} className="gap-1.5">
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
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.startDate && data.duration;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Campaign details</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Tell us when you want to go live and where.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="startDate" className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Campaign start date *
          </Label>
          <Input
            id="startDate"
            type="date"
            value={data.startDate}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => onChange('startDate', e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Duration *</Label>
          <div className="grid grid-cols-3 gap-2">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange('duration', opt)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                  data.duration === opt
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="targetAreas" className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Target areas or store clusters
        </Label>
        <Input
          id="targetAreas"
          placeholder="e.g. Andheri West, Powai, Bandra — or leave blank for citywide"
          value={data.targetAreas}
          onChange={(e) => onChange('targetAreas', e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Leave blank to target all available stores in your city.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="specialInstructions">Special instructions</Label>
        <Textarea
          id="specialInstructions"
          placeholder="Any specific timing preferences, store types, or notes for our team..."
          rows={3}
          value={data.specialInstructions}
          onChange={(e) => onChange('specialInstructions', e.target.value)}
        />
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Typical timeline
        </p>
        <div className="space-y-2">
          {[
            ['Files received + approved', 'Day 1'],
            ['Campaign scheduled', 'Day 2'],
            ['Ads live on screens', 'Day 3 (or your chosen start date)'],
            ['Mid-campaign report', 'Halfway through your campaign'],
            ['End-of-campaign report', 'Within 3 days of campaign end'],
          ].map(([event, timing]) => (
            <div key={event} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{event}</span>
              <span className="font-medium text-foreground">{timing}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5">
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
  data: FormData;
  onChange: (k: keyof FormData, v: string | boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid = data.agreementSigned && data.signatureName.trim().length > 2;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Digital agreement</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Please read and sign the advertiser agreement below.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 h-72 overflow-y-auto p-6 space-y-4 text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground font-semibold text-base">
          ALIVE ADVERTISER AGREEMENT — 2025
        </p>
        <p>
          This Agreement is entered into between <strong className="text-foreground">{data.brandName || '[Brand Name]'}</strong>{' '}
          ("Advertiser") and Alive Media Pvt. Ltd. ("Alive"), effective as of the campaign start
          date specified during onboarding.
        </p>
        <p className="font-semibold text-foreground">1. Services</p>
        <p>
          Alive agrees to display the Advertiser's creative content ("Ad") on its network of
          digital screens installed inside kirana retail stores. The Ad will be displayed for the
          campaign duration and in the store clusters selected during onboarding.
        </p>
        <p className="font-semibold text-foreground">2. Creative Content</p>
        <p>
          Advertiser warrants that it holds all necessary rights to the Ad content, including any
          music, imagery, trademarks, and other intellectual property. Advertiser indemnifies Alive
          against any third-party claims arising from the Ad content.
        </p>
        <p className="font-semibold text-foreground">3. Content Standards</p>
        <p>
          All Ads must comply with applicable advertising standards. Alive reserves the right to
          reject or remove Ads that are misleading, offensive, illegal, or otherwise inappropriate
          without refund.
        </p>
        <p className="font-semibold text-foreground">4. Payment</p>
        <p>
          Campaign fees are payable in advance. Alive will issue a tax invoice within 2 business
          days of payment. Campaigns will not go live until payment is confirmed.
        </p>
        <p className="font-semibold text-foreground">5. Campaign Reporting</p>
        <p>
          Alive will provide a mid-campaign and end-of-campaign performance report. Reports include
          estimated impressions, screen uptime, and store-level breakdowns.
        </p>
        <p className="font-semibold text-foreground">6. Cancellations</p>
        <p>
          Cancellations made more than 5 business days before campaign start are eligible for a
          full refund. Cancellations within 5 days of campaign start are non-refundable.
        </p>
        <p className="font-semibold text-foreground">7. Limitation of Liability</p>
        <p>
          Alive's total liability shall not exceed the fees paid for the relevant campaign. Alive
          is not liable for indirect or consequential losses.
        </p>
        <p className="font-semibold text-foreground">8. Governing Law</p>
        <p>
          This Agreement is governed by the laws of India. Disputes shall be resolved by
          arbitration in Mumbai.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id="agree"
            checked={data.agreementSigned}
            onCheckedChange={(checked) => onChange('agreementSigned', !!checked)}
          />
          <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
            I have read and agree to the Alive Advertiser Agreement. I confirm I am authorised
            to sign on behalf of <strong>{data.brandName || 'my brand'}</strong>.
          </Label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signatureName">Full name (acts as digital signature) *</Label>
          <Input
            id="signatureName"
            placeholder="Type your full name to sign"
            value={data.signatureName}
            onChange={(e) => onChange('signatureName', e.target.value)}
            className={data.signatureName.length > 2 ? 'font-signature text-lg' : ''}
            style={data.signatureName.length > 2 ? { fontStyle: 'italic' } : {}}
          />
          {data.signatureName.length > 2 && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Check className="h-3 w-3 text-green-500" />
              Signed as{' '}
              <span className="font-medium text-foreground">{data.signatureName}</span> on{' '}
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5">
          Proceed to payment <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepPayment({
  data,
  onChange,
  onNext,
  onBack,
}: {
  data: FormData;
  onChange: (k: keyof FormData, v: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const valid =
    data.cardNumber.replace(/\s/g, '').length === 16 &&
    data.cardExpiry.length === 5 &&
    data.cardCvc.length >= 3 &&
    data.billingName.trim().length > 2;

  const formatCardNumber = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const formatExpiry = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return digits;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Payment</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Secure payment — your campaign won't go live until this step is complete.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Order summary
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Brand</span>
            <span className="font-medium text-foreground">{data.brandName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Campaign duration</span>
            <span className="font-medium text-foreground">{data.duration}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Start date</span>
            <span className="font-medium text-foreground">
              {data.startDate
                ? new Date(data.startDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })
                : '—'}
            </span>
          </div>
          {data.targetAreas && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Target areas</span>
              <span className="font-medium text-foreground">{data.targetAreas}</span>
            </div>
          )}
        </div>
        <div className="border-t border-border pt-3 flex justify-between">
          <span className="font-semibold text-foreground">Total due</span>
          <span className="font-bold text-primary text-lg">Contact your AM for pricing</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="billingName">Name on card *</Label>
          <Input
            id="billingName"
            placeholder="As it appears on your card"
            value={data.billingName}
            onChange={(e) => onChange('billingName', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cardNumber">Card number *</Label>
          <div className="relative">
            <Input
              id="cardNumber"
              placeholder="1234 5678 9012 3456"
              value={data.cardNumber}
              onChange={(e) => onChange('cardNumber', formatCardNumber(e.target.value))}
              className="pr-10"
            />
            <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="cardExpiry">Expiry *</Label>
            <Input
              id="cardExpiry"
              placeholder="MM/YY"
              value={data.cardExpiry}
              onChange={(e) => onChange('cardExpiry', formatExpiry(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cardCvc">CVC *</Label>
            <Input
              id="cardCvc"
              placeholder="123"
              maxLength={4}
              value={data.cardCvc}
              onChange={(e) => onChange('cardCvc', e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-3.5 w-3.5 text-green-500" />
        Payments are encrypted and processed securely. Alive does not store card details.
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button onClick={onNext} disabled={!valid} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
          Pay & confirm campaign <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function StepDone({ data }: { data: FormData }) {
  return (
    <div className="flex flex-col items-center text-center gap-8 py-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 ring-8 ring-green-500/10">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
      </div>
      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-foreground">You're live! 🎉</h2>
        <p className="max-w-md mx-auto text-muted-foreground">
          Welcome to Alive, <strong className="text-foreground">{data.brandName}</strong>. Your
          campaign is confirmed and our team is on it. Expect a confirmation email at{' '}
          <strong className="text-foreground">{data.email}</strong> shortly.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 w-full max-w-lg text-left">
        {[
          { icon: Check, label: 'Creatives uploaded', done: true },
          { icon: Check, label: 'Campaign scheduled', done: true },
          { icon: Check, label: 'Agreement signed', done: true },
          { icon: Check, label: 'Payment confirmed', done: true },
          { icon: Calendar, label: 'Ad live by ' + (data.startDate ? new Date(data.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Day 3'), done: false },
          { icon: FileText, label: 'Report after campaign ends', done: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-3 text-sm">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.done ? 'bg-green-500/15 text-green-500' : 'bg-muted text-muted-foreground'}`}>
              <item.icon className="h-3.5 w-3.5" />
            </div>
            <span className={item.done ? 'text-foreground font-medium' : 'text-muted-foreground'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          Questions? Reach us at{' '}
          <a href="mailto:hello@alive.agency" className="text-primary hover:underline">
            hello@alive.agency
          </a>
        </p>
        <p className="text-xs">
          Your brand deserves to be seen. We'll make sure it is. 🌿
        </p>
      </div>

      <a href="/" className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4">
        Back to alive.agency
      </a>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function BrandOnboardingPage() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({
    brandName: '',
    contactName: '',
    email: '',
    phone: '',
    adCreative: null,
    logo: null,
    startDate: '',
    duration: '',
    targetAreas: '',
    specialInstructions: '',
    agreementSigned: false,
    signatureName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCvc: '',
    billingName: '',
  });

  const updateField = (key: keyof FormData, value: string | boolean | UploadedFile | null) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length));
  const back = () => setStep((s) => Math.max(s - 1, 1));

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2">
            <Logo />
          </a>
          {step > 1 && step < STEPS.length && (
            <div className="hidden sm:flex items-center gap-3">
              {STEPS.slice(1, -1).map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-1.5 text-xs font-medium ${
                    step === s.id
                      ? 'text-foreground'
                      : step > s.id
                        ? 'text-primary'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step > s.id ? (
                    <Check className="h-3 w-3 text-primary" />
                  ) : (
                    <span className="h-3 w-3 flex items-center justify-center rounded-full border border-current text-[9px]">
                      {s.id - 1}
                    </span>
                  )}
                  {s.label}
                </div>
              ))}
            </div>
          )}
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Confidential
          </Badge>
        </div>
        {step > 1 && step < STEPS.length && (
          <Progress value={progress} className="h-0.5 rounded-none" />
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {step === 1 && <StepWelcome onNext={next} />}
            {step === 2 && (
              <StepDetails
                data={form}
                onChange={(k, v) => updateField(k, v as string)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 3 && (
              <StepCreatives
                data={form}
                onChange={(k, v) => updateField(k, v)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 4 && (
              <StepCampaign
                data={form}
                onChange={(k, v) => updateField(k, v as string)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 5 && (
              <StepAgreement
                data={form}
                onChange={(k, v) => updateField(k, v)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 6 && (
              <StepPayment
                data={form}
                onChange={(k, v) => updateField(k, v as string)}
                onNext={next}
                onBack={back}
              />
            )}
            {step === 7 && <StepDone data={form} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-4 text-center text-xs text-muted-foreground">
        2025 · Alive Media Pvt. Ltd. ·{' '}
        <a href="mailto:hello@alive.agency" className="hover:text-foreground">
          hello@alive.agency
        </a>{' '}
        · alive.agency
      </footer>
    </div>
  );
}
