import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { amount, receipt, notes } = await req.json();

    const credentials = Buffer.from(
      `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`,
    ).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // paise
        currency: 'INR',
        receipt: receipt ?? `alive_${Date.now()}`,
        notes: notes ?? {},
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json({ error: 'Order creation failed', detail: err }, { status: 502 });
    }

    const order = await response.json();
    return NextResponse.json(order);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
