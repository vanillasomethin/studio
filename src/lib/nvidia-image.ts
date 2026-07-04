// NVIDIA hosted image generation (build.nvidia.com).
//
// Used to generate catalogue/flyer product images. Env-gated: when
// NVIDIA_API_KEY is set it's the preferred image provider; callers fall back to
// their existing provider (Gemini) if it isn't configured or a call fails.
//
// Endpoint shape: POST https://ai.api.nvidia.com/v1/genai/<model>
//   Authorization: Bearer <key>
//   body: { prompt, mode, width, height, seed, steps }
//   response: { artifacts: [{ base64 }] }  (also tolerates OpenAI-style data[].b64_json)
//
// Env:
//   NVIDIA_API_KEY       — build.nvidia.com API key (nvapi-...)
//   NVIDIA_IMAGE_MODEL   — model path (default black-forest-labs/flux.1-schnell)
//   NVIDIA_IMAGE_STEPS   — diffusion steps (default 4 — schnell is a 4-step model)

const HOST = 'https://ai.api.nvidia.com/v1/genai';

function cfg(): { key: string; model: string; steps: number } | null {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) return null;
  return {
    key,
    model: process.env.NVIDIA_IMAGE_MODEL || 'black-forest-labs/flux.1-schnell',
    steps: Number(process.env.NVIDIA_IMAGE_STEPS || 4),
  };
}

export function isNvidiaImageConfigured(): boolean {
  return cfg() !== null;
}

/**
 * Generates a 1:1 image from a text prompt via NVIDIA's hosted image API.
 * Returns a PNG data URI, or null on any failure so the caller can fall back.
 */
export async function generateImageNvidia(prompt: string): Promise<string | null> {
  const c = cfg();
  if (!c) return null;
  try {
    const res = await fetch(`${HOST}/${c.model}`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${c.key}`,
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        mode:   'base',
        width:  1024,
        height: 1024,
        seed:   0,
        steps:  c.steps,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null) as
      | { artifacts?: { base64?: string }[]; data?: { b64_json?: string }[] }
      | null;
    const b64 = data?.artifacts?.[0]?.base64 ?? data?.data?.[0]?.b64_json ?? null;
    if (!b64) return null;
    return `data:image/png;base64,${b64}`;
  } catch {
    return null;
  }
}
