// Nested playlists (SMIL Master → Internal pattern).
//
// A PlaylistItem points at either Content (media) or another Playlist (nested). Playback
// semantics are SMIL <seq>-in-<seq>: a nested playlist plays ALL its items per visit, then
// the parent continues — so the fully-flattened order is the exact play order, which is what
// legacy players receive in `items` while nesting-aware players also get the `nested` tree.
//
// Write-time rules enforced here: exactly one target per item, no self-reference, no cycles,
// max depth (a Master may contain Internals, which may contain Internals — 3 levels total).

import { db } from '@/lib/db';
import { publicUrl } from '@/lib/r2';

export const MAX_NESTING_DEPTH = 3;

export type PlaylistItemInput = {
  contentId?:       string | null;
  childPlaylistId?: string | null;
  durationMs:       number;
};

/**
 * Validates a proposed item list for `playlistId` against the nesting rules.
 * Returns an error string (HTTP 400 material) or null when valid.
 */
export async function validateNesting(
  playlistId: string,
  items: PlaylistItemInput[],
): Promise<string | null> {
  for (const it of items) {
    const hasContent = !!it.contentId;
    const hasChild   = !!it.childPlaylistId;
    if (hasContent === hasChild) {
      return 'each item must set exactly one of contentId or childPlaylistId';
    }
    if (it.childPlaylistId === playlistId) {
      return 'a playlist cannot nest itself';
    }
  }

  const proposedChildren = items
    .map((it) => it.childPlaylistId)
    .filter((id): id is string => !!id);
  if (proposedChildren.length === 0) return null;

  // Adjacency of all nested edges, with this playlist's edges replaced by the proposal.
  const edges = await db.playlistItem.findMany({
    where:  { childPlaylistId: { not: null } },
    select: { playlistId: true, childPlaylistId: true },
  });
  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (e.playlistId === playlistId) continue;
    const list = children.get(e.playlistId) ?? [];
    list.push(e.childPlaylistId!);
    children.set(e.playlistId, list);
  }
  children.set(playlistId, proposedChildren);

  // Cycles first, and without a depth limit. A cycle and an over-deep chain are
  // different problems with different fixes, and the depth cap would otherwise
  // fire first on a short loop — telling an operator to shorten a chain when
  // what they actually built was a loop. Any cycle a new edge can create passes
  // through the edited playlist, so reaching it from here is sufficient.
  {
    const seen   = new Set<string>();
    const onPath = new Set<string>();
    let found = false;
    const findCycle = (id: string) => {
      if (found) return;
      if (onPath.has(id)) { found = true; return; }
      if (seen.has(id)) return;      // already cleared by another branch
      seen.add(id);
      onPath.add(id);
      for (const child of children.get(id) ?? []) findCycle(child);
      onPath.delete(id);
    };
    findCycle(playlistId);
    if (found) return 'nesting would create a cycle';
  }

  // How deep the edited playlist already sits BELOW some other playlist. Editing
  // P only changes P's outgoing edges, so who points at P is unaffected by the
  // proposal, but it decides how much depth budget is left underneath.
  //
  // Without this the walk always started at 1, measuring the subtree in
  // isolation. Build A→B, then edit B to hold C, then C to hold D: each edit
  // looks two levels deep and passes, while the real chain A→B→C→D is four.
  // Nothing rejected it and nothing reported it — resolvePlaylistTree caps at
  // the same MAX_NESTING_DEPTH, so D was simply dropped from the plan and the
  // media an operator added never played.
  const parents = new Map<string, string[]>();
  for (const [parent, kids] of children) {
    for (const kid of kids) {
      const list = parents.get(kid) ?? [];
      list.push(parent);
      parents.set(kid, list);
    }
  }

  // Longest chain ending at `id`, counting `id` itself. Returns 1 on revisit so
  // a cycle already in the data terminates here rather than hanging; a cycle the
  // proposal introduces is reported by the walk below.
  const depthMemo = new Map<string, number>();
  const depthAbove = (id: string, visiting: Set<string>): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 1;
    visiting.add(id);
    let best = 1;
    for (const p of parents.get(id) ?? []) best = Math.max(best, depthAbove(p, visiting) + 1);
    visiting.delete(id);
    depthMemo.set(id, best);
    return best;
  };
  const startDepth = depthAbove(playlistId, new Set());

  // Depth from the edited playlist's true position. The graph reachable from
  // here is known acyclic by the pass above, so this terminates without a
  // path set.
  let tooDeep = false;
  const walk = (id: string, depth: number) => {
    if (tooDeep) return;
    if (depth > MAX_NESTING_DEPTH) { tooDeep = true; return; }
    for (const child of children.get(id) ?? []) walk(child, depth + 1);
  };
  walk(playlistId, startDepth);

  if (tooDeep) return `nesting exceeds the maximum depth of ${MAX_NESTING_DEPTH} levels`;
  return null;
}

// ── Plan resolution ──────────────────────────────────────────────────────────

