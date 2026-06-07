import { Nango } from '@nangohq/node';
import { db } from '@/lib/db';

export const NANGO_INTEGRATION = 'google-sheet';

// Lazy singleton — never module-level (breaks SSG)
function getNango(): Nango {
  if (!process.env.NANGO_SECRET_KEY) throw new Error('NANGO_SECRET_KEY not configured');
  return new Nango({ secretKey: process.env.NANGO_SECRET_KEY });
}

export function nangoConnectionId(brandId: string) {
  return `brand-${brandId}`;
}

export async function isNangoConnected(brandId: string): Promise<boolean> {
  try {
    const nango = getNango();
    await nango.getConnection(NANGO_INTEGRATION, nangoConnectionId(brandId));
    return true;
  } catch {
    return false;
  }
}

export async function exportCampaignToSheets(
  brandId: string,
  campaignId?: string,
): Promise<string> {
  const nango = getNango();
  const connId = nangoConnectionId(brandId);

  // Fetch proof-of-play rows
  const events = await db.playEvent.findMany({
    where: {
      campaign: { brand: { id: brandId } },
      ...(campaignId ? { campaignId } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: 5000,
    include: {
      device: { select: { id: true, name: true, groupName: true } },
      campaign: { select: { id: true, name: true } },
    },
  });

  const title = campaignId
    ? `ALIVE Campaign Report — ${events[0]?.campaign?.name ?? campaignId}`
    : `ALIVE All-Campaign Report`;

  // Create spreadsheet
  const createRes = await nango.proxy<{ spreadsheetId: string }>({
    providerConfigKey: NANGO_INTEGRATION,
    connectionId: connId,
    method: 'POST',
    endpoint: 'https://sheets.googleapis.com/v4/spreadsheets',
    data: {
      properties: { title },
      sheets: [{ properties: { title: 'Proof of Play' } }],
    },
  });
  const sheetId = createRes.data.spreadsheetId;

  // Build rows: header + data
  const header = ['Date', 'Time', 'Campaign', 'Device', 'Group', 'Duration (s)', 'Impressions', 'Cost (₹)'];
  const rows: (string | number)[][] = events.map((e) => [
    e.startedAt.toISOString().slice(0, 10),
    e.startedAt.toISOString().slice(11, 19),
    e.campaign?.name ?? e.campaignId ?? '—',
    e.device?.name ?? e.deviceId,
    e.device?.groupName ?? '—',
    +(e.durationMs / 1000).toFixed(1),
    e.impressions,
    +(e.costPaise / 100).toFixed(2),
  ]);

  await nango.proxy({
    providerConfigKey: NANGO_INTEGRATION,
    connectionId: connId,
    method: 'POST',
    endpoint: `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:append?valueInputOption=USER_ENTERED`,
    data: {
      range: 'A1',
      majorDimension: 'ROWS',
      values: [header, ...rows],
    },
  });

  return `https://docs.google.com/spreadsheets/d/${sheetId}`;
}
