'use server';
/**
 * @fileOverview A Kirana Store Impact Explorer AI agent.
 *
 * - personalizeKiranaStoreExplorer - A function that handles the kirana store impact estimation process.
 * - PersonalizeKiranaStoreExplorerInput - The input type for the personalizeKiranaStoreExplorer function.
 * - PersonalizeKiranaStoreExplorerOutput - The return type for the personalizeKiranaStoreExplorer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PersonalizeKiranaStoreExplorerInputSchema = z.object({
  city: z.string().describe('The city where the user wants to estimate reach.'),
  locality: z.string().describe('The specific locality within the city.'),
});
export type PersonalizeKiranaStoreExplorerInput = z.infer<
  typeof PersonalizeKiranaStoreExplorerInputSchema
>;

const PersonalizeKiranaStoreExplorerOutputSchema = z.object({
  shops: z
    .number()
    .describe(
      'The estimated number of partner kirana shops available in a 5km radius of the given locality.'
    ),
  impressions: z
    .number()
    .describe(
      'The estimated total monthly ad impressions across all available partner shops in that radius.'
    ),
});
export type PersonalizeKiranaStoreExplorerOutput = z.infer<
  typeof PersonalizeKiranaStoreExplorerOutputSchema
>;

export async function personalizeKiranaStoreExplorer(
  input: PersonalizeKiranaStoreExplorerInput
): Promise<PersonalizeKiranaStoreExplorerOutput> {
  return personalizeKiranaStoreExplorerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'personalizeKiranaStoreExplorerPrompt',
  input: {schema: PersonalizeKiranaStoreExplorerInputSchema},
  output: {schema: PersonalizeKiranaStoreExplorerOutputSchema},
  prompt: `You are an expert in Indian retail demographics and kirana store distribution. Your task is to estimate the potential advertising reach for a given locality.

You will use the provided city and locality to generate a realistic estimation of available partner shops and the total monthly ad impressions they would generate.

City: {{{city}}}
Locality: {{{locality}}}

Based on this information, provide the following estimations for a 5km radius around the locality:
1.  **shops**: A realistic number of kirana stores we could partner with. This should be a reasonable integer, not an exact count. For a dense metro area like Koramangala, Bangalore, a number between 40-60 is reasonable. For a less dense area, it would be lower.
2.  **impressions**: The total estimated monthly ad impressions. Assume each shop generates about 6,000 impressions per month. So, impressions = shops * 6000.

Return the data in the specified JSON format.
`,
});

const personalizeKiranaStoreExplorerFlow = ai.defineFlow(
  {
    name: 'personalizeKiranaStoreExplorerFlow',
    inputSchema: PersonalizeKiranaStoreExplorerInputSchema,
    outputSchema: PersonalizeKiranaStoreExplorerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
