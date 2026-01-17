'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DailyEntry } from '@/lib/diary-types';

interface CalendarDay {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  entry?: DailyEntry;
}

export default function DiaryCalendarPage() {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    fetchEntries();
  }, [year, month]);

  async function fetchEntries() {
    try {
      setLoading(true);
      // Fetch entries for the current month
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      const res = await fetch(`/api/diary?limit=31`);
      const data = await res.json();
      
      if (res.ok) {
        // Filter entries for this month
        const monthEntries = (data.entries || []).filter((e: DailyEntry) => 
          e.date >= startDate && e.date <= endDate
        );
        setEntries(monthEntries);
      }
    } catch (err) {
      console.error('Failed to fetch entries:', err);
    } finally {
      setLoading(false);
    }
  }

  function buildCalendar(): CalendarDay[] {
    const days: CalendarDay[] = [];
    const today = new Date().toISOString().split('T')[0];
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay(); // 0 = Sunday
    
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    const totalDays = lastDay.getDate();
    
    // Previous month days to fill the start
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDay - 1; i >= 0; i--) {
      const day = prevMonthLastDay - i;
      const date = new Date(year, month - 1, day).toISOString().split('T')[0];
      days.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: false,
        isToday: date === today,
      });
    }
    
    // Current month days
    for (let day = 1; day <= totalDays; day++) {
      const date = new Date(year, month, day).toISOString().split('T')[0];
      const entry = entries.find(e => e.date === date);
      days.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: true,
        isToday: date === today,
        entry,
      });
    }
    
    // Next month days to fill the end (complete 6 rows)
    const remaining = 42 - days.length;
    for (let day = 1; day <= remaining; day++) {
      const date = new Date(year, month + 1, day).toISOString().split('T')[0];
      days.push({
        date,
        dayOfMonth: day,
        isCurrentMonth: false,
        isToday: date === today,
      });
    }
    
    return days;
  }

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const calendar = buildCalendar();

  // Mood colors
  const moodColors: Record<number, string> = {
    1: 'bg-red-500/30 border-red-500/50',
    2: 'bg-orange-500/30 border-orange-500/50',
    3: 'bg-yellow-500/30 border-yellow-500/50',
    4: 'bg-green-500/30 border-green-500/50',
    5: 'bg-emerald-500/30 border-emerald-500/50',
  };

  const moodEmoji: Record<number, string> = {
    1: '😢', 2: '😕', 3: '😐', 4: '🙂', 5: '😊',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-xl bg-black/20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/diary" className="text-white/60 hover:text-white transition">
              ← List
            </Link>
            <h1 className="text-xl font-bold text-white">📅 Calendar</h1>
          </div>
          <button
            onClick={goToToday}
            className="px-3 py-1 text-sm bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition"
          >
            Today
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={prevMonth}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            ← Prev
          </button>
          <h2 className="text-2xl font-bold text-white">{monthName}</h2>
          <button
            onClick={nextMonth}
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition"
          >
            Next →
          </button>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
          {/* Week day headers */}
          <div className="grid grid-cols-7 border-b border-white/10">
            {weekDays.map((day) => (
              <div key={day} className="p-3 text-center text-white/60 text-sm font-medium">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendar.map((day, idx) => (
                <Link
                  key={idx}
                  href={day.entry ? `/diary/${day.date}` : `/diary/new?date=${day.date}`}
                  className={`
                    relative min-h-[80px] p-2 border-b border-r border-white/5
                    transition-all hover:bg-white/5
                    ${!day.isCurrentMonth ? 'opacity-40' : ''}
                    ${day.isToday ? 'ring-2 ring-purple-500 ring-inset' : ''}
                    ${day.entry ? moodColors[day.entry.mood || 3] : ''}
                  `}
                >
                  <div className={`text-sm font-medium ${day.isToday ? 'text-purple-400' : 'text-white/80'}`}>
                    {day.dayOfMonth}
                  </div>
                  
                  {day.entry && (
                    <div className="mt-1">
                      <div className="text-lg">{moodEmoji[day.entry.mood || 3]}</div>
                      {day.entry.wins && day.entry.wins.length > 0 && (
                        <div className="text-xs text-green-400">✓ {day.entry.wins.length}</div>
                      )}
                    </div>
                  )}
                  
                  {!day.entry && day.isCurrentMonth && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <span className="text-2xl text-white/40">+</span>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center text-sm">
          {[1, 2, 3, 4, 5].map((mood) => (
            <div key={mood} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${moodColors[mood]}`}></div>
              <span className="text-white/60">{moodEmoji[mood]} Mood {mood}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
