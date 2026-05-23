// Copied from /shared/constants.ts
// To update both web and mobile: edit /shared/constants.ts, then re-copy here.

export const API_BASE_URL = 'https://wearealive.in';

export const SUPPORT_WHATSAPP = '+919741324448';
export const SUPPORT_PHONE    = '+917411324448';

export const COMPANY = {
  name:    'VS Collective LLP (ALIVE)',
  address: '#13, First Floor, Highland Manor, Falnir, Mangalore 575002',
  gstin:   '29AAXFV2589C1ZE',
  llp:     'IN-KA43598411418020V',
} as const;

export const BRAND_COLORS = {
  primary:       '#ef4444',
  primaryDark:   '#b91c1c',
  primaryLight:  '#fef2f2',
  primaryBorder: '#fecaca',
  bg:            '#f9fafb',
  card:          '#ffffff',
  border:        '#e5e7eb',
  text:          '#111827',
  textSub:       '#6b7280',
  textMuted:     '#9ca3af',
  success:       '#22c55e',
  successLight:  '#f0fdf4',
  warn:          '#f59e0b',
  warnLight:     '#fffbeb',
  error:         '#ef4444',
  errorLight:    '#fef2f2',
} as const;
