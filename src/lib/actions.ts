'use server';

import crypto from 'crypto';

import { personalizeKiranaStoreExplorer } from '@/ai/flows/kirana-store-explorer-personalization';
import { generateTextTestimonialFromAudio } from '@/ai/flows/generate-text-testimonial-from-audio';
import type { PersonalizeKiranaStoreExplorerInput } from '@/ai/flows/kirana-store-explorer-personalization';
import { hashStack, recordError } from '@/lib/telemetry';

export async function personalizeExplorerAction(input: PersonalizeKiranaStoreExplorerInput) {
  try {
    const result = await personalizeKiranaStoreExplorer(input);
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    await recordError({
      route: 'lib/actions#personalizeExplorerAction',
      errorClass: err.name,
      message: err.message,
      stackHash: hashStack(err.stack),
      requestMeta: { action: 'personalizeExplorerAction' },
      actorType: 'user',
      correlationId: crypto.randomUUID(),
    });
    return { success: false, error: 'Failed to calculate reach. Please try another locality.' };
  }
}

export async function generateTestimonialAction(audioDataUri: string) {
  try {
    const result = await generateTextTestimonialFromAudio({ audioDataUri });
    return { success: true, data: result };
  } catch (error) {
    const err = error as Error;
    await recordError({
      route: 'lib/actions#generateTestimonialAction',
      errorClass: err.name,
      message: err.message,
      stackHash: hashStack(err.stack),
      requestMeta: { action: 'generateTestimonialAction' },
      actorType: 'user',
      correlationId: crypto.randomUUID(),
    });
    return { success: false, error: 'Failed to generate testimonial.' };
  }
}
