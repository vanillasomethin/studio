// UPI deep link helper — works on any Indian UPI app
export function upiDeepLink(params: {
  upiId: string;
  name: string;
  amount: number;  // rupees
  note: string;
}): string {
  return `upi://pay?pa=${encodeURIComponent(params.upiId)}&pn=${encodeURIComponent(params.name)}&am=${params.amount}&tn=${encodeURIComponent(params.note)}&cu=INR`;
}

// Razorpay X payout instructions for admin setup
export const RAZORPAY_X_SETUP = `
To enable automated bank payouts from admin:
1. Create a Razorpay X account at razorpay.com/x
2. Add to Vercel env vars:
   RAZORPAY_X_KEY_ID=rzp_x_...
   RAZORPAY_X_KEY_SECRET=...
   RAZORPAY_X_ACCOUNT_NUMBER=your-razorpay-x-virtual-account-number
3. Fund your Razorpay X account with INR
4. Each "Pay Now" click will auto-transfer via NEFT/UPI
`.trim();
