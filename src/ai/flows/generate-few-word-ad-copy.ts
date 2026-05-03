'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFewWordAdCopyInputSchema = z.object({
  brandName: z.string().describe('The name of the brand or product being advertised.'),
  description: z.string().describe('A brief description of the product, offer, or key selling point.'),
});
export type GenerateFewWordAdCopyInput = z.infer<typeof GenerateFewWordAdCopyInputSchema>;

const GenerateFewWordAdCopyOutputSchema = z.object({
  tagline: z.string().describe('A punchy 3–6 word tagline for the kirana store screen.'),
});
export type GenerateFewWordAdCopyOutput = z.infer<typeof GenerateFewWordAdCopyOutputSchema>;

export async function generateFewWordAdCopy(
  input: GenerateFewWordAdCopyInput
): Promise<GenerateFewWordAdCopyOutput> {
  return generateFewWordAdCopyFlow(input);
}

const generateFewWordAdCopyPrompt = ai.definePrompt({
  name: 'generateFewWordAdCopyPrompt',
  input: {schema: GenerateFewWordAdCopyInputSchema},
  output: {schema: GenerateFewWordAdCopyOutputSchema},
  prompt: `You are an expert copywriter specializing in ultra-short ad copy for in-store digital screens in Indian kirana (neighbourhood grocery) stores. Your job is to distil a brand and its offer into a punchy, memorable tagline of exactly 3–6 words that grabs attention in under 2 seconds.

Rules:
- 3 to 6 words maximum.
- Plain English or a single common Hindi/Hinglish word is fine if it adds punch.
- No punctuation other than an optional exclamation mark at the end.
- Evoke benefit, freshness, or value — not features.

Brand: {{{brandName}}}
Offer / description: {{{description}}}

Return only the tagline, nothing else.`,
});

const generateFewWordAdCopyFlow = ai.defineFlow(
  {
    name: 'generateFewWordAdCopyFlow',
    inputSchema: GenerateFewWordAdCopyInputSchema,
    outputSchema: GenerateFewWordAdCopyOutputSchema,
  },
  async input => {
    const {output} = await generateFewWordAdCopyPrompt(input);
    return output!;
  }
);
