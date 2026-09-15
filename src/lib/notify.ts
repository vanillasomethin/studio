// Notification helper — WhatsApp via Twilio (graceful no-op if env vars missing)
// Also supports simple email via Resend if RESEND_API_KEY is set.

const ADMIN_WA = process.env.ADMIN_WHATSAPP ?? '+919606072227'; // VS Collective LLP

async function sendTwilioWhatsApp(to: string, body: string): Promise<void> {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
  if (!sid || !token) return;

  const toWa = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const url   = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const creds = Buffer.from(`${sid}:${token}`).toString('base64');

  await fetch(url, {
    method:  'POST',
    headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ To: toWa, From: from, Body: body }).toString(),
  });
}

async function sendResendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'ALIVE <hello@wearealive.in>', to: [to], subject, html }),
  });
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export async function notifyAdminWA(message: string): Promise<void> {
  try { await sendTwilioWhatsApp(ADMIN_WA, message); } catch { /* non-fatal */ }
}

export async function notifyAdminEmail(subject: string, html: string): Promise<void> {
  try { await sendResendEmail('hello@wearealive.in', subject, html); } catch { /* non-fatal */ }
}

/**
 * Why one send failed, in words an admin can act on.
 *
 * A bare boolean was not enough. Every mail failure looked identical from the
 * console — "email could not be sent (RESEND_API_KEY missing)" — whatever had
 * actually happened, so the person reading it went looking for a missing API key
 * when the real answer was an unverified Resend domain, or a Zoho mailbox that
 * wants an app-specific password. The reason travels back to the caller, which
 * puts it in the audit row and on screen.
 */
export type MailResult =
  | { ok: true;  via: 'resend' | 'smtp' }
  | { ok: false; reason: string };

/** Trim an unknown throw down to one printable line. */
function errText(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/\s+/g, ' ').trim().slice(0, 300) || 'no error message';
}

/**
 * Never let a credential ride out in a failure reason.
 *
 * The reason string is displayed in the console AND written to an AuditLog row,
 * so it outlives the request. SMTP servers quote parts of the conversation back
 * in their rejections, and this is the one place where doing that would persist
 * a password.
 */
function redact(text: string): string {
  let out = text;
  for (const secret of [process.env.ZOHO_SMTP_PASSWORD, process.env.EMAIL_SERVER_PASSWORD, process.env.RESEND_API_KEY]) {
    if (secret && secret.length > 3) out = out.split(secret).join('***');
  }
  return out;
}

/** Resend states the actual problem in the body; a status code alone doesn't. */
async function resendError(res: Response): Promise<string> {
  const body = await res.text().catch(() => '');
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message ?? parsed.error ?? body.slice(0, 300);
  } catch {
    return body.slice(0, 300) || res.statusText;
  }
}

type SmtpConfig = { host: string; port: number; user: string; pass: string; from: string };

/**
 * The SMTP account to send through, if one is configured.
 *
 * ZOHO_SMTP_* is checked first because it is what CLAUDE.md and .env.example
 * tell you to set for admin mail — and until this function existed, sendEmail
 * read ONLY the older EMAIL_SERVER_* names. An environment configured exactly as
 * documented therefore had no transport at all: every invite came back "could
 * not be sent" with a working Zoho account sitting right there in the env.
 *
 * Both pairs are all-or-nothing: a host with no password is not a half-working
 * transport, it is a misconfiguration, and treating it as absent lets the other
 * pair (or Resend) still carry the mail.
 */
function smtpConfig(): SmtpConfig | null {
  const zohoUser = process.env.ZOHO_SMTP_USER;
  const zohoPass = process.env.ZOHO_SMTP_PASSWORD;
  if (zohoUser && zohoPass) {
    return {
      // smtp.zoho.in for India-DC accounts, smtp.zoho.com for .com ones — the
      // wrong DC authenticates against nothing and fails with 535.
      host: process.env.ZOHO_SMTP_HOST ?? 'smtp.zoho.in',
      port: Number(process.env.ZOHO_SMTP_PORT ?? 465),
      user: zohoUser,
      pass: zohoPass,
      // Zoho refuses to relay a From address the authenticated mailbox doesn't
      // own (553), so the mailbox itself is the only safe default.
      from: `ALIVE <${zohoUser}>`,
    };
  }

  // Gmail / Google Workspace, and whatever the Auth.js Email provider is already
  // pointed at. Gmail needs an APP PASSWORD with 2-Step Verification on — the
  // account password fails with 535. Port 465 is implicit TLS, 587 is STARTTLS.
  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  if (host && user && pass) {
    return { host, port: Number(process.env.EMAIL_SERVER_PORT ?? 465), user, pass, from: `ALIVE <${user}>` };
  }

  return null;
}

