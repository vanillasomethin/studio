// Re-exports from the shared source-of-truth.
// Edit /shared/validation.ts to update both web and mobile.
export {
  GSTIN_RE,
  FORM_INIT,
  validateForm,
  makeReferralCode,
  passwordScore,
  type FormData,
  type FieldErrors,
} from '@shared/validation';
