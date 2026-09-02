// PATCH /api/slots/settings — slot-mode configuration, three shapes:
//   { storeId, loopSlotCount?, openDays?, hoursStart?, hoursEnd?, fillerCampaignId? }
//     — per-store slot config. loopSlotCount: null disables slot mode (store reverts
//       to its normal schedules); an integer enables the fixed loop.
//   { defaultFillerCampaignId } — global house-ads default (PlayerConfig).
//   { campaignId, slotContentId } — assign a campaign's 10s slot creative.
// Auth: admin-password header. Store config changes push plan_updated to its devices.

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { istToday, parseHHmm, slotSpanForDuration, uniformSlotSpan, type SlotCreativeMeta } from '@/lib/slots';
import { applySlotMoves, planSlotCompaction, resolveFillerCampaign, type SlotMove } from '@/lib/slots-db';
import { pushPlanUpdated } from '@/lib/fcm';
import { isSlotTier } from '@/lib/slot-pricing';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

/**
 * Writes the reassignment note. This is also what the brand dashboard reads back to
 * show the affected brand what happened (via /api/brand/slot-stats) — deliberately no
 * outbound email/WhatsApp for now, so brands learn about it when they next look at
 * their dashboard rather than getting messaged about an internal loop change.
 *
 * `campaignIds` duplicates the ids inside `moves` as a flat array purely so the
 * dashboard can filter these rows by campaign with a simple JSON containment query.
 */
async function recordMoves(
  store: { id: string; storeName: string; loopSlotCount: number | null },
  moves: SlotMove[],
): Promise<void> {
  if (moves.length === 0) return;
  await db.auditLog.create({
    data: {
      action: 'slot_loop_resized',
      target: store.id,
      meta: {
        storeName:     store.storeName,
        loopSlotCount: store.loopSlotCount,
        movedCount:    moves.length,
        campaignIds:   [...new Set(moves.map((m) => m.campaignId))],
        moves: moves.map((m) => ({
          date: m.date, from: m.from, to: m.to,
          campaignId: m.campaignId, campaignName: m.campaignName,
        })),
      },
    },
  }).catch(() => { /* the note is valuable, but never worth failing the resize over */ });
}

/**
 * Filler is a single-slot mechanism — it fills scattered single empties, so every
 * creative of a filler campaign must be a one-slot (10s) creative. Returns a
 * user-facing error, or null when the campaign is acceptable as filler.
 */
async function fillerCampaignError(campaignId: string): Promise<string | null> {
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      slotContent: { select: { id: true, durationMs: true, type: true } },
      slotPlaylist: { select: { items: {
        where: { contentId: { not: null } },
        select: { content: { select: { id: true, durationMs: true, type: true } } },
      } } },
    },
  });
  if (!campaign) return 'Campaign not found';
  const fromPlaylist: SlotCreativeMeta[] = (campaign.slotPlaylist?.items ?? [])
    .map((i) => i.content)
    .filter((c): c is NonNullable<typeof c> => c != null)
    .map((c) => ({ contentId: c.id, durationMs: c.durationMs, type: c.type }));
  const metas = fromPlaylist.length > 0 ? fromPlaylist
    : campaign.slotContent
      ? [{ contentId: campaign.slotContent.id, durationMs: campaign.slotContent.durationMs, type: campaign.slotContent.type }]
      : [];
  if (metas.length === 0) return 'That campaign has no slot creative attached yet';
  const long = metas.filter((c) => slotSpanForDuration(c.durationMs) !== 1);
  if (long.length > 0) {
    return `Filler campaigns must use 10-second creatives — ${long.length} of its ${metas.length} creative(s) run longer`;
  }
  return null;
}

type Body = {
  storeId?: string;
  loopSlotCount?: number | null;
  openDays?: number;
  hoursStart?: string;
  hoursEnd?: string;
  fillerCampaignId?: string | null;
  slotPricingTier?: string;
  defaultFillerCampaignId?: string | null;
  campaignId?: string;
  slotContentId?: string | null;
  slotPlaylistId?: string | null;
};

