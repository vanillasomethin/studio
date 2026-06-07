// Maxun integration — fetch product MRP candidates from Amazon India & Flipkart.
//
// Maxun (https://github.com/getmaxun/maxun) is a self-hosted no-code scraper that
// runs real browsers. It cannot run inside this Vercel app — it lives on a separate
// server. We only call its REST API here. Configure two "robots" in the Maxun UI:
//   - one that searches Amazon  and captures a product list (title + price)
//   - one that searches Flipkart and captures a product list (title + price)
// Each robot takes the search query as an input parameter named `query`.
//
// Env:
//   MAXUN_API_URL        e.g. https://maxun.your-host.com/api/sdk
//   MAXUN_API_KEY        x-api-key for the Maxun instance
//   MAXUN_ROBOT_AMAZON   robot id for the Amazon search extractor
//   MAXUN_ROBOT_FLIPKART robot id for the Flipkart search extractor

export type MrpSource = 'amazon' | 'flipkart';

export type MrpCandidate = {
  source: MrpSource;
  title: string;
  price: number;      // rupees
  url?: string;
};

function maxunConfigured(): boolean {
  return !!(process.env.MAXUN_API_URL && process.env.MAXUN_API_KEY);
}

// Pull the first plausible rupee amount out of a scraped price string like "₹1,299.00" or "Rs. 499"
function parseRupees(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[₹,]/g, '').replace(/rs\.?/i, '');
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Math.round(parseFloat(match[0]));
  return n > 0 && n < 1_000_000 ? n : null;
}

// Shape of a Maxun list row is robot-defined; we look for common title/price keys.
function rowTitle(row: Record<string, unknown>): string {
  for (const k of ['title', 'name', 'productName', 'product', 'text']) {
    if (typeof row[k] === 'string' && (row[k] as string).trim()) return (row[k] as string).trim();
  }
  return '';
}
function rowPrice(row: Record<string, unknown>): number | null {
  for (const k of ['price', 'mrp', 'amount', 'cost']) {
    const p = parseRupees(row[k]);
    if (p !== null) return p;
  }
  return null;
}
function rowUrl(row: Record<string, unknown>): string | undefined {
  for (const k of ['url', 'link', 'href']) {
    if (typeof row[k] === 'string' && (row[k] as string).startsWith('http')) return row[k] as string;
  }
  return undefined;
}

async function runRobot(robotId: string, query: string, source: MrpSource): Promise<MrpCandidate[]> {
  const base = process.env.MAXUN_API_URL!.replace(/\/$/, '');
  const res = await fetch(`${base}/robots/${robotId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.MAXUN_API_KEY!,
    },
    body: JSON.stringify({ input: { query } }),
    // Maxun execute blocks until the browser run finishes
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`Maxun ${source} run failed (HTTP ${res.status})`);
  }

  const json = await res.json() as { data?: { data?: { listData?: Record<string, unknown>[] } } };
  const list = json.data?.data?.listData ?? [];

  return list
    .map((row): MrpCandidate | null => {
      const title = rowTitle(row);
      const price = rowPrice(row);
      if (!title || price === null) return null;
      return { source, title, price, url: rowUrl(row) };
    })
    .filter((c): c is MrpCandidate => c !== null)
    .slice(0, 5);
}

// Fetch MRP candidates from both marketplaces for a product search query.
// Returns whatever succeeds — one marketplace failing does not fail the whole call.
export async function fetchMrpCandidates(query: string): Promise<{ candidates: MrpCandidate[]; errors: string[] }> {
  if (!maxunConfigured()) {
    throw new Error('Maxun not configured. Set MAXUN_API_URL and MAXUN_API_KEY.');
  }

  const jobs: { robot?: string; source: MrpSource }[] = [
    { robot: process.env.MAXUN_ROBOT_AMAZON,   source: 'amazon' },
    { robot: process.env.MAXUN_ROBOT_FLIPKART, source: 'flipkart' },
  ];

  const candidates: MrpCandidate[] = [];
  const errors: string[] = [];

  const results = await Promise.allSettled(
    jobs
      .filter((j) => j.robot)
      .map((j) => runRobot(j.robot!, query, j.source)),
  );

  results.forEach((r) => {
    if (r.status === 'fulfilled') candidates.push(...r.value);
    else errors.push((r.reason as Error).message);
  });

  // Sort highest price first — MRP is usually the upper bound across sellers
  candidates.sort((a, b) => b.price - a.price);

  return { candidates, errors };
}
