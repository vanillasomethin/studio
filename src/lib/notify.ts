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
 * Send one transactional email to an arbitrary address, REPORTING whether it
 * actually went out.
 *
 * Deliberately different from notifyAdminEmail above, which is fire-and-forget
 * because a dropped alert is survivable. An invite is not: if the mail silently
 * fails, the admin believes a colleague was invited and that colleague never
 * hears anything, so the account sits password-less and nobody knows why.
 * Returns false when RESEND_API_KEY is unset or Resend rejects, so the caller
 * can surface it instead of pretending success.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  // Two transports, tried in order, because the one that is configured varies by
  // environment: Resend is the production sender, but a Google Workspace SMTP
  // account is what ALIVE actually has to hand. Either is sufficient; neither is
  // required for the app to run.
  const from = process.env.EMAIL_FROM ?? 'ALIVE <hello@wearealive.in>';

  const key = process.env.RESEND_API_KEY;
  if (key) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, html }),
      });
      if (res.ok) return true;
      // Fall through to SMTP rather than returning — a Resend outage or a
      // rejected domain should not strand an invite when SMTP is also set up.
    } catch { /* fall through to SMTP */ }
  }

  // SMTP (Gmail / Google Workspace). Uses the same EMAIL_SERVER_* variables the
  // Auth.js Email provider already reads, so there is one place to configure mail.
  //
  // Gmail requires an APP PASSWORD, not the account password, and only when 2-Step
  // Verification is on — a normal password fails with 535. Port 465 is implicit
  // TLS (`secure: true`); 587 is STARTTLS (`secure: false`).
  const host = process.env.EMAIL_SERVER_HOST;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  if (!host || !user || !pass) return false;

  try {
    // Dynamic import: nodemailer is a Node-only dependency and a static import
    // would pull it into every bundle that happens to touch this module.
    const nodemailer = (await import('nodemailer')).default;
    const port = Number(process.env.EMAIL_SERVER_PORT ?? 465);
    const transport = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
    });
    await transport.sendMail({ from, to, subject, html });
    return true;
  } catch {
    return false;
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
