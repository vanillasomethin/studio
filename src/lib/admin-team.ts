// The ALIVE admin roster. Seeded into AdminUser by
// `npm run admin:seed`; each person then sets their own password from the
// invite link, so no password is ever stored in this file or in git.

export type AdminTeam = 'operations' | 'founder' | 'tech';

export const ADMIN_TEAM_LABEL: Record<AdminTeam, string> = {
  operations: 'Operations',
  founder:    'Founder',
  tech:       'Tech & Hardware',
};

export const ADMIN_ROSTER: { email: string; name: string; team: AdminTeam }[] = [
  { email: 'arya@wearealive.in',          name: 'Arya',          team: 'operations' },
  { email: 'hisham.khalid@wearealive.in', name: 'Hisham Khalid', team: 'founder'    },
  { email: 'zeba@wearealive.in',          name: 'Zeba',          team: 'founder'    },
  { email: 'deepak@wearealive.in',        name: 'Deepak',        team: 'tech'       },
];
