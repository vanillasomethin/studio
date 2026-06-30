// MSG91 WhatsApp OTP delivery.
//
// MSG91's WhatsApp Outbound API only *delivers* a template message — it does
// not generate or verify the code. So the OTP itself is generated and verified
// app-side (Redis, in the reset-password route); MSG91 is just the WhatsApp
// transport. Env-gated like the other optional integrations: if it isn't
// configured the caller falls back to its existing WhatsApp delivery.
//
// Env:
//   MSG91_AUTH_KEY            — account auth key
//   MSG91_WHATSAPP_NUMBER     — integrated (sender) WhatsApp business number
//   MSG91_WHATSAPP_OTP_TEMPLATE — approved WhatsApp authentication template name
//   MSG91_WHATSAPP_NAMESPACE  — template namespace (optional, if your WABA needs it)
//   MSG91_WHATSAPP_LANG       — template language code (default "en_US")

const WA_BULK_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

function waCfg(): { authkey: string; integratedNumber: string; template: string; namespace: string | null; lang: string } | null {
  const authkey          = process.env.MSG91_AUTH_KEY;
  const integratedNumber = process.env.MSG91_WHATSAPP_NUMBER;
  const template         = process.env.MSG91_WHATSAPP_OTP_TEMPLATE;
  if (!authkey || !integratedNumber || !template) return null;
  return {
    authkey,
    integratedNumber,
    template,
    namespace: process.env.MSG91_WHATSAPP_NAMESPACE || null,
    lang:      process.env.MSG91_WHATSAPP_LANG || 'en_US',
  };
}

export function isWhatsappOtpConfigured(): boolean {
  return waCfg() !== null;
}

// MSG91 expects the mobile with country code and no '+', e.g. 919876543210.
// Stored phones are "+91XXXXXXXXXX", so stripping non-digits yields that.
function toMobile(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Delivers an OTP over WhatsApp via MSG91's bulk template API. The template is
 * a WhatsApp "authentication" template: `body_1` carries the code in the body,
 * `button_1` fills the one-tap copy-code button with the same code.
 * Returns true if MSG91 accepted the request.
 */
export async function sendWhatsappOtp(phone: string, otp: string): Promise<boolean> {
  const c = waCfg();
  if (!c) return false;
  const mobile = toMobile(phone);

  const payloadTemplate: Record<string, unknown> = {
    name: c.template,
    language: { code: c.lang, policy: 'deterministic' },
    to_and_components: [
      {
        to: [mobile],
        components: {
          body_1:   { type: 'text', value: otp },
          button_1: { subtype: 'url', type: 'text', value: otp },
        },
      },
    ],
  };
  if (c.namespace) payloadTemplate.namespace = c.namespace;

  const body = {
    integrated_number: c.integratedNumber,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: payloadTemplate,
    },
  };

  try {
    const res = await fetch(WA_BULK_URL, {
      method:  'POST',
      headers: { authkey: c.authkey, 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({})) as { type?: string };
    // MSG91 returns { type: 'success', ... } when the request is accepted.
    return data?.type ? data.type === 'success' : true;
  } catch {
    return false;
  }
}
