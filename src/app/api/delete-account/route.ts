// POST /api/delete-account
// Accepts a data-deletion request and notifies the privacy team via email + WhatsApp.
// No auth required — anyone can submit; the team verifies identity before acting.

import { NextRequest, NextResponse } from 'next/server';
import { notifyAdminEmail, notifyAdminWA } from '@/lib/notify';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, accountType, message, deletionScope, dataCategories } = await req.json() as {
      name?: string; email?: string; phone?: string;
      accountType?: string; message?: string;
      deletionScope?: 'full' | 'partial';
      dataCategories?: string[];
    };

    if (!email?.trim() && !phone?.trim()) {
      return NextResponse.json({ error: 'Email or phone is required to identify your account.' }, { status: 400 });
    }

    const scopeLabel = deletionScope === 'partial' ? 'Partial data deletion' : 'Full account deletion';
    const categoriesLabel = dataCategories?.join(', ') || 'all';
    const subject = `${scopeLabel} Request — ${name || email || phone}`;
    const html = `
      <h2>${scopeLabel} Request</h2>
      <table cellpadding="6" style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
        <tr><td><strong>Name</strong></td><td>${name || '—'}</td></tr>
        <tr><td><strong>Email</strong></td><td>${email || '—'}</td></tr>
        <tr><td><strong>Phone</strong></td><td>${phone || '—'}</td></tr>
        <tr><td><strong>Account type</strong></td><td>${accountType || '—'}</td></tr>
        <tr><td><strong>Scope</strong></td><td>${scopeLabel}</td></tr>
        <tr><td><strong>Data categories</strong></td><td>${categoriesLabel}</td></tr>
        <tr><td><strong>Message</strong></td><td>${message || '—'}</td></tr>
        <tr><td><strong>Submitted</strong></td><td>${new Date().toISOString()}</td></tr>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#666;">
        Action required: verify identity then process within 30 days per DPDPA §12.
      </p>
    `;

    const waMsg = `📋 ${scopeLabel}\nName: ${name || '—'}\nEmail: ${email || '—'}\nPhone: ${phone || '—'}\nType: ${accountType || '—'}\nData: ${categoriesLabel}`;

    await Promise.allSettled([
      notifyAdminEmail(subject, html),
      notifyAdminWA(waMsg),
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Please email privacy@wearealive.in directly.' }, { status: 500 });
  }
}
