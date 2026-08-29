// GET /api/admin/store-payments/bulk-export?month=YYYY-MM
// Generates a NEFT bulk payment CSV for the given month's pending store payouts.
// Format compatible with: SBI YONO Business, HDFC NetBanking, ICICI CIB bulk upload.
// Admin downloads this file and uploads it to their bank portal.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function checkAdmin(req: NextRequest) {
  const pw = req.headers.get('admin-password') ?? '';
  return !!process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD;
}

function fmtMonth(m: string) {
  const [y, mo] = m.split('-');
  return new Date(parseInt(y), parseInt(mo) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

// Every cell of the bank file goes through this — no exceptions. Partner-supplied
// values (upiId, bank details, ownerName, whatsapp) reach this file verbatim, so
// escaping per-field invites the one that gets missed.
function csvCell(value: unknown): string {
  const s = value == null ? '' : String(value);
  // Strip control characters rather than rely on quoting them. A quoted CRLF is
  // legal RFC-4180, but bank upload portals parse line-by-line and would read the
  // tail as a second payment instruction. Nothing legitimate in a name, UPI id,
  // account number, IFSC or phone contains one.
  const flat = s.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();
  // A leading = + - @ turns the cell into a formula when the admin opens the file.
  const guarded = /^[=+\-@]/.test(flat) ? `'${flat}` : flat;
  // Quote unconditionally and double internal quotes so a comma or quote cannot
  // shift columns and redirect a transfer to another account.
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get('month'); // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 });
  }

  try {
    // Only stores that actually went live earn a payout. agreedAt means the partner
    // signed, not that a screen is running — paying on it pays for nothing.
    const [y, mo] = month.split('-').map(Number);
    const monthEnd = new Date(y, mo, 1);

    const stores = await db.store.findMany({
      where: { liveAt: { lte: monthEnd } },
      select: {
        id: true, storeName: true, ownerName: true, whatsapp: true,
        upiId: true, bankAccountNo: true, bankIfsc: true, bankAccountName: true, payoutMethod: true,
        monthlyCompensationPaise: true,
        liveAt: true,
      },
    });

    // Exclude stores already paid this month
    const paidThisMonth = await db.storePayment.findMany({
      where: { month, status: 'paid' },
      select: { storeId: true },
    });
    const paidSet = new Set(paidThisMonth.map((p) => p.storeId));

    const unpaid = stores.filter((s) => !paidSet.has(s.id));

    // A row with no destination is rejected by the bank and can fail the whole
    // batch. Drop them, but report the count rather than truncating silently.
    const pending = unpaid.filter((s) => s.upiId || s.bankAccountNo);
    const skippedNoPayoutDetails = unpaid.length - pending.length;

    if (pending.length === 0) {
      return NextResponse.json({ error: 'No pending stores for this month' }, { status: 404 });
    }

    const monthLabel = fmtMonth(month);
    const narration  = `ALIVE Partner ${monthLabel}`;

    // ── Build CSV rows ────────────────────────────────────────────────────────
    // Generic format compatible with most Indian bank bulk upload portals.
    // Columns: Sr No, Beneficiary Name, Account Number / UPI, IFSC, Amount, Mode, Narration
    const rows: string[] = [
      'Sr No,Beneficiary Name,Account / UPI ID,IFSC Code,Amount (INR),Mode,Narration,Phone',
    ];

    pending.forEach((store, i) => {
      const name    = store.ownerName || store.storeName;
      const account = store.upiId ?? store.bankAccountNo ?? '';
      const ifsc    = store.bankIfsc ?? '';
      const mode    = store.upiId ? 'UPI' : 'NEFT';
      // Honour the store's own tier — ₹500 standard, ₹1000 premium. Hardcoding
      // 500 here underpaid every premium partner, silently, every month.
      const amount  = (store.monthlyCompensationPaise / 100).toFixed(2);
      const phone   = store.whatsapp ?? '';
      rows.push([i + 1, name, account, ifsc, amount, mode, narration, phone].map(csvCell).join(','));
    });

    const csv = rows.join('\r\n');
    const filename = `alive-payments-${month}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Alive-Rows': String(pending.length),
        'X-Alive-Skipped-No-Payout-Details': String(skippedNoPayoutDetails),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
