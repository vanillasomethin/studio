'use client';

import type { Schedule } from '@/lib/backend-api';

const DAYS  = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0–23

const PALETTE = [
  'bg-blue-500/20 border-blue-500/40 text-blue-700',
  'bg-green-500/20 border-green-500/40 text-green-700',
  'bg-purple-500/20 border-purple-500/40 text-purple-700',
  'bg-orange-500/20 border-orange-500/40 text-orange-700',
  'bg-pink-500/20 border-pink-500/40 text-pink-700',
  'bg-teal-500/20 border-teal-500/40 text-teal-700',
];

function parseHHMM(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h + (m ?? 0) / 60;
}

function dayOfWeekIndex(d: Date): number {
  return (d.getDay() + 6) % 7; // Mon=0 … Sun=6
}

function getWeekStart(): Date {
  const now = new Date();
  const day = dayOfWeekIndex(now);
  const mon = new Date(now); mon.setDate(now.getDate() - day); mon.setHours(0, 0, 0, 0);
  return mon;
}

type Props = { schedules: Schedule[] };

export default function ScheduleCalendar({ schedules }: Props) {
  const weekStart = getWeekStart();
  const now       = new Date();

  const colorMap = new Map<string, string>();
  schedules.forEach((s, i) => colorMap.set(s.id, PALETTE[i % PALETTE.length]));

  // For each schedule, compute which hours on which days it's active this week
  function isActiveOnDay(s: Schedule, dayIdx: number): boolean {
    const dayDate = new Date(weekStart);
    dayDate.setDate(weekStart.getDate() + dayIdx);

    const start = new Date(s.startAt);
    const end   = new Date(s.endAt);

    if (dayDate < start || dayDate > end) {
      // Check if the day falls within the schedule window
      const dayDateEnd = new Date(dayDate); dayDateEnd.setHours(23, 59, 59);
      if (end < dayDate || start > dayDateEnd) return false;
    }

    if (s.recurrence === 'once') {
      const sDay = new Date(s.startAt); sDay.setHours(0, 0, 0, 0);
      return sDay.getTime() === dayDate.getTime();
    }
    if (s.recurrence === 'weekly') {
      return dayOfWeekIndex(new Date(s.startAt)) === dayIdx;
    }
    // daily — active every day within window
    return start <= dayDate && dayDate <= end;
  }

  function daypartStart(s: Schedule): number { return s.dailyStart ? parseHHMM(s.dailyStart) : 0; }
  function daypartEnd(s: Schedule):   number { return s.dailyEnd   ? parseHHMM(s.dailyEnd)   : 24; }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* Day headers */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border">
          <div />
          {DAYS.map((d, i) => {
            const date = new Date(weekStart); date.setDate(weekStart.getDate() + i);
            const isToday = date.toDateString() === now.toDateString();
            return (
              <div key={d} className={`py-2 text-center text-[11px] font-bold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                {d}
                <span className={`ml-1 ${isToday ? 'text-primary' : 'text-muted-foreground/60'}`}>{date.getDate()}</span>
              </div>
            );
          })}
        </div>

        {/* Hour rows */}
        <div className="relative">
          {HOURS.map((h) => (
            <div key={h} className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-border/40" style={{ height: 28 }}>
              <div className="text-[9px] text-muted-foreground/50 pr-2 pt-0.5 text-right">
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>
              {DAYS.map((_, dayIdx) => {
                const activeSched = schedules.filter((s) => {
                  if (!isActiveOnDay(s, dayIdx)) return false;
                  const ds = daypartStart(s);
                  const de = daypartEnd(s);
                  return h >= ds && h < de;
                });
                return (
                  <div key={dayIdx} className="relative border-l border-border/20">
                    {activeSched.map((s) => (
                      <div
                        key={s.id}
                        title={`${s.name}${s.dailyStart ? ` · ${s.dailyStart}–${s.dailyEnd}` : ' · All day'}`}
                        className={`absolute inset-x-0.5 inset-y-0 rounded-sm border text-[8px] font-bold flex items-center px-0.5 truncate ${colorMap.get(s.id)}`}
                      >
                        {activeSched.length === 1 ? s.name : ''}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        {schedules.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-border">
            {schedules.map((s) => (
              <span key={s.id} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${colorMap.get(s.id)}`}>
                {s.name}
                {s.dailyStart && <span className="opacity-70">· {s.dailyStart}–{s.dailyEnd}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
