// Server actions disabled for static export deployment
// These features require a server-side runtime (Vercel, Netlify, etc.)

import type { PersonalizeKiranaStoreExplorerInput } from '@/ai/flows/kirana-store-explorer-personalization';

export async function personalizeExplorerAction(input: PersonalizeKiranaStoreExplorerInput) {
  // Static export: AI features are disabled
  return {
    success: false,
    error: 'AI features are not available in the static version. Please use the full app for personalization.'
  };
}

export async function generateTestimonialAction(audioDataUri: string) {
  // Static export: AI features are disabled
  return {
    success: false,
    error: 'AI features are not available in the static version. Please use the full app for testimonial generation.'
  };
}