export async function PATCH(req: NextRequest) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  try {
    const body = await req.json() as Body;

    if (body.campaignId !== undefined) {
      // A slot playlist only counts through its direct media items (slot mode is a
      // flat 10s loop — nested items are skipped), so an all-nested playlist would
      // silently leave the campaign unplayable. Reject it at attach time instead.
      if (body.slotPlaylistId) {
        const pl = await db.playlist.findUnique({
          where:  { id: body.slotPlaylistId },
          select: { id: true, items: { where: { contentId: { not: null } }, select: { id: true }, take: 1 } },
        });
        if (!pl) return NextResponse.json({ error: 'Playlist not found' }, { status: 400 });
        if (pl.items.length === 0) {
          return NextResponse.json({ error: 'That playlist has no direct media items — slot rotation skips nested playlists, so it could never play. Add images/videos to it first.' }, { status: 400 });
        }
      }
      // Span validation on the PROPOSED creative set (body merged over current):
      // every creative must land in the same 10s-multiple length class, and video
      // durations must be known. Booking derives how many consecutive slots the
      // campaign needs from exactly this — a mixed or unknown set has no answer.
      {
        const current = await db.campaign.findUnique({
          where:  { id: body.campaignId },
          select: { slotContentId: true, slotPlaylistId: true },
        });
        if (!current) return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
        const nextContentId  = body.slotContentId  !== undefined ? body.slotContentId  : current.slotContentId;
        const nextPlaylistId = body.slotPlaylistId !== undefined ? body.slotPlaylistId : current.slotPlaylistId;
        let metas: SlotCreativeMeta[] = [];
        if (nextPlaylistId) {
          const items = await db.playlistItem.findMany({
            where:  { playlistId: nextPlaylistId, contentId: { not: null } },
            select: { content: { select: { id: true, durationMs: true, type: true } } },
          });
          metas = items
            .map((i) => i.content)
            .filter((c): c is NonNullable<typeof c> => c != null)
            .map((c) => ({ contentId: c.id, durationMs: c.durationMs, type: c.type }));
        } else if (nextContentId) {
          const c = await db.content.findUnique({
            where: { id: nextContentId }, select: { id: true, durationMs: true, type: true },
          });
          if (c) metas = [{ contentId: c.id, durationMs: c.durationMs, type: c.type }];
        }
        const spanned = uniformSlotSpan(metas);
        if ('error' in spanned) return NextResponse.json({ error: spanned.error }, { status: 400 });
      }
      const campaign = await db.campaign.update({
        where:  { id: body.campaignId },
        data:   {
          ...(body.slotContentId  !== undefined ? { slotContentId:  body.slotContentId }  : {}),
          ...(body.slotPlaylistId !== undefined ? { slotPlaylistId: body.slotPlaylistId } : {}),
        },
        select: { id: true, slotContentId: true, slotPlaylistId: true },
      });
      // Swapping a campaign's slot creative changes what the screen actually shows
      // for that brand, without touching any booking.
      await logAdminAction({
        actor, req,
        action: 'slot_settings.set_creative',
        target: campaign.id,
        meta:   { slotContentId: campaign.slotContentId, slotPlaylistId: campaign.slotPlaylistId },
      });
      // Screens showing this campaign today are playing the OLD creative until
      // their next poll — nudge them now so a creative swap is visible in minutes,
      // not hours. after(), not a floating chain: the instance can suspend at
      // response flush, and the next scheduled plan poll is 72 h out.
      after(async () => {
        try {
          const rows = await db.slotBooking.findMany({
            where:    { campaignId: campaign.id, date: new Date(`${istToday()}T00:00:00Z`) },
            select:   { storeId: true },
            distinct: ['storeId'],
          });
          const devices = await db.device.findMany({
            where:  { storeId: { in: rows.map((r) => r.storeId) } },
            select: { id: true },
          });
          await pushPlanUpdated(devices.map((d) => d.id));
        } catch { /* best-effort — the poll is the fallback */ }
      });
      return NextResponse.json({ campaign });
    }

    if (body.defaultFillerCampaignId !== undefined) {
      if (body.defaultFillerCampaignId) {
        const err = await fillerCampaignError(body.defaultFillerCampaignId);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
      const config = await db.playerConfig.upsert({
        where:  { id: 1 },
        update: { fillerCampaignId: body.defaultFillerCampaignId },
        create: { id: 1, fillerCampaignId: body.defaultFillerCampaignId },
        select: { fillerCampaignId: true },
      });
      // Fleet-wide: this is what fills every unsold position on every slot-mode store.
      await logAdminAction({
        actor, req,
        action: 'slot_settings.set_default_filler',
        target: null,
        meta:   { defaultFillerCampaignId: config.fillerCampaignId },
      });
      return NextResponse.json({ config });
    }

    if (!body.storeId) return NextResponse.json({ error: 'storeId required' }, { status: 400 });

    if (body.loopSlotCount != null && (!Number.isInteger(body.loopSlotCount) || body.loopSlotCount < 1 || body.loopSlotCount > 60)) {
      return NextResponse.json({ error: 'loopSlotCount must be 1–60 (or null to disable slot mode)' }, { status: 400 });
    }

    // Growing the loop is always safe (new positions are simply unsold). Shrinking it —
    // or leaving slot mode — strands bookings above the new count: the player skips
    // out-of-range positions, so a paid slot would silently stop playing. Pack those
    // down into free positions on the same date instead of refusing; a loop position is
    // an internal detail rather than something a brand buys, and every slot plays once
    // per loop regardless. Only a genuine oversell (more bookings than the new loop
    // holds) still blocks, because that needs a human to decide who gets dropped.
    let moves: SlotMove[] = [];
    if (body.loopSlotCount !== undefined) {
      const plan = await planSlotCompaction(body.storeId, body.loopSlotCount ?? 0);
      if (!plan.ok) {
        return NextResponse.json({
          error: body.loopSlotCount == null
            ? `Cannot turn off slot mode: ${plan.stranded} booking(s) are still sold on ${plan.date} and later. Clear them first.`
            : `Cannot shrink to ${body.loopSlotCount} slots: ${plan.date} has ${plan.stranded} booking(s) that need re-homing but only ${plan.free} free position(s). Free up slots on that date, or pick a larger number.`,
          date: plan.date, stranded: plan.stranded, free: plan.free,
        }, { status: 409 });
      }
      moves = plan.moves;
    }
    if (body.openDays !== undefined && (!Number.isInteger(body.openDays) || body.openDays < 0 || body.openDays > 127)) {
      return NextResponse.json({ error: 'openDays must be a 7-bit Mon..Sun bitmask (0–127)' }, { status: 400 });
    }
    for (const f of ['hoursStart', 'hoursEnd'] as const) {
      if (body[f] !== undefined && parseHHmm(body[f]) == null) {
        return NextResponse.json({ error: `${f} must be HH:mm` }, { status: 400 });
      }
    }
    if (body.slotPricingTier !== undefined && !isSlotTier(body.slotPricingTier)) {
      return NextResponse.json({ error: "slotPricingTier must be 'standard', 'growth' or 'flagship'" }, { status: 400 });
    }
    if (body.fillerCampaignId) {
      const err = await fillerCampaignError(body.fillerCampaignId);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }

    // Re-home the stranded bookings BEFORE narrowing the loop, so there is no window
    // where a device could fetch a plan that drops slots the brands have paid for.
    await applySlotMoves(moves);

    const store = await db.store.update({
      where: { id: body.storeId },
      data: {
        ...(body.loopSlotCount    !== undefined ? { loopSlotCount:    body.loopSlotCount }    : {}),
        ...(body.openDays         !== undefined ? { openDays:         body.openDays }         : {}),
        ...(body.hoursStart       !== undefined ? { hoursStart:       body.hoursStart }       : {}),
        ...(body.hoursEnd         !== undefined ? { hoursEnd:         body.hoursEnd }         : {}),
        ...(body.fillerCampaignId !== undefined ? { fillerCampaignId: body.fillerCampaignId } : {}),
        ...(body.slotPricingTier  !== undefined ? { slotPricingTier:  body.slotPricingTier }  : {}),
      },
      select: {
        id: true, storeName: true, loopSlotCount: true, openDays: true,
        hoursStart: true, hoursEnd: true, fillerCampaignId: true, slotPricingTier: true,
      },
    });

    // Audit note, after the resize is committed. The brand dashboard reads it back.
    void recordMoves(store, moves);

    // Separate from recordMoves above: that row is the brand-facing "your slot moved"
    // note, this one is the admin trail — who changed the store's slot config at all,
    // including turning slot mode off entirely (loopSlotCount: null).
    await logAdminAction({
      actor, req,
      action: 'slot_settings.update',
      target: store.id,
      meta: {
        loopSlotCount:    store.loopSlotCount,
        openDays:         store.openDays,
        hoursStart:       store.hoursStart,
        hoursEnd:         store.hoursEnd,
        fillerCampaignId: store.fillerCampaignId,
        reassigned:       moves.length,
      },
    });

    // A slot-mode store without a playable filler (per-store or global default with a
    // 10s creative) has an empty loop on zero-booking days; the device then falls back
    // to schedules, and a screen with none goes dark. Surface that at save time
    // instead of during a fleet incident.
    let warning: string | undefined;
    if (store.loopSlotCount != null && !(await resolveFillerCampaign(store.fillerCampaignId))) {
      warning = 'No playable filler campaign is set for this store (and no global default with a 10s slot creative). On days with zero bookings the screen falls back to its schedules — if it has none, it goes dark.';
    }

    db.device.findMany({ where: { storeId: store.id }, select: { id: true } })
      .then((devices) => pushPlanUpdated(devices.map((d) => d.id)))
      .catch(() => {});

    return NextResponse.json({
      store,
      // Surfaced so the admin sees what the resize did rather than it happening silently.
      reassigned: moves.map((m) => ({
        date: m.date, from: m.from + 1, to: m.to + 1, campaignName: m.campaignName,
      })),
      ...(warning ? { warning } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
