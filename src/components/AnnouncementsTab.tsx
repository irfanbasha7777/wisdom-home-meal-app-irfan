import React, { useMemo, useState } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { AnnouncementCategory, AnnouncementItem } from '../types';

interface AnnouncementsTabProps {
  announcements: AnnouncementItem[];
}

const CATEGORIES: ('All' | AnnouncementCategory)[] = [
  'All',
  'Urgent',
  'Menu',
  'Maintenance',
  'General',
];

function formatAnnTime(iso: string): string {
  if (!iso) return 'Just now';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const AnnouncementsTab: React.FC<AnnouncementsTabProps> = ({ announcements }) => {
  const [filter, setFilter] = useState<'All' | AnnouncementCategory>('All');

  const sorted = useMemo(() => {
    const base =
      filter === 'All'
        ? announcements
        : announcements.filter((a) => a.category === filter);

    return [...base].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [announcements, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
            Announcements &amp; Updates
          </h1>
          <p className="text-sm text-[#5F6368]">
            Official regular updates from Wisdom Home JP Nagar Admin &amp; Warden.
          </p>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
              filter === cat
                ? 'bg-[#1A73E8] text-white shadow-sm'
                : 'bg-white border border-[#E0E3E7] text-[#5F6368] hover:text-[#202124]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {sorted.map((item) => {
          const catTone =
            item.category === 'Urgent'
              ? 'text-[#A50E0E] bg-[#FCE8E6]'
              : item.category === 'Menu'
              ? 'text-[#137333] bg-[#E6F4EA]'
              : item.category === 'Maintenance'
              ? 'text-[#7A4100] bg-[#FEF7E0]'
              : 'text-[#174EA6] bg-[#E8F0FE]';

          return (
            <article
              key={item.id}
              className="bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-[#5F6368]">
                  <span className={`px-2.5 py-0.5 rounded-lg font-semibold ${catTone}`}>
                    {item.category}
                  </span>
                  {item.pinned && (
                    <span className="inline-flex items-center gap-1 text-[#1A73E8] font-semibold">
                      <Pin className="w-3.5 h-3.5" />
                      Pinned
                    </span>
                  )}
                </div>
                <span className="text-xs text-[#5F6368] tabular-nums">
                  {formatAnnTime(item.createdAt)}
                </span>
              </div>

              <h2 className="text-base sm:text-lg font-semibold text-[#202124]">
                {item.title}
              </h2>

              <p className="text-sm text-[#3C4043] leading-relaxed whitespace-pre-line">
                {item.body}
              </p>

              <div className="pt-2 border-t border-[#E0E3E7] text-xs text-[#5F6368]">
                Posted by {item.author}
              </div>
            </article>
          );
        })}

        {sorted.length === 0 && (
          <div className="bg-white border border-[#E0E3E7] rounded-3xl p-10 text-center space-y-2">
            <Megaphone className="w-7 h-7 text-[#80868B] mx-auto" />
            <div className="text-sm font-medium text-[#202124]">No updates in this category</div>
            <p className="text-xs text-[#5F6368]">
              New announcements from Wisdom Home JP Nagar Admin &amp; Warden will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
