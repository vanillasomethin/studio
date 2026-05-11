// POST /api/voicebill/parse
// Body: { text: string }
// Returns: { items: { name: string; qty: number; unit: string; price: number }[] }
// Auth: store session required

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ai } from '@/ai/genkit';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { text } = await req.json() as { text: string };
    if (!text?.trim()) return NextResponse.json({ items: [] });

    const prompt = `You are a kirana store bill parser. Extract purchased items from the shopkeeper's spoken or typed text.
Return ONLY valid JSON with no markdown or explanation.
Format: {"items": [{"name": "Item Name", "qty": 1, "unit": "pcs", "price": 0}]}
Rules:
- price is per unit in Indian Rupees (whole number)
- If price not mentioned, guess a reasonable Indian kirana price
- unit: pcs | kg | g | L | ml | pack | dozen
- Normalize item names (capitalize properly)
Common Indian kirana prices: Maggi=14, Milk 500ml=28, Sugar 1kg=45, Bread=35, Biscuit(Parle-G)=10, Rice 1kg=60, Atta 1kg=55, Oil 1L=130, Salt 1kg=20, Tea 100g=60

Text to parse: "${text.trim()}"`;

    const result = await ai.generate(prompt);
    const raw    = result.text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw) as { items: { name: string; qty: number; unit: string; price: number }[] };

    return NextResponse.json({ items: parsed.items ?? [] });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
