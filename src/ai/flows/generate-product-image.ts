'use server';
/**
 * @fileOverview Generates a clean studio product image for a catalogue product
 * using Gemini's image model. Used to autofill flyer product images when no real
 * photograph exists yet — a real photo can replace it later.
 *
 * - generateProductImage — returns a PNG data URI for the given product details.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'genkit';

const GenerateProductImageInputSchema = z.object({
  productName: z.string(),
  brand: z.string(),
  sizeVariant: z.string().optional(),
  category: z.string().optional(),
});
export type GenerateProductImageInput = z.infer<typeof GenerateProductImageInputSchema>;

const GenerateProductImageOutputSchema = z.object({
  dataUri: z.string().describe('Generated product image as a data URI (image/png, base64).'),
});
export type GenerateProductImageOutput = z.infer<typeof GenerateProductImageOutputSchema>;

export async function generateProductImage(
  input: GenerateProductImageInput,
): Promise<GenerateProductImageOutput> {
  return generateProductImageFlow(input);
}

const generateProductImageFlow = ai.defineFlow(
  {
    name: 'generateProductImageFlow',
    inputSchema: GenerateProductImageInputSchema,
    outputSchema: GenerateProductImageOutputSchema,
  },
  async ({ productName, brand, sizeVariant, category }) => {
    const descriptor = [brand, productName, sizeVariant].filter(Boolean).join(' ');

    const prompt =
      `A clean, professional e-commerce product photograph of "${descriptor}"` +
      `${category ? ` (a ${category} item)` : ''}. ` +
      `Single product centred on a pure white seamless background, soft even studio lighting, ` +
      `sharp focus, realistic packaging, no text overlays, no watermark, no people, no props. ` +
      `Square 1:1 framing suitable for a retail catalogue thumbnail.`;

    const { media } = await ai.generate({
      model: googleAI.model('gemini-2.5-flash-image'),
      prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    });

    if (!media?.url) throw new Error('Image model returned no image');
    return { dataUri: media.url };
  },
);
