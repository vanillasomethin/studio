import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const keyId     = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return NextResponse.json(
      { error: 'Razorpay credentials are not configured on the server.' },
      { status: 500 },
    );
  }

  try {
    const { amount, receipt, notes } = await req.json();

    const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    // Razorpay requires note values to be strings
    const safeNotes: Record<string, string> = {};
    if (notes && typeof notes === 'object') {
      for (const [k, v] of Object.entries(notes)) {
        safeNotes[k] = String(v);
      }
    }

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount:   Math.round(Number(amount) * 100), // INR → paise
        currency: 'INR',
        receipt:  (receipt as string | undefined) ?? `alive_${Date.now()}`,
        notes:    safeNotes,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const message = (data as { error?: { description?: string } }).error?.description
        ?? 'Razorpay order creation failed';
      return NextResponse.json({ error: message }, { status: 502 });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Internal server error' },
      { status: 500 },
    );
  }
}
