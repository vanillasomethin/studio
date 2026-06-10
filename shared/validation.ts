// ─── Single source-of-truth: edit here → both web and mobile update ──────────

export const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export type FormData = {
  storeName:  string;
  ownerName:  string;
  whatsapp:   string;
  password:   string;
  address:    string;
  locality:   string;
  city:       string;
  pincode:    string;
  lat:        string;
  lng:        string;
  referredBy: string;
  gstin:      string;
};

export const FORM_INIT: FormData = {
  storeName: '', ownerName: '', whatsapp: '', password: '',
  address: '',  locality: '',  city: '',     pincode: '',
  lat: '',      lng: '',       referredBy: '', gstin: '',
};

export type FieldErrors = Partial<Record<keyof FormData, string>>;

export function validateForm(form: FormData): FieldErrors {
  const e: FieldErrors = {};
  if (!form.storeName.trim()) e.storeName = 'Store name is required';
  if (!form.ownerName.trim()) e.ownerName = 'Owner name is required';
  if (form.whatsapp.length !== 10) e.whatsapp = 'Enter a valid 10-digit number';
  if (form.password.length < 6)    e.password = 'Minimum 6 characters required';
  if (!form.address.trim())        e.address  = 'Shop address is required';
  if (!form.city.trim())           e.city     = 'City is required';
  if (form.pincode.length !== 6)   e.pincode  = 'Enter a valid 6-digit pincode';
  if (form.gstin && !GSTIN_RE.test(form.gstin.toUpperCase())) {
    e.gstin = 'Invalid GSTIN — must be 15 characters (e.g. 29AAXFV2589C1ZE)';
  }
  return e;
}

export function makeReferralCode(storeName: string, ownerName: string): string {
  const s = storeName.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const o = ownerName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase();
  const r = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `${s}${o}${r}`;
}

export function passwordScore(password: string): number {
  return [
    password.length >= 6,
    /\d/.test(password),
    /[A-Z]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
}
