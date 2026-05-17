'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, ShoppingCart, Trash2, Plus, Minus,
  QrCode, MessageCircle, CheckCircle2, RefreshCw, Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Item = {
  id:    string;
  name:  string;
  qty:   number;
  unit:  string;
  price: number;
};

type PayMethod = 'cash' | 'upi' | 'card' | 'khata';

interface Props {
  storeId?:   string;
  storeName:  string;
  upiId?:     string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genBillRef() {
  return 'ALIVE-' + Date.now().toString(36).slice(-6).toUpperCase();
}

function fmtINR(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SAMPLE_TEXT =
  '2 Maggi noodles at 14 rupees each, 1 kg sugar 45 rupees, 500ml milk 28 rupees, Parle-G biscuit 10 rupees, 1 litre oil 130 rupees';

// ─── Speech ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceBillTab({ storeId, storeName, upiId }: Props) {
  const [billRef,       setBillRef]       = useState(() => genBillRef());
  const [billDate]                        = useState(() => new Date());
  const [items,         setItems]         = useState<Item[]>([]);
  const [payMethod,     setPayMethod]     = useState<PayMethod>('cash');
  const [isRecording,   setIsRecording]   = useState(false);
  const [transcript,    setTranscript]    = useState('');
  const [manualText,    setManualText]    = useState('');
  const [isParsing,     setIsParsing]     = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [parseError,    setParseError]    = useState<string | null>(null);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [waPhone,       setWaPhone]       = useState('');

  const recognitionRef = useRef<AnySpeechRecognition>(null);

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);

  const billUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/bill/${billRef}`
    : `/bill/${billRef}`;

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(billUrl)}`;