/**
 * Send one transactional email to an arbitrary address, REPORTING whether it
 * actually went out and why not.
 *
 * Deliberately different from notifyAdminEmail above, which is fire-and-forget
 * because a dropped alert is survivable. An invite is not: if the mail silently
 * fails, the admin believes a colleague was invited and that colleague never
 * hears anything, so the account sits password-less and nobody knows why.
 *
 * Two transports, tried in order, because which one is configured varies by
 * environment. Resend goes first when its key is set, but a rejection there
 * falls through to SMTP rather than returning — an unverified sending domain
 * must not strand an invite when a Zoho mailbox is also configured. Either is
 * sufficient; neither is required for the app to run.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<MailResult> {
  const smtp = smtpConfig();
  // ADMIN_MAIL_FROM is the documented name for this and wins; EMAIL_FROM is the
  // older one. With neither set, the transport's own mailbox is a better guess
  // than a hardcoded address it may not be allowed to send as.
  const configuredFrom = process.env.ADMIN_MAIL_FROM ?? process.env.EMAIL_FROM;
  const reasons: string[] = [];

  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: configuredFrom ?? 'ALIVE <hello@wearealive.in>', to: [to], subject, html }),
      });
      if (res.ok) return { ok: true, via: 'resend' };
      // Read the body. Resend names the problem, and it is usually one a status
      // code cannot express: on an account whose domain is not verified it will
      // only deliver to the address that signed up, so mail to a colleague at
      // the same domain is refused while mail to the owner goes through.
      reasons.push(`Resend rejected it (HTTP ${res.status}): ${await resendError(res)}`);
    } catch (err) {
      reasons.push(`Resend was unreachable: ${errText(err)}`);
    }
  }

  if (!smtp) {
    reasons.push(
      key
        ? 'No SMTP fallback is configured (set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD).'
        : 'No mail transport is configured — set ZOHO_SMTP_USER and ZOHO_SMTP_PASSWORD, or RESEND_API_KEY.',
    );
    return { ok: false, reason: redact(reasons.join(' ')) };
  }

  try {
    // Dynamic import: nodemailer is a Node-only dependency and a static import
    // would pull it into every bundle that happens to touch this module.
    const nodemailer = (await import('nodemailer')).default;
    const transport = nodemailer.createTransport({
      host: smtp.host, port: smtp.port, secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });
    await transport.sendMail({ from: configuredFrom ?? smtp.from, to, subject, html });
    return { ok: true, via: 'smtp' };
  } catch (err) {
    reasons.push(`SMTP ${smtp.host}:${smtp.port} rejected it: ${errText(err)}`);
    return { ok: false, reason: redact(reasons.join(' ')) };
  }
}

export async function notifyStoreWA(phone: string, message: string): Promise<void> {
  // phone: 10-digit or +91XXXXXXXXXX
  const e164 = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '').slice(-10)}`;
  try { await sendTwilioWhatsApp(e164, message); } catch { /* non-fatal */ }
}

// ─── Canned messages ─────────────────────────────────────────────────────────

export function storeRegistrationMsg(store: {
  storeName: string; ownerName: string; phone: string;
  city?: string | null; address?: string | null; gstin?: string | null;
}) {
  return [
    `🏪 *New Store Registration*`,
    `Store: ${store.storeName}`,
    `Owner: ${store.ownerName}`,
    `Phone: ${store.phone}`,
    store.city    ? `City: ${store.city}` : null,
    store.address ? `Address: ${store.address}` : null,
    store.gstin   ? `GSTIN: ${store.gstin}` : null,
    ``,
    `Go to admin: https://wearealive.in/admin`,
  ].filter(Boolean).join('\n');
}

export function brandEnquiryMsg(e: {
  reference: string;
  brandName: string;
  contactPerson: string;
  phone: string;
  whatsapp?: string | null;
  category?: string | null;
  budgetBand?: string | null;
  storeNames: string[];
  slotsPerStore: number;
  months: number;
  estMonthlyRupees: number;
  estTotalRupees: number;
  creativeStatus?: string | null;
  notes?: string | null;
}) {
  const inr = (n: number) => `\u20b9${n.toLocaleString('en-IN')}`;
  const stores = e.storeNames.length
    ? e.storeNames.join(', ')
    : 'none picked \u2014 suggest stores for their category';
  return [
    `\ud83d\udce3 *New Advertiser Enquiry*`,
    `Ref: ${e.reference}`,
    ``,
    `Brand: ${e.brandName}`,
    `Contact: ${e.contactPerson}`,
    `Phone: ${e.phone}`,
    e.whatsapp && e.whatsapp !== e.phone ? `WhatsApp: ${e.whatsapp}` : null,
    e.category   ? `Category: ${e.category}` : null,
    e.budgetBand ? `Budget: ${e.budgetBand}` : null,
    ``,
    `Wants: ${e.slotsPerStore} slot(s) \u00d7 ${e.months} month(s)`,
    `Stores: ${stores}`,
    `Estimate: ${inr(e.estMonthlyRupees)}/mo \u00b7 ${inr(e.estTotalRupees)} total (ex GST)`,
    e.creativeStatus ? `Creative: ${e.creativeStatus}` : null,
    e.notes ? `Notes: ${e.notes}` : null,
    ``,
    `They accepted the advertising terms. Call them back with availability and a written quote.`,
    // Only null is dropped: the empty strings above are deliberate blank
    // lines, and filter(Boolean) would silently eat them.
  ].filter(line => line !== null).join('\n');
}

