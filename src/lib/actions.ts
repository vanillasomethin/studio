'use server';

import { personalizeKiranaStoreExplorer } from '@/ai/flows/kirana-store-explorer-personalization';
import { generateTextTestimonialFromAudio } from '@/ai/flows/generate-text-testimonial-from-audio';
import { generateFewWordAdCopy } from '@/ai/flows/generate-few-word-ad-copy';
import type { PersonalizeKiranaStoreExplorerInput } from '@/ai/flows/kirana-store-explorer-personalization';
import type { GenerateFewWordAdCopyInput } from '@/ai/flows/generate-few-word-ad-copy';

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

export async function generateFewWordAdCopyAction(input: GenerateFewWordAdCopyInput) {
  try {
    const result = await generateFewWordAdCopy(input);
    return { success: true, data: result };
  } catch (error) {
    console.error(error);
    return { success: false, error: 'Failed to generate ad copy.' };
  }
}