  // UPI payment QR — standard upi:// deep link that any UPI app can scan
  const upiUrl = upiId && total > 0
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(storeName)}&am=${total}&tn=${encodeURIComponent(billRef)}&cu=INR`
    : null;
  const upiQrUrl = upiUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUrl)}`
    : null;

  // ─── Voice recording ────────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported on this browser. Use Chrome or Edge.'); return; }

    const rec = new SR();
    rec.lang           = 'en-IN';
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(' ');
      setTranscript(t);
    };

    rec.onend = () => setIsRecording(false);
    rec.onerror = () => setIsRecording(false);

    rec.start();
    recognitionRef.current = rec;
    setIsRecording(true);
    setTranscript('');
  }, []);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  // ─── Parse text into items ───────────────────────────────────────────────────

  const parseText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setIsParsing(true);
    setParseError(null);
    try {
      const res  = await fetch('/api/voicebill/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json() as { items?: { name: string; qty: number; unit: string; price: number }[] };
      const parsed = data.items ?? [];
      if (parsed.length === 0) { setParseError('No items found. Try again or enter manually.'); return; }
      setItems((prev) => [
        ...prev,
        ...parsed.map((i) => ({ id: crypto.randomUUID(), ...i })),
      ]);
    } catch {
      setParseError('Could not parse. Check your connection.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleParseVoice  = () => parseText(transcript);
  const handleParseManual = () => parseText(manualText);
  const handleLoadSample  = () => parseText(SAMPLE_TEXT);

  // ─── Item editing ────────────────────────────────────────────────────────────

  const removeItem  = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const changeQty   = (id: string, delta: number) =>
    setItems((p) => p.map((i) => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i));

  // ─── Save bill ───────────────────────────────────────────────────────────────

  const completeSale = async () => {
    if (!items.length || saved) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billRef, storeName, storeId, items, totalAmount: total, payMethod }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Save failed');
      }
      setSaved(true);
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const startNewBill = () => {
    setBillRef(genBillRef());
    setItems([]);
    setTranscript('');
    setManualText('');
    setSaved(false);
    setSaveError(null);
    setParseError(null);
    setPayMethod('cash');
  };

  // ─── WhatsApp summary ─────────────────────────────────────────────────────

  const waText = [
    `*${storeName}* — Bill ${billRef}`,
    `Date: ${fmtDate(billDate)} ${fmtTime(billDate)}`,
    '',
    ...items.map((i) => `• ${i.name} ×${i.qty} ${i.unit} @ ${fmtINR(i.price)} = ${fmtINR(i.qty * i.price)}`),
    '',
    `*Total: ${fmtINR(total)}*`,
    `Payment: ${payMethod.toUpperCase()}`,
    '',
    `View receipt: ${billUrl}`,
  ].join('\n');

  const waHref = `https://wa.me/${waPhone.replace(/\D/g, '') ? '91' + waPhone.replace(/\D/g, '').slice(-10) : ''}?text=${encodeURIComponent(waText)}`;

  // ─── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => () => { recognitionRef.current?.stop(); }, []);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* Saved banner */}
      {saved && (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/8 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-green-700">Bill saved — {billRef}</p>
              <p className="text-xs text-green-600/70">Customer can scan the QR code to view their receipt.</p>
            </div>
          </div>
          <button
            onClick={startNewBill}
            className="flex items-center gap-1.5 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-bold text-green-700 hover:bg-green-500/20 transition-colors shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" /> New Bill
          </button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">

        {/* ── Left column ─────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Voice input */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" /> Voice / Text input
            </h2>

            {/* Mic button */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={saved}
                className={`flex h-20 w-20 items-center justify-center rounded-full transition-all shadow-lg ${
                  isRecording
                    ? 'border-2 border-destructive bg-destructive/10 text-destructive animate-pulse'
                    : 'border-2 border-primary/30 bg-primary/8 text-primary hover:bg-primary/15'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >
                {isRecording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </button>
              <p className="text-xs text-muted-foreground">
                {isRecording ? 'Recording… tap to stop' : 'Tap to start speaking'}
              </p>
            </div>

            {/* Transcript display */}
            {transcript && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-foreground/80 leading-relaxed min-h-[60px]">
                {transcript}
              </div>
            )}

            {transcript && (
              <button
                onClick={handleParseVoice}
                disabled={isParsing || saved}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {isParsing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                Add to bill
              </button>
            )}

            <div className="border-t border-border pt-4 space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">Or type items</label>
              <textarea
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                disabled={saved}
                placeholder="e.g. 2 Maggi at 14, 1kg sugar 45 rupees, Parle-G biscuit"
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all disabled:opacity-40"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleParseManual}
                  disabled={!manualText.trim() || isParsing || saved}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Parse'}
                </button>
                <button
                  onClick={handleLoadSample}
                  disabled={isParsing || saved}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all disabled:opacity-40"
                >
                  Load sample
                </button>
                {items.length > 0 && (
                  <button
                    onClick={() => { setItems([]); setTranscript(''); setManualText(''); }}
                    disabled={saved}
                    className="rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all disabled:opacity-40"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {parseError && (
              <p className="text-xs text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">{parseError}</p>
            )}
          </div>

          {/* Bill items table */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/20">
              <div>
                <p className="text-xs font-black text-foreground font-mono tracking-wider">{billRef}</p>
                <p className="text-[10px] text-muted-foreground">{fmtDate(billDate)} · {fmtTime(billDate)}</p>
              </div>
              <ShoppingCart className="h-4 w-4 text-muted-foreground/40" />
            </div>

            {items.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground/50">
                No items yet — use voice or text above
              </div>
            ) : (
              <>
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">{item.unit} · {fmtINR(item.price)}/unit</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => changeQty(item.id, -1)} disabled={saved} className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-all disabled:opacity-30">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-xs font-bold text-foreground w-5 text-center">{item.qty}</span>
                        <button onClick={() => changeQty(item.id, +1)} disabled={saved} className="flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground hover:border-primary/30 hover:text-primary transition-all disabled:opacity-30">
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-foreground w-16 text-right shrink-0">{fmtINR(item.qty * item.price)}</p>
                      {!saved && (
                        <button onClick={() => removeItem(item.id)} className="ml-1 text-muted-foreground/40 hover:text-destructive transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-border px-4 py-3 space-y-1 bg-muted/20">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Subtotal ({items.length} item{items.length !== 1 ? 's' : ''})</span>
                    <span>{fmtINR(total)}</span>
                  </div>
                  <div className="flex items-center justify-between text-base font-black text-foreground">
                    <span>TOTAL</span>
                    <span>{fmtINR(total)}</span>
                  </div>
                </div>
              </>
            )}

            {/* ALIVE badge footer */}
            <div className="border-t border-border px-4 py-2 flex items-center justify-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Powered by</span>
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-primary/60">ALIVE</span>
            </div>
          </div>
        </div>

        {/* ── Right column ────────────────────────────────────────────────── */}
        <div className="space-y-4">

          {/* QR code */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" /> Customer receipt QR
            </h2>
            <div className="flex flex-col items-center gap-3">
              <div className={`rounded-xl p-3 border ${saved ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 opacity-60'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="Receipt QR" width={160} height={160} className="rounded-lg" />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                {saved
                  ? 'Customer can scan to view receipt & save to ALIVE account'
                  : 'Active after "Complete Sale"'}
              </p>
              {saved && (
                <a href={billUrl} target="_blank" rel="noreferrer"
                  className="text-[11px] font-semibold text-primary hover:underline underline-offset-2">
                  View receipt page →
                </a>
              )}
            </div>
          </div>

          {/* WhatsApp */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-[#25D366]" /> Send via WhatsApp
            </h2>
            <div className="flex items-stretch rounded-xl border border-border overflow-hidden focus-within:border-primary transition-all bg-background">
              <span className="flex items-center px-3 text-sm font-semibold text-muted-foreground border-r border-border bg-muted shrink-0">+91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={waPhone}
                onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Customer phone"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              />
            </div>
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                waPhone.length === 10
                  ? 'bg-[#25D366] text-white hover:opacity-90'
                  : 'border border-border text-muted-foreground cursor-not-allowed pointer-events-none opacity-40'
              }`}
            >
              <MessageCircle className="h-4 w-4" /> Send bill on WhatsApp
            </a>
          </div>

          {/* Payment method */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-foreground">Payment method</h2>
            <div className="grid grid-cols-2 gap-2">
              {(['cash', 'upi', 'card', 'khata'] as PayMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => !saved && setPayMethod(m)}
                  disabled={saved}
                  className={`rounded-xl border py-2.5 text-sm font-bold capitalize transition-all ${
                    payMethod === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  } disabled:cursor-not-allowed`}
                >
                  {m === 'upi' ? 'UPI' : m.charAt(0).toUpperCase() + m.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* UPI payment QR — shown when UPI is selected and total > 0 */}
          {payMethod === 'upi' && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-primary" /> UPI Payment QR
              </h2>
              {upiQrUrl && total > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={upiQrUrl} alt="UPI QR" width={200} height={200} className="rounded-xl border border-border" />
                  <div className="text-center space-y-0.5">
                    <p className="text-base font-black text-foreground">{fmtINR(total)}</p>
                    <p className="text-[10px] text-muted-foreground">Scan with any UPI app</p>
                    <p className="text-[10px] font-mono text-muted-foreground/60">{upiId}</p>
                  </div>
                </div>
              ) : !upiId ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Add your UPI ID in <span className="font-semibold">Payout settings</span> to enable UPI QR
                </p>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">
                  Add items to generate UPI QR
                </p>
              )}
            </div>
          )}

          {/* Complete sale */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            {saveError && (
              <p className="text-xs text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">{saveError}</p>
            )}
            <button
              onClick={completeSale}
              disabled={!items.length || saved || isSaving}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-red-500 to-red-700 py-4 text-base font-black text-white shadow-[0_4px_20px_-4px_rgba(220,38,38,0.4)] transition-all hover:from-red-600 hover:to-red-800 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isSaving ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Saving…</>
              ) : saved ? (
                <><CheckCircle2 className="h-5 w-5" /> Bill saved ✓</>
              ) : (
                <><CheckCircle2 className="h-5 w-5" /> Complete Sale · {fmtINR(total)}</>
              )}
            </button>
            {!saved && (
              <p className="text-[10px] text-muted-foreground/50 text-center">
                Saves bill to database · QR becomes active · Customer can claim receipt
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
