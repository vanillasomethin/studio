'use client';

// Admin → Team. One place for "who has access", "who is logged in right now",
// and "who changed what".
//
// The three panels are deliberately on one screen rather than sub-tabs: the
// questions they answer are usually asked together ("Arya left — does she still
// have a session, and what did she touch?"), and splitting them would make that
// a three-click investigation.

import { useState, useEffect, useCallback } from 'react';
import {
  Loader2, UserPlus, ShieldCheck, ShieldAlert, LogOut, RefreshCw,
  Clock, Copy, Check, AlertTriangle, KeyRound, ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const authHeaders = () => ({
  'admin-password': sessionStorage.getItem('alive_admin_pw') ?? '',
  'Content-Type': 'application/json',
});

type Member = {
  id: string; email: string | null; name: string | null; role: 'ADMIN' | 'OPS';
  status: 'invited' | 'setup' | 'active';
  mfaEnrolled: boolean; hasBackupCodes: boolean;
  createdAt: string; lastLogin: string | null; liveSessions: number;
};
type Session = {
  id: string; userId: string; email: string | null;
  createdAt: string; lastSeenAt: string; active: boolean;
  ip: string | null; userAgent: string | null; isYou: boolean;
};
type Invite = {
  id: string; email: string; role: string; expiresAt: string; createdAt: string;
};
type Entry = {
  id: string; action: string; target: string | null; ip: string | null;
  createdAt: string; actor: string | null; attributable: boolean;
  meta: Record<string, unknown>;
};

function ago(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Enough of a UA string to recognise your own browser, without the noise. */
function device(ua: string | null): string {
  if (!ua) return 'unknown device';
  const os =
    /Android/i.test(ua) ? 'Android' :
    /iPhone|iPad/i.test(ua) ? 'iOS' :
    /Mac OS X/i.test(ua) ? 'macOS' :
    /Windows/i.test(ua) ? 'Windows' :
    /Linux/i.test(ua) ? 'Linux' : 'unknown OS';
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Safari\//.test(ua) ? 'Safari' :
    /Firefox\//.test(ua) ? 'Firefox' : 'browser';
  return `${browser} on ${os}`;
}

const STATUS: Record<Member['status'], { label: string; cls: string; hint: string }> = {
  invited: { label: 'Invited',  cls: 'bg-amber-50 text-amber-800 border-amber-200',
             hint: 'Invitation sent — no password set yet.' },
  setup:   { label: '2FA pending', cls: 'bg-amber-50 text-amber-800 border-amber-200',
             hint: 'Password set, but two-factor not enrolled — cannot use the console yet.' },
  active:  { label: 'Active',   cls: 'bg-green-50 text-green-700 border-green-200',
             hint: 'Password and two-factor set up.' },
};

export default function TeamTab() {
  const [members,  setMembers]  = useState<Member[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [invites,  setInvites]  = useState<Invite[]>([]);
  const [entries,  setEntries]  = useState<Entry[]>([]);
  const [cursor,   setCursor]   = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // Invite form
  const [email, setEmail]   = useState('');
  const [role,  setRole]    = useState<'ADMIN' | 'OPS'>('ADMIN');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] =
    useState<{ email: string; link?: string; warning?: string; replaces?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const [filterActor, setFilterActor] = useState<string>('');
  // Collapsed by default: the feed is the tallest panel on the page and is
  // reference material, not something monitored constantly. The header still
  // shows the newest entry, so a glance answers "anything happening?" without
  // expanding.
  const [activityOpen, setActivityOpen] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/team', { headers: authHeaders() });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to load team');
      const b = await res.json() as { members: Member[]; sessions: Session[]; invites: Invite[] };
      // Coerce to arrays: a 200 whose body is an error envelope or a partial
      // response (missing a key) would otherwise put an object into array state,
      // and the unconditional .filter/.map/.length below crash the whole admin.
      setMembers(Array.isArray(b.members) ? b.members : []);
      setSessions(Array.isArray(b.sessions) ? b.sessions : []);
      setInvites(Array.isArray(b.invites) ? b.invites : []);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);

  const loadActivity = useCallback(async (opts: { append?: boolean; actorId?: string } = {}) => {
    const qs = new URLSearchParams({ limit: '50' });
    if (opts.actorId) qs.set('actorId', opts.actorId);
    if (opts.append && cursor) qs.set('cursor', cursor);
    try {
      const res = await fetch(`/api/admin/team/activity?${qs}`, { headers: authHeaders() });
      if (!res.ok) return;
      const b = await res.json() as { entries: Entry[]; nextCursor: string | null };
      const rows = Array.isArray(b.entries) ? b.entries : [];
      setEntries((prev) => opts.append ? [...prev, ...rows] : rows);
      setCursor(b.nextCursor ?? null);
    } catch { /* feed is non-critical */ }
  }, [cursor]);

  useEffect(() => {
    (async () => { setLoading(true); await Promise.all([loadTeam(), loadActivity()]); setLoading(false); })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invite = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true); setError(null); setInviteResult(null); setCopied(false);
    try {
      const res = await fetch('/api/admin/team/invite', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ email, role }),
      });
      const b = await res.json() as {
        ok?: boolean; error?: string; email?: string;
        emailSent?: boolean; setupLink?: string; warning?: string; replacesExistingPassword?: boolean;
      };
      if (!res.ok || !b.ok) throw new Error(b.error ?? 'Could not send the invitation.');
      setInviteResult({
        email: b.email!, link: b.setupLink, warning: b.warning, replaces: b.replacesExistingPassword,
      });
      setEmail('');
      await loadTeam();
    } catch (err) { setError((err as Error).message); }
    finally { setInviting(false); }
  }, [email, role, loadTeam]);

  const revoke = useCallback(async (s: Session) => {
    const who = s.isYou ? 'your own session (you will be signed out)' : s.email ?? 'this session';
    if (!confirm(`Log out ${who}?`)) return;
    try {
      const res = await fetch('/api/admin/team/sessions/revoke', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ sid: s.id }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Could not revoke');
      await Promise.all([loadTeam(), loadActivity()]);
    } catch (e) { setError((e as Error).message); }
  }, [loadTeam, loadActivity]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-gray-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading team…
      </div>
    );
  }

  const liveSessions = sessions.filter((s) => s.active);

  return (
    <div className="space-y-8">
      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> <span>{error}</span>
        </div>
      )}

      {/* ── Invite ─────────────────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-black tracking-tight">
          <UserPlus className="h-4 w-4 text-red-700" /> Invite someone
        </h3>
        <p className="mb-4 text-xs text-gray-600">
          They receive a one-time link and choose their own password — you never see it.
          Two-factor setup is required before they can use the console.
        </p>
        <form onSubmit={invite} className="flex flex-wrap items-center gap-2">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="arya@wearealive.in"
            className="min-w-[240px] flex-1 rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-red-700"
          />
          <select
            value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'OPS')}
            className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:border-red-700"
          >
            <option value="ADMIN">Admin</option>
            <option value="OPS">Ops</option>
          </select>
          <button
            type="submit" disabled={inviting}
            className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {inviting && <Loader2 className="h-4 w-4 animate-spin" />} Send invite
          </button>
        </form>

        {inviteResult && (
          <div className="mt-4 space-y-2 rounded-md border border-border bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-800">Invitation created for {inviteResult.email}</p>
            {inviteResult.replaces && (
              <p className="text-amber-800">
                This person already had a password. Accepting the invite will replace it and
                sign them out everywhere. Their two-factor setup is left untouched.
              </p>
            )}
            {inviteResult.warning && <p className="text-amber-800">{inviteResult.warning}</p>}
            {inviteResult.link && (
              <div className="flex items-center gap-2">
                <code className="flex-1 overflow-x-auto whitespace-nowrap rounded bg-white px-2 py-1 text-xs">
                  {inviteResult.link}
                </code>
                <button
                  onClick={() => { navigator.clipboard.writeText(inviteResult.link!); setCopied(true); }}
                  className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs hover:bg-white"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── People ─────────────────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black tracking-tight">People with console access</h3>
          <button onClick={loadTeam} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-semibold">Person</th>
                <th className="px-4 py-2 font-semibold">Role</th>
                <th className="px-4 py-2 font-semibold">Status</th>
                <th className="px-4 py-2 font-semibold">2FA</th>
                <th className="px-4 py-2 font-semibold">Last sign-in</th>
                <th className="px-4 py-2 font-semibold">Sessions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No admin accounts yet — invite someone above.
                </td></tr>
              )}
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => { setFilterActor(m.id); setCursor(null); setActivityOpen(true); loadActivity({ actorId: m.id }); }}
                      className="text-left font-medium text-gray-900 hover:text-red-700 hover:underline"
                      title="Show only this person's activity"
                    >
                      {m.email ?? m.name ?? m.id}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-gray-700">{m.role}</td>
                  <td className="px-4 py-2.5">
                    <span title={STATUS[m.status].hint}
                          className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${STATUS[m.status].cls}`}>
                      {STATUS[m.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    {m.mfaEnrolled
                      ? <span className="inline-flex items-center gap-1 text-green-700">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {m.hasBackupCodes ? 'On' : 'On (no backup codes)'}
                        </span>
                      : <span className="inline-flex items-center gap-1 text-amber-700">
                          <ShieldAlert className="h-3.5 w-3.5" /> Not set up
                        </span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{ago(m.lastLogin)}</td>
                  <td className="px-4 py-2.5 text-gray-600">{m.liveSessions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invites.length > 0 && (
          <p className="mt-2 text-xs text-gray-600">
            {invites.length} invitation{invites.length > 1 ? 's' : ''} outstanding:{' '}
            {invites.map((i) => i.email).join(', ')}
          </p>
        )}
      </section>

      {/* ── Sessions ───────────────────────────────────────────────────────── */}
      <section>
        <h3 className="mb-1 text-sm font-black tracking-tight">Signed in right now</h3>
        <p className="mb-3 text-xs text-gray-600">
          {liveSessions.length} active in the last 15 minutes · {sessions.length} session
          {sessions.length === 1 ? '' : 's'} not yet ended.
        </p>
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {sessions.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Nobody is signed in.</p>
          )}
          {sessions.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {s.email ?? s.userId}
                  {s.isYou && <Badge variant="secondary" className="ml-2 align-middle">You</Badge>}
                  {!s.active && <span className="ml-2 text-xs font-normal text-gray-500">(idle)</span>}
                </p>
                <p className="truncate text-xs text-gray-600">
                  {device(s.userAgent)} · {s.ip ?? 'no IP'} ·{' '}
                  <Clock className="inline h-3 w-3" /> seen {ago(s.lastSeenAt)} · in since {ago(s.createdAt)}
                </p>
              </div>
              <button
                onClick={() => revoke(s)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                <LogOut className="h-3.5 w-3.5" /> Log out
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Activity (collapsed by default — header click expands) ─────────── */}
      <section>
        <div className="overflow-hidden rounded-lg border border-border bg-white">
          <button
            type="button"
            onClick={() => setActivityOpen((v) => !v)}
            aria-expanded={activityOpen}
            className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-gray-50"
          >
            <h3 className="text-sm font-black tracking-tight">Activity</h3>
            <span className="text-xs text-gray-500">
              {entries.length === 0
                ? 'nothing recorded yet'
                : `${entries.length}${cursor ? '+' : ''} entries`}
            </span>
            {/* Newest entry inline, so the collapsed row still answers
                "anything happening?" at a glance. */}
            {!activityOpen && entries[0] && (
              <span className="hidden min-w-0 flex-1 truncate text-xs text-gray-500 sm:block">
                latest: <span className="text-gray-700">{entries[0].attributable ? entries[0].actor ?? 'unknown' : 'shared password'}</span>
                {' '}<code className="rounded bg-gray-100 px-1 text-[11px]">{entries[0].action}</code>
                {' '}{ago(entries[0].createdAt)}
              </span>
            )}
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-gray-500 transition-transform ${activityOpen ? 'rotate-180' : ''}`} />
          </button>

          {activityOpen && (
            <>
              {filterActor && (
                <div className="flex items-center justify-between border-t border-border bg-gray-50 px-4 py-1.5">
                  <span className="text-xs text-gray-600">Showing one person&apos;s activity</span>
                  <button
                    onClick={() => { setFilterActor(''); setCursor(null); loadActivity(); }}
                    className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <div className="divide-y divide-border border-t border-border">
                {entries.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-gray-500">
                    Nothing recorded yet.
                  </p>
                )}
                {entries.map((e) => (
                  <div key={e.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-4 py-2.5 text-sm">
                    <span className="font-medium text-gray-900">
                      {e.attributable ? e.actor ?? 'unknown' : (
                        <span className="inline-flex items-center gap-1 text-amber-800" title="Performed with the shared admin password — cannot be attributed to a person">
                          <KeyRound className="h-3.5 w-3.5" /> shared password
                        </span>
                      )}
                    </span>
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-800">{e.action}</code>
                    {e.target && <span className="truncate text-gray-600">{e.target}</span>}
                    <span className="ml-auto shrink-0 text-xs text-gray-500" title={new Date(e.createdAt).toLocaleString()}>
                      {ago(e.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
              {cursor && (
                <div className="border-t border-border px-4 py-2">
                  <button
                    onClick={() => loadActivity({ append: true, actorId: filterActor || undefined })}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold hover:bg-gray-50"
                  >
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
