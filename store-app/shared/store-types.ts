// Copied from /shared/store-types.ts
// To update both web and mobile: edit /shared/store-types.ts, then re-copy here.

export type StoreSession = {
  id?:              string;
  // Signed store API token (x-store-token header) — proves the caller may act
  // on this storeId; minted at login/registration and refreshed by /api/stores/me
  token?:           string;
  storeName:        string;
  ownerName:        string;
  whatsapp:         string;
  phone?:           string;
  locality?:        string;
  city?:            string;
  pincode?:         string;
  address?:         string;
  lat?:             number;
  lng?:             number;
  gstin?:           string;
  email?:           string;
  referralCode?:    string;
  referredBy?:      string;
  agreedAt?:        string;
  liveAt?:          string;
  onboardingStage?: string;
  deviceCount?:     number;
  // Payout figures resolved by /api/stores/me. The mobile app hardcoded ₹500 for
  // all three until it carried these, which paid a Standard partner's numbers to
  // every tier. Absent on a stale cached payload — callers must degrade to naming
  // the payout structure, never to a guessed figure.
  tier?:                     string;
  // Current dynamic total: base + bonus for a slot store, the flat figure otherwise.
  // Moves with slot fill, so it is NOT a contract figure — see agreementMonthlyRupees.
  monthlyCompensationPaise?: number;
  // Clause 3.3's guaranteed base for THIS partner. Fixed; safe to quote as contract.
  agreementTier?:            string | null;
  agreementMonthlyRupees?:   number | null;
  // GPS-verified onboarding photos (shop front gates Team verification,
  // installed TV gates Site visit & install — see /api/stores/verification-photo)
  shopPhotoUrl?:     string | null;
  shopPhotoLat?:     number | null;
  shopPhotoLng?:     number | null;
  shopPhotoAt?:      string | null;
  installPhotoUrl?:  string | null;
  installPhotoLat?:  number | null;
  installPhotoLng?:  number | null;
  installPhotoAt?:   string | null;
  tvTag?:            string | null; // TV number / ID pin, recorded with the installed-TV photo
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
