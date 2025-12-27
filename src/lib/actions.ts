'use server';

import { personalizeKiranaStoreExplorer } from '@/ai/flows/kirana-store-explorer-personalization';
import { generateTextTestimonialFromAudio } from '@/ai/flows/generate-text-testimonial-from-audio';
import type { PersonalizeKiranaStoreExplorerInput } from '@/ai/flows/kirana-store-explorer-personalization';

export async function personalizeExplorerAction(input: PersonalizeKiranaStoreExplorerInput) {
  try {
    const result = await personalizeKiranaStoreExplorer(input);
    return { success: true, data: result };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to calculate reach. Please try another locality.' };
  }
}

export async function generateTestimonialAction(audioDataUri: string) {
  try {
    const result = await generateTextTestimonialFromAudio({ audioDataUri });
    return { success: true, data: result };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to generate testimonial.' };
  }
}
