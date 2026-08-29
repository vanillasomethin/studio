'use client';

// Polls for screen-offline alerts and pops a toast in the admin panel the
// moment a screen drops, plus keeps the header bell's unread count live.
//
// Uses sonner rather than the shadcn toast: src/hooks/use-toast.ts sets
// TOAST_LIMIT = 1 with a ~16-minute removal delay, so a fleet-wide outage would
// collapse into a single stuck popup. Sonner stacks and auto-dismisses.
//
// Renders nothing — it's a behaviour-only component mounted once by the admin
// shell.

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const POLL_MS = 45_000;
const SS_PW   = 'alive_admin_pw';

type AlertRow = {
  id: string;
  status: 'OPEN' | 'RESOLVED';
  severity: string;
  deviceName: string;
  storeName: string | null;
  startedAt: string;
  resolvedAt: string | null;
  adminReadAt: string | null;
  // Filled when the screen comes back and the server works out what happened.
  cause: string | null;
  causeConfidence: string | null;
  causeEvidence: string | null;
};

/**
 * " for 3h 20m" — how long an already-running outage has been going, for the
 * on-load toast. Empty for anything under a minute (and for an unparseable
 * date) so a fresh drop reads as a plain "stopped responding".
 */
function sinceLabel(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return '';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return ` for ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? ` for ${h}h ${m}m` : ` for ${h}h`;
}

/** Plain-language cause for the recovery toast — the bit that has to land at a glance. */
function causeLine(cause: string | null): string | null {
  switch (cause) {
    case 'POWER_LOST':     return 'Cause: power was cut at the store';
    case 'NETWORK_LOST':   return 'Cause: internet/Wi-Fi dropped — the screen and player were fine';
    case 'APP_STOPPED':    return 'Cause: the player app stopped';
    case 'PLAYER_UPDATED': return 'Cause: restarted for a player update';
    default:               return null;
  }
}

export default function OfflineAlertWatcher({
  onUnreadChange, onOpenAlerts,
}: {
  onUnreadChange?: (n: number) => void;
  onOpenAlerts?: () => void;
}) {
  // Alert ids already surfaced in this browser session, so a poll never
  // re-toasts something the admin has already seen pop up.
  const seenOpen     = useRef<Set<string>>(new Set());
  const seenResolved = useRef<Set<string>>(new Set());
  const primed       = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      const pw = sessionStorage.getItem(SS_PW) ?? '';
      if (!pw) return;
      try {
        const res = await fetch('/api/admin/alerts', { headers: { 'admin-password': pw } });
        if (!res.ok || cancelled) return;
        const { alerts, unread } = await res.json() as { alerts: AlertRow[]; unread: number };

        onUnreadChange?.(unread);

        // The API returns at most 100 rows and drops resolved ones after an
        // hour, so bound the seen-sets to that same horizon — otherwise a panel
        // left open for days grows them without limit.
        if (seenOpen.current.size > 500) {
          const live = new Set(alerts.map((a) => a.id));
          seenOpen.current     = new Set([...seenOpen.current].filter((id) => live.has(id)));
          seenResolved.current = new Set([...seenResolved.current].filter((id) => live.has(id)));
        }

        // First poll after a page load: record what's already outstanding so the
        // per-screen toasts below never re-fire for them.
        //
        // This used to return silently, which made the popup almost unreachable
        // in practice: a toast could only appear if a screen dropped during the
        // 45s window while the panel happened to be open, and the health sweep
        // that opens alerts runs hours late (see the cron's real cadence), so
        // the alert was nearly always already outstanding by the time anyone
        // opened /admin — and priming swallowed it. Priming exists to avoid one
        // popup PER SCREEN, not to hide the outage, so say it once instead.
        // Only unread alerts qualify: once dismissed in the Alerts tab it must
        // not pop again on every reload.
        if (!primed.current) {
          for (const a of alerts) {
            (a.status === 'OPEN' ? seenOpen : seenResolved).current.add(a.id);
          }
          primed.current = true;

          const outstanding = alerts.filter((a) => a.status === 'OPEN' && !a.adminReadAt);
          if (outstanding.length === 1) {
            const a = outstanding[0];
            toast.error(`${a.storeName ?? 'Unassigned'} — screen offline`, {
              description: `${a.deviceName} stopped responding${sinceLabel(a.startedAt)}. Check power and internet at the store.`,
              duration: 15000,
              action: onOpenAlerts ? { label: 'View', onClick: onOpenAlerts } : undefined,
            });
          } else if (outstanding.length > 1) {
            toast.error(`${outstanding.length} screens are offline`, {
              description: outstanding.slice(0, 4).map((a) => a.storeName ?? a.deviceName).join(', ')
                + (outstanding.length > 4 ? ` +${outstanding.length - 4} more` : ''),
              duration: 15000,
              action: onOpenAlerts ? { label: 'View', onClick: onOpenAlerts } : undefined,
            });
          }
          return;
        }

        const freshlyOffline = alerts.filter((a) => a.status === 'OPEN' && !seenOpen.current.has(a.id));
        // Only celebrate a recovery whose outage THIS tab actually reported.
        // Otherwise a tab opened after a screen dropped would pop a bare
        // "X is back online" for an outage the admin was never told about.
        const freshlyBack = alerts.filter((a) =>
          a.status === 'RESOLVED' && seenOpen.current.has(a.id) && !seenResolved.current.has(a.id));

        for (const a of freshlyOffline) seenOpen.current.add(a.id);
        for (const a of freshlyBack)    seenResolved.current.add(a.id);

        // Aggregate a mass outage into one popup — 12 separate toasts for a
        // city-wide power cut is noise, not a signal.
        if (freshlyOffline.length > 2) {
          toast.error(`${freshlyOffline.length} screens went offline`, {
            description: freshlyOffline.slice(0, 4).map((a) => a.storeName ?? a.deviceName).join(', ')
              + (freshlyOffline.length > 4 ? ` +${freshlyOffline.length - 4} more` : ''),
            duration: 15000,
            action: onOpenAlerts ? { label: 'View', onClick: onOpenAlerts } : undefined,
          });
        } else {
          for (const a of freshlyOffline) {
            toast.error(`${a.storeName ?? 'Unassigned'} — screen offline`, {
              description: `${a.deviceName} stopped responding. Check power and internet at the store.`,
              duration: 15000,
              action: onOpenAlerts ? { label: 'View', onClick: onOpenAlerts } : undefined,
            });
          }
        }

        for (const a of freshlyBack) {
          // The recovery toast is where the cause lands: the returning screen has just
          // reported the restart clocks that make the outage diagnosable, so this is the
          // first moment we can say WHY rather than merely that it dropped. Held longer
          // than a bare "back online" because it now carries something to act on.
          const line = causeLine(a.cause);
          toast.success(`${a.storeName ?? a.deviceName} is back online`, {
            description: line ?? undefined,
            duration: line ? 12000 : 6000,
            action: line && onOpenAlerts ? { label: 'Details', onClick: onOpenAlerts } : undefined,
          });
        }
      } catch { /* transient — the next poll retries */ }
    };

    void poll();
    const id = setInterval(() => void poll(), POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [onUnreadChange, onOpenAlerts]);

  return null;
}
