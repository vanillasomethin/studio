'use client';

import { useState, type ComponentType } from 'react';
import dynamic from 'next/dynamic';
import { CalendarClock, ListVideo, Calendar, type LucideProps } from 'lucide-react';
import type { Schedule } from '@/lib/backend-api';

const PlaylistsTab     = dynamic(() => import('./playlists-tab'),     { ssr: false });
const SchedulesTab     = dynamic(() => import('./schedules-tab'),     { ssr: false });
const ScheduleCalendar = dynamic(() => import('./schedule-calendar'), { ssr: false });

type ProgramTab = 'playlists' | 'schedules' | 'calendar';

const TABS: { id: ProgramTab; label: string; Icon: ComponentType<LucideProps> }[] = [
  { id: 'playlists', label: 'Playlists',  Icon: ListVideo    },
  { id: 'schedules', label: 'Schedules',  Icon: CalendarClock },
  { id: 'calendar',  label: 'Calendar',   Icon: Calendar     },
];

export default function ProgrammingTab() {
  const [view, setView] = useState<ProgramTab>('playlists');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-0 border-b border-border">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              view === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {view === 'playlists' && <PlaylistsTab />}
      {view === 'schedules' && <SchedulesTab />}
      {view === 'calendar'  && <ScheduleCalendar schedules={[] as Schedule[]} />}
    </div>
  );
}
