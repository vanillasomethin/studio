// GET /api/admin/store-app-build — the latest installable ALIVE Store build.
//
// The admin card used to require someone to paste an EAS link by hand, which
// meant the QR on the dashboard was only as fresh as the last person who
// remembered to update it. EAS already knows what the newest build is, so ask it.
//
// Shape of the answer is deliberately "a URL plus why we chose it", so the card
// can say whether it is showing a real build or a configured fallback rather
// than silently rendering a stale QR.
//
// Auth: named admin session. Nothing here is secret — the install page is
// behind Expo's own auth for internal distribution — but it burns an upstream
// API call, so it is not left open.

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';

// From store-app/app.json → expo.extra.eas.projectId. Hardcoded rather than an
// env var because it identifies the app itself, not a deployment: a second value
// would just be a way for the two to disagree.
const EAS_PROJECT_ID = '6a63834c-7c6a-474c-a438-ca5bbfd0b32f';
const EXPO_GRAPHQL   = 'https://api.expo.dev/graphql';

// Only Android, only FINISHED. eas.json's `production` profile builds an
// app-bundle, which cannot be installed from a link — so a build is only useful
// here if it produced an APK, which the `preview` and `development` profiles do.
const QUERY = `
  query LatestAndroidBuild($appId: String!) {
    app {
      byId(appId: $appId) {
        builds(limit: 5, offset: 0, platform: ANDROID, status: FINISHED) {
          id
          appVersion
          appBuildVersion
          distribution
          buildProfile
          completedAt
          artifacts { buildUrl applicationArchiveUrl }
        }
      }
    }
  }
`;

type EasBuild = {
  id: string;
  appVersion: string | null;
  appBuildVersion: string | null;
  distribution: string | null;
  buildProfile: string | null;
  completedAt: string | null;
  artifacts: { buildUrl: string | null; applicationArchiveUrl: string | null } | null;
};

export type StoreAppBuild = {
  /** What the QR should encode, or null when nothing is configured. */
  url: string | null;
  /** 'eas' — a real build; 'env' — the configured fallback; 'none'. */
  source: 'eas' | 'env' | 'none';
  version: string | null;
  buildNumber: string | null;
  profile: string | null;
  completedAt: string | null;
  /** Set when EAS was asked but could not answer, so the card can say why. */
  error: string | null;
};

const empty = (source: StoreAppBuild['source'], url: string | null, error: string | null = null): StoreAppBuild =>
  ({ url, source, version: null, buildNumber: null, profile: null, completedAt: null, error });

async function latestFromEas(token: string): Promise<{ build: EasBuild | null; error: string | null }> {
  try {
    const res = await fetch(EXPO_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: QUERY, variables: { appId: EAS_PROJECT_ID } }),
      // A build appears at most a few times a day and every admin loading the
      // dashboard hits this, so a short cache keeps us well clear of Expo's
      // rate limits without the card ever feeling stale.
      next: { revalidate: 300 },
    });
    if (!res.ok) return { build: null, error: `Expo API returned ${res.status}` };

    const body = await res.json() as {
      data?: { app?: { byId?: { builds?: EasBuild[] } } };
      errors?: { message: string }[];
    };
    if (body.errors?.length) return { build: null, error: body.errors[0].message };

    const builds = body.data?.app?.byId?.builds ?? [];
    // The newest build that actually produced an installable file. `production`
    // is an .aab and has no install URL, so it is skipped rather than shown as a
    // QR that leads nowhere.
    const installable = builds.find((b) => b.artifacts?.buildUrl || b.artifacts?.applicationArchiveUrl);
    return { build: installable ?? null, error: installable ? null : 'No finished Android build with an installable artifact' };
  } catch (e) {
    return { build: null, error: (e as Error).message };
  }
}

export async function GET(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();

  const envUrl = process.env.NEXT_PUBLIC_EXPO_PREVIEW_URL?.trim() || null;
  const token  = process.env.EXPO_TOKEN?.trim();

  if (!token) {
    return NextResponse.json(
      empty(envUrl ? 'env' : 'none', envUrl, 'EXPO_TOKEN is not set — showing the configured URL instead of the latest build.'),
    );
  }

  const { build, error } = await latestFromEas(token);
  if (!build) {
    // Falling back rather than failing: a stale-but-working QR beats an empty card.
    return NextResponse.json(empty(envUrl ? 'env' : 'none', envUrl, error));
  }

  const body: StoreAppBuild = {
    // buildUrl is the install page (handles the device check and the APK
    // download); applicationArchiveUrl is the raw file, used only if the page
    // is missing.
    url:         build.artifacts?.buildUrl ?? build.artifacts?.applicationArchiveUrl ?? null,
    source:      'eas',
    version:     build.appVersion,
    buildNumber: build.appBuildVersion,
    profile:     build.buildProfile,
    completedAt: build.completedAt,
    error:       null,
  };
  return NextResponse.json(body);
}
