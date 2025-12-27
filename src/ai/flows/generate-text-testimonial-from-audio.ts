'use server';
/**
 * @fileOverview A flow to generate text testimonials from audio content.
 *
 * - generateTextTestimonialFromAudio - A function that takes an audio data URI and generates a text testimonial.
 * - GenerateTextTestimonialFromAudioInput - The input type for the generateTextTestimonialFromAudio function.
 * - GenerateTextTestimonialFromAudioOutput - The return type for the generateTextTestimonialFromAudio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import wav from 'wav';

const GenerateTextTestimonialFromAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio testimonial as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type GenerateTextTestimonialFromAudioInput = z.infer<typeof GenerateTextTestimonialFromAudioInputSchema>;

const GenerateTextTestimonialFromAudioOutputSchema = z.object({
  textTestimonial: z.string().describe('The generated text testimonial from the audio content.'),
});
export type GenerateTextTestimonialFromAudioOutput = z.infer<typeof GenerateTextTestTestimonialFromAudioOutputSchema>;

export async function generateTextTestimonialFromAudio(input: GenerateTextTestimonialFromAudioInput): Promise<GenerateTextTestimonialFromAudioOutput> {
  return generateTextTestimonialFromAudioFlow(input);
}

const generateTextTestimonialPrompt = ai.definePrompt({
  name: 'generateTextTestimonialPrompt',
  input: {schema: GenerateTextTestimonialFromAudioInputSchema},
  output: {schema: GenerateTextTestimonialFromAudioOutputSchema},
  prompt: `You are an AI expert at creating short, engaging text testimonials from audio recordings.  Listen to the following audio testimonial and generate a concise text version.  The text testimonial should capture the essence of the speaker's message in a way that is compelling and easily readable.

Audio: {{media url=audioDataUri}}`,
});

const generateTextTestimonialFromAudioFlow = ai.defineFlow(
  {
    name: 'generateTextTestimonialFromAudioFlow',
    inputSchema: GenerateTextTestimonialFromAudioInputSchema,
    outputSchema: GenerateTextTestimonialFromAudioOutputSchema,
  },
  async input => {
    const {output} = await generateTextTestimonialPrompt(input);
    return output!;
  }
);