export function payoutClaimMsg(store: {
  storeName: string; ownerName: string; phone: string; month: string;
}) {
  return [
    `💰 *Payout Claim Received*`,
    `Store: ${store.storeName}`,
    `Owner: ${store.ownerName}`,
    `Phone: ${store.phone}`,
    `Month: ${store.month}`,
    `Amount: ₹500 + electricity`,
  ].join('\n');
}

function sinceText(d: Date | null): string {
  if (!d) return 'unknown';
  const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hour${hrs > 1 ? 's' : ''} ago` : `${Math.round(hrs / 24)} day(s) ago`;
}

export function deviceOfflineAdminMsg(d: {
  deviceName: string; storeName: string | null; lastSeen: Date | null;
}) {
  return [
    `🔴 *Screen Offline*`,
    `Store: ${d.storeName ?? 'Unassigned'}`,
    `Screen: ${d.deviceName}`,
    `Last seen: ${sinceText(d.lastSeen)}`,
    ``,
    `https://wearealive.in/admin`,
  ].join('\n');
}

/** "7h" / "3 days" — how long a screen has been down, for the digest lines. */
function downFor(since: Date): string {
  const mins = Math.max(1, Math.round((Date.now() - since.getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.round(hrs / 24)} days`;
}

/**
 * The recurring "these are STILL down" reminder.
 *
 * deviceOfflineAdminMsg above is sent once, at the offline edge, and never
 * repeats — so a single missed or undelivered message is enough for a screen to
 * stay dark indefinitely with nobody told again. This is the nag that follows.
 *
 * Deliberately blunt and ordered worst-first: the point of a repeat message is
 * that the previous one did not produce a fix, so it has to lead with how long
 * this has been going on rather than restate the same neutral notice.
 */
export function screensStillOfflineMsg(screens: {
  deviceName: string; storeName: string | null; since: Date;
}[]) {
  const one  = screens.length === 1;
  const head = one
    ? `1 screen is STILL offline`
    : `${screens.length} screens are STILL offline`;
  const tail = one
    ? `It has not come back on its own. Ads are not playing on it.`
    : `These have not come back on their own. Ads are not playing on them.`;
  const lines = screens.slice(0, 10).map(
    (s) => `• ${s.storeName ?? 'Unassigned'} — ${s.deviceName} — down ${downFor(s.since)}`,
  );
  const more = screens.length > 10 ? [`…and ${screens.length - 10} more`] : [];

  return [
    `🔴 *${head}*`,
    ``,
    ...lines,
    ...more,
    ``,
    tail,
    ``,
    `https://wearealive.in/admin`,
  ].join('\n');
}

// Partner-facing: no admin link, no jargon, and it always ends in the ONE
// action a shopkeeper can actually take.
export function deviceOfflinePartnerMsg(d: { storeName: string; since: Date | null }) {
  return [
    `📺 *Your ALIVE screen has stopped*`,
    `${d.storeName}`,
    `Last playing: ${sinceText(d.since)}`,
    ``,
    `Please check that the screen is switched on and your Wi-Fi is working.`,
    `Ads don't run while it's off — it goes back to normal on its own once it reconnects.`,
    ``,
    // "or just reply" matters: the dashboard link only works where a partner
    // session exists (their usual browser). App-only partners land on a login
    // form — for them, a plain WhatsApp reply reaches us just as well.
    `Do you know why it stopped? Power cut, Wi-Fi down, TV switched off?`,
    `Tell us on your dashboard — or just reply to this message:`,
    `https://wearealive.in/store-dashboard`,
    ``,
    `Need help? WhatsApp us on +91 74113 24448.`,
  ].join('\n');
}

export function deviceBackOnlineMsg(storeName: string) {
  return [
    `✅ *Your ALIVE screen is back online*`,
    `${storeName}`,
    ``,
    `Ads are playing again — nothing further needed. Thank you!`,
  ].join('\n');
}

export function billClaimedMsg(storeName: string, customerName: string, customerPhone: string, billRef: string) {
  return [
    `🧾 *Bill Claimed*`,
    `Bill: ${billRef}`,
    `Store: ${storeName}`,
    `Customer: ${customerName} (${customerPhone})`,
    `View: https://wearealive.in/bill/${billRef}`,
  ].join('\n');
}
