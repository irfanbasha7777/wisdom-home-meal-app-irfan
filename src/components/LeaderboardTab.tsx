import React, { useMemo, useState } from 'react';
import { Award, Search, Trophy, Utensils } from 'lucide-react';
import { Resident } from '../types';

interface LeaderboardTabProps {
  residents: Resident[];
  activeMobile: string;
}

const TOP_3_BADGES = [
  {
    rank: 1,
    badge: 'Zero-Waste Champion',
    accentBg: 'bg-[#FEF7E0]',
    accentText: 'text-[#7A4100]',
    border: 'border-[#F9AB00]/50',
    icon: Trophy,
  },
  {
    rank: 2,
    badge: 'Laundry Legend',
    accentBg: 'bg-[#E8F0FE]',
    accentText: 'text-[#174EA6]',
    border: 'border-[#1A73E8]/35',
    icon: Award,
  },
  {
    rank: 3,
    badge: 'Punctual Diner',
    accentBg: 'bg-[#E6F4EA]',
    accentText: 'text-[#137333]',
    border: 'border-[#1E8E3E]/35',
    icon: Utensils,
  },
];

export const LeaderboardTab: React.FC<LeaderboardTabProps> = ({ residents, activeMobile }) => {
  const [search, setSearch] = useState('');

  const sorted = useMemo(() => {
    return [...residents].sort((a, b) => {
      if (b.karmaPoints !== a.karmaPoints) return b.karmaPoints - a.karmaPoints;
      return b.goodNeighborStreak - a.goodNeighborStreak;
    });
  }, [residents]);

  const top3 = sorted.slice(0, 3);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        r.roomNumber.toLowerCase().includes(q)
    );
  }, [search, sorted]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
            Wisdom Home Wall of Fame
          </h1>
          <p className="text-sm text-[#5F6368]">
            Top residents of the month building 🔥 Streak through zero food waste and courteous laundry habits.
          </p>
        </div>
      </div>

      {/* Top 3 Featured Wall of Fame */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {top3.map((res, idx) => {
          const meta = TOP_3_BADGES[idx];
          const Icon = meta.icon;
          const isMe = res.mobile === activeMobile;
          const attendancePct =
            res.totalBooked > 0 ? Math.round((res.totalEaten / res.totalBooked) * 100) : 100;

          return (
            <div
              key={res.mobile}
              className={`bg-white rounded-3xl p-5 border ${meta.border} shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold ${meta.accentBg} ${meta.accentText}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {meta.badge}
                </div>
                <span className="text-xs font-semibold text-[#5F6368] tabular-nums">
                  #{meta.rank}
                </span>
              </div>

              <div>
                <div className="text-lg font-semibold text-[#202124] truncate">
                  {res.fullName} {isMe ? '(You)' : ''}
                </div>
                <div className="text-xs text-[#5F6368] tabular-nums">
                  Room {res.roomNumber} · {attendancePct}% Meal Attendance
                </div>
              </div>

              <div className="pt-3 border-t border-[#E0E3E7] flex items-center justify-between">
                <div>
                  <div className="text-xs text-[#5F6368]">Streak Score</div>
                  <div className="text-xl font-semibold text-[#202124] tabular-nums">
                    🔥 {res.karmaPoints}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-[#5F6368]">Good Neighbor</div>
                  <div className="text-sm font-semibold text-[#1E8E3E] tabular-nums">
                    🔥 {res.goodNeighborStreak} days
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Resident Streak Table */}
      <div className="bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
        <div className="p-4 sm:p-5 border-b border-[#E0E3E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-[#202124]">
            All Resident Standings ({sorted.length})
          </h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#5F6368] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or room..."
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>
        </div>

        {/* Mobile Card List (<640px) */}
        <div className="sm:hidden divide-y divide-[#E0E3E7]">
          {filtered.map((res) => {
            const rank = sorted.findIndex((item) => item.mobile === res.mobile) + 1;
            const isMe = res.mobile === activeMobile;
            const rate =
              res.totalBooked > 0 ? Math.round((res.totalEaten / res.totalBooked) * 100) : 100;
            return (
              <div
                key={res.mobile}
                className={`p-4 flex items-center justify-between gap-3 ${
                  isMe ? 'bg-[#E8F0FE]/50' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-semibold text-[#5F6368] tabular-nums w-6 shrink-0">
                    #{rank}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#202124] truncate">
                      {res.fullName}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-semibold text-[#1A73E8]">(You)</span>
                      )}
                    </div>
                    <div className="text-xs text-[#5F6368] tabular-nums">
                      Room {res.roomNumber} · {rate}% meal rate · 🔥 {res.goodNeighborStreak}d
                    </div>
                  </div>
                </div>
                <div className="text-sm font-semibold text-[#202124] tabular-nums whitespace-nowrap shrink-0">
                  🔥 {res.karmaPoints}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-[#5F6368]">
              No residents match &ldquo;{search}&rdquo;.
            </div>
          )}
        </div>

        {/* Desktop & Tablet Table (>=640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-xs font-medium text-[#5F6368] border-b border-[#E0E3E7]">
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Resident</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4 text-right">Neighbor Run</th>
                <th className="py-3 px-4 text-right">Meal Rate</th>
                <th className="py-3 px-4 text-right">🔥 Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E3E7] text-sm">
              {filtered.map((res) => {
                const rank = sorted.findIndex((item) => item.mobile === res.mobile) + 1;
                const isMe = res.mobile === activeMobile;
                const rate =
                  res.totalBooked > 0 ? Math.round((res.totalEaten / res.totalBooked) * 100) : 100;
                return (
                  <tr
                    key={res.mobile}
                    className={isMe ? 'bg-[#E8F0FE]/50' : 'hover:bg-[#F8F9FA]'}
                  >
                    <td className="py-3 px-4 font-medium text-[#5F6368] tabular-nums">
                      #{rank}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#202124]">
                      {res.fullName}
                      {isMe && (
                        <span className="ml-2 text-xs font-semibold text-[#1A73E8]">(You)</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#5F6368] tabular-nums">{res.roomNumber}</td>
                    <td className="py-3 px-4 text-right text-[#1E8E3E] font-medium tabular-nums">
                      🔥 {res.goodNeighborStreak}
                    </td>
                    <td className="py-3 px-4 text-right text-[#5F6368] tabular-nums">{rate}%</td>
                    <td className="py-3 px-4 text-right font-semibold text-[#202124] tabular-nums">
                      🔥 {res.karmaPoints}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-[#5F6368]">
                    No residents match &ldquo;{search}&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
