// PATCH /api/playlists/[id]  — replace items (full replace, ordered)
// DELETE /api/playlists/[id] — delete playlist
// Auth: admin-password header

import { NextRequest, NextResponse, after } from 'next/server';
import { db } from '@/lib/db';
import { publicUrl } from '@/lib/r2';
import { istToday } from '@/lib/slots';
import { pushPlanUpdated, resolveScheduleDeviceIds } from '@/lib/fcm';
import { validateNesting, type PlaylistItemInput } from '@/lib/playlist-nesting';
import { requireAdmin, adminUnauthorized } from '@/lib/admin-guard';
import { logAdminAction } from '@/lib/admin-audit';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePlaylist(pl: any) {
  return {
    ...pl,
    createdAt: (pl.createdAt as Date).toISOString(),
    items: (pl.items ?? []).map((item: any) => ({
      ...item,
      content: item.content ? {
        id:         item.content.id,
        name:       item.content.name,
        type:       (item.content.type as string).toLowerCase() as 'image' | 'video',
        objectKey:  item.content.objectKey,
        url:        publicUrl(item.content.objectKey as string),
        md5:        item.content.md5,
        sizeBytes:  Number(item.content.sizeBytes),
        durationMs: item.content.durationMs ?? undefined,
        width:      item.content.width ?? undefined,
        height:     item.content.height ?? undefined,
        createdAt:  (item.content.uploadedAt as Date).toISOString(),
      } : null,
      childPlaylist: item.childPlaylist ?? null,
    })),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    const { name, items, transition } = await req.json() as {
      name?:       string;
      items?:      PlaylistItemInput[];
      transition?: 'NONE' | 'FADE' | 'SLIDE';
    };

    if (items !== undefined) {
      const nestingError = await validateNesting(id, items);
      if (nestingError) return NextResponse.json({ error: nestingError }, { status: 400 });
      // Slot rotation reads only DIRECT media items (slotCreativeIds in lib/slots.ts).
      // Attaching an all-nested playlist is hard-rejected by /api/slots/settings, so
      // editing one INTO that state must fail the same way — otherwise a sold
      // campaign's positions silently flip to bonus plays for other brands.
      if (items.filter((i) => i.contentId).length === 0) {
        const slotCampaigns = await db.campaign.findMany({
          where: { slotPlaylistId: id }, select: { name: true },
        });
        if (slotCampaigns.length > 0) {
          return NextResponse.json({
            error: `This playlist is the slot creative for ${slotCampaigns.map((c) => c.name).join(', ')} — with no direct media items it could never play in a slot loop. Keep at least one image/video in it, or detach it from the campaign first.`,
          }, { status: 400 });
        }
      }
    }

    await db.$transaction(async (tx) => {
      if (name?.trim() || transition) {
        await tx.playlist.update({
          where: { id },
          data: {
            ...(name?.trim() ? { name: name.trim() } : {}),
            ...(transition   ? { transition }         : {}),
          },
        });
      }
      if (items !== undefined) {
        await tx.playlistItem.deleteMany({ where: { playlistId: id } });
        if (items.length) {
          await tx.playlistItem.createMany({
            data: items.map((item, idx) => ({
              playlistId:      id,
              contentId:       item.contentId ?? null,
              childPlaylistId: item.childPlaylistId ?? null,
              durationMs:      item.durationMs,
              order:           idx,
            })),
          });
        }
      }
    });

    // A PATCH here is a full replace of what a playlist plays, so it changes
    // every screen scheduled against it (and, via nesting, its parents too).
    // Item count and the rename are enough to reconstruct what happened; the
    // item array itself is request-body-sized and stays out of the trail.
    await logAdminAction({
      actor, req,
      action: 'playlist.update',
      target: id,
      meta: {
        name:       name?.trim(),
        itemCount:  items?.length,
        transition,
      },
    });

    const CONTENT_SELECT = {
      id: true, name: true, type: true, objectKey: true,
      md5: true, sizeBytes: true, durationMs: true, uploadedAt: true,
      width: true, height: true,
    };
    const updated = await db.playlist.findUnique({
      where:   { id },
      include: {
        items: {
          include: {
            content:       { select: CONTENT_SELECT },
            childPlaylist: { select: { id: true, name: true } },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    // Push plan_updated to all devices scheduled via this playlist — including
    // schedules that reach it through NESTING (best-effort, non-blocking). A child
    // playlist is flattened into its parents at plan time, so editing it changes
    // plans served for schedules that only reference a parent; matching on the
    // edited id alone missed those entirely. Walk up the parent chain (max nesting
    // depth 3, cycles rejected at write time) and match schedules on the whole set.
    if (items !== undefined || transition !== undefined) {
      // after(), not a floating promise: the instance can suspend the moment the
      // response flushes, and the next scheduled plan poll is 72 h out — a dropped
      // push is a creative swap the screens never hear about.
      after(async () => {
        try {
          const affected = new Set<string>([id]);
          let frontier = [id];
          for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
            const parents = await db.playlistItem.findMany({
              where:  { childPlaylistId: { in: frontier } },
              select: { playlistId: true },
            });
            frontier = parents.map((p) => p.playlistId).filter((p) => !affected.has(p));
            frontier.forEach((p) => affected.add(p));
          }
          const schedules = await db.schedule.findMany({
            where: { playlistId: { in: Array.from(affected) } },
            select: { deviceIds: true, groupName: true, storeIds: true, cityFilter: true },
          });
          const idSet = new Set<string>();
          for (const s of schedules) {
            const ids = await resolveScheduleDeviceIds({
              deviceIds:  s.deviceIds,
              groupName:  s.groupName,
              storeIds:   (s as { storeIds?: string[] }).storeIds,
              cityFilter: (s as { cityFilter?: string | null }).cityFilter,
            });
            for (const did of ids) idSet.add(did);
          }
          // Slot mode consumes this playlist too: campaigns rotating it as their
          // slot creative change what their booked stores air TODAY. Direct
          // attachment only — nesting never reaches slot rotation (flat loop).
          const slotCampaigns = await db.campaign.findMany({
            where: { slotPlaylistId: id }, select: { id: true },
          });
          if (slotCampaigns.length > 0) {
            const bookings = await db.slotBooking.findMany({
              where: {
                campaignId: { in: slotCampaigns.map((c) => c.id) },
                date:       new Date(`${istToday()}T00:00:00Z`),
              },
              select:   { storeId: true },
              distinct: ['storeId'],
            });
            if (bookings.length > 0) {
              const devices = await db.device.findMany({
                where:  { storeId: { in: bookings.map((b) => b.storeId) } },
                select: { id: true },
              });
              for (const d of devices) idSet.add(d.id);
            }
          }
          await pushPlanUpdated(Array.from(idSet));
        } catch { /* best-effort — the poll is the fallback */ }
      });
    }

    return NextResponse.json({ playlist: updated ? normalizePlaylist(updated) : null });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireAdmin(req);
  if (!actor) return adminUnauthorized();
  const { id } = await params;
  try {
    // Capture the slot-mode blast radius BEFORE deleting: the FK SET-NULLs
    // Campaign.slotPlaylistId, so today's loop at those campaigns' booked stores
    // silently degrades to the single creative (or filler) the moment we delete.
    const slotCampaigns = await db.campaign.findMany({
      where: { slotPlaylistId: id }, select: { id: true },
    });
    // delete() returns the removed row — the last point at which the playlist's
    // name still exists to be recorded.
    const playlist = await db.playlist.delete({ where: { id } });
    await logAdminAction({
      actor, req,
      action: 'playlist.delete',
      target: id,
      meta:   { name: playlist.name },
    });
    if (slotCampaigns.length > 0) {
      after(async () => {
        try {
          const bookings = await db.slotBooking.findMany({
            where: {
              campaignId: { in: slotCampaigns.map((c) => c.id) },
              date:       new Date(`${istToday()}T00:00:00Z`),
            },
            select:   { storeId: true },
            distinct: ['storeId'],
          });
          const devices = await db.device.findMany({
            where:  { storeId: { in: bookings.map((b) => b.storeId) } },
            select: { id: true },
          });
          await pushPlanUpdated(devices.map((d) => d.id));
        } catch { /* best-effort — the poll is the fallback */ }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