/** Media item in the exact wire shape /api/device/plan has always emitted. */
export type PlanMediaItem = {
  contentId:  string;
  objectKey:  string;
  url:        string;
  md5:        string;
  type:       string;
  durationMs: number;
  order:      number;
  hevcUrl:    string | undefined;
  hevcMd5:    string | undefined;
  // Intrinsic pixel size when known (images measured at upload, videos filled by the
  // transcode callback) — lets players pick scale modes without probing the media.
  width:      number | undefined;
  height:     number | undefined;
};

export type PlanNestedNode =
  | ({ kind: 'content' } & PlanMediaItem)
  | { kind: 'playlist'; playlistId: string; name: string; items: PlanNestedNode[] };

const PLAN_ITEM_SELECT = {
  durationMs:      true,
  order:           true,
  childPlaylistId: true,
  content: {
    select: {
      id: true, objectKey: true, md5: true, type: true,
      durationMs: true, hevcObjectKey: true, hevcMd5: true,
      originalObjectKey: true, originalMd5: true,
      width: true, height: true,
    },
  },
} as const;

type PlanItemRow = {
  durationMs:      number;
  order:           number;
  childPlaylistId: string | null;
  content: {
    id: string; objectKey: string; md5: string; type: string;
    durationMs: number | null; hevcObjectKey: string | null; hevcMd5: string | null;
    originalObjectKey: string | null; originalMd5: string | null;
    width: number | null; height: number | null;
  } | null;
};

/**
 * Rendition choice for one content row. objectKey holds the safe H.264 rendition once
 * transcoded (the transcode callback overwrites it, as the pipeline always has — which
 * keeps a Vercel rollback to pre-rendition code fleet-safe); original* preserves the
 * full-quality upload. Devices default to objectKey (budget SoCs can't decode hot
 * originals — the reason the transcode pipeline exists); Device.playsOriginal opts a
 * capable panel into the preserved original when one exists.
 */
export function pickRendition(
  c: { objectKey: string; md5: string; originalObjectKey: string | null; originalMd5: string | null },
  safeRendition: boolean,
): { objectKey: string; md5: string } {
  if (!safeRendition && c.originalObjectKey && c.originalMd5) {
    return { objectKey: c.originalObjectKey, md5: c.originalMd5 };
  }
  return { objectKey: c.objectKey, md5: c.md5 };
}

function toMediaItem(row: PlanItemRow, order: number, safeRendition: boolean): PlanMediaItem | null {
  const c = row.content;
  if (!c) return null;
  const chosen = pickRendition(c, safeRendition);
  return {
    contentId:  c.id,
    objectKey:  chosen.objectKey,
    url:        publicUrl(chosen.objectKey),
    md5:        chosen.md5,
    type:       c.type,
    durationMs: row.durationMs,
    order,
    hevcUrl:    c.hevcObjectKey ? publicUrl(c.hevcObjectKey) : undefined,
    hevcMd5:    c.hevcMd5 ?? undefined,
    width:      c.width ?? undefined,
    height:     c.height ?? undefined,
  };
}

/**
 * Resolves a playlist into (a) the nested node tree and (b) the fully-flattened media list
 * in play order. Depth-capped at MAX_NESTING_DEPTH and cycle-safe regardless of what is in
 * the DB (write-time validation should prevent both, but a plan fetch must never 500 or
 * loop on bad data). `flat` item `order` is the position in the flattened sequence, so
 * legacy players play the identical order the nesting-aware sequencer produces.
 */
export async function resolvePlaylistTree(
  playlistId: string,
  opts?: { safeRendition?: boolean },
): Promise<{
  nested: PlanNestedNode[];
  flat:   PlanMediaItem[];
}> {
  // Default to the safe rendition: every caller that doesn't say otherwise is
  // building a manifest some budget panel may end up playing.
  const safeRendition = opts?.safeRendition ?? true;
  const flat: PlanMediaItem[] = [];

  const build = async (id: string, depth: number, path: Set<string>): Promise<PlanNestedNode[]> => {
    if (depth > MAX_NESTING_DEPTH || path.has(id)) return [];
    const playlist = await db.playlist.findUnique({
      where:  { id },
      select: {
        name:  true,
        items: { select: PLAN_ITEM_SELECT, orderBy: { order: 'asc' } },
      },
    });
    if (!playlist) return [];

    const nodes: PlanNestedNode[] = [];
    for (const row of playlist.items as PlanItemRow[]) {
      if (row.childPlaylistId) {
        const child = await db.playlist.findUnique({
          where: { id: row.childPlaylistId }, select: { name: true },
        });
        const childNodes = await build(
          row.childPlaylistId, depth + 1, new Set([...path, id]),
        );
        if (childNodes.length > 0) {
          nodes.push({
            kind: 'playlist',
            playlistId: row.childPlaylistId,
            name: child?.name ?? '',
            items: childNodes,
          });
        }
      } else {
        const item = toMediaItem(row, flat.length, safeRendition);
        if (item) {
          nodes.push({ kind: 'content', ...item });
          flat.push(item);
        }
      }
    }
    return nodes;
  };

  const nested = await build(playlistId, 1, new Set());
  return { nested, flat };
}
