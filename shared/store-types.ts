// ─── Shared TypeScript types used by web (Next.js) and mobile (Expo) ─────────

export type StoreSession = {
  id?:              string;
  storeName:        string;
  ownerName:        string;
  whatsapp:         string;
  phone?:           string;
  locality?:        string;
  city?:            string;
  pincode?:         string;
  address?:         string;
  gstin?:           string;
  email?:           string;
  referralCode?:    string;
  referredBy?:      string;
  agreedAt?:        string;
  liveAt?:          string;
  onboardingStage?: string;
  deviceCount?:     number;
  payoutMethod?:    string;
  upiId?:           string;
  bankAccountName?: string;
  bankAccountNo?:   string;
  bankIfsc?:        string;
  bankName?:        string;
};

export type RegisterPayload = {
  storeName:    string;
  ownerName:    string;
  whatsapp:     string;
  password:     string;
  address:      string;
  locality:     string;
  city:         string;
  pincode:      string;
  lat:          string;
  lng:          string;
  referredBy?:  string;
  gstin?:       string;
  referralCode: string;
  agreedAt:     string;
};
