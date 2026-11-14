import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  History,
  Lock,
  MinusCircle,
  PlusCircle,
  Utensils,
  WashingMachine,
} from 'lucide-react';
import {
  ActivityLogEntry,
  DailyMealRecord,
  Resident,
  WashingMachine as MachineType,
} from '../types';
import { PushPermissionState } from '../services/notifications';

interface ProfilePageProps {
  resident: Resident;
  mealHistory: DailyMealRecord[];
  activityLog: ActivityLogEntry[];
  machines: MachineType[];
  demoMode: boolean;
  pushPermission: PushPermissionState;
  pushEnabled: boolean;
  onEnablePush: () => Promise<void>;
  onTogglePushPref: (enabled: boolean) => void;
  onTestPush: () => Promise<void>;
  onOpenAdminLogin: () => void;
  onBack: () => void;
}

function formatDateTimeIST(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  resident,
  mealHistory,
  activityLog,
  machines,
  demoMode,
  pushPermission,
  pushEnabled,
  onEnablePush,
  onTogglePushPref,
  onTestPush,
  onOpenAdminLogin,
  onBack,
}) => {
  const [mealFilter, setMealFilter] = useState<'ALL' | 'Eaten' | 'Skipping' | 'NoShow'>('ALL');
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'BONUS' | 'PENALTY'>('ALL');

  const myMealHistory = useMemo(() => {
    return mealHistory
      .filter((m) => m.mobile === resident.mobile)
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        const order = { Dinner: 3, Lunch: 2, Breakfast: 1 };
        return (order[b.mealType] || 0) - (order[a.mealType] || 0);
      });
  }, [mealHistory, resident.mobile]);

  const mealStats = useMemo(() => {
    let attended = 0;
    let skipped = 0;
    let noShows = 0;
    let booked = 0;
    myMealHistory.forEach((m) => {
      if (m.status === 'Eaten') attended += 1;
      else if (m.status === 'Skipping') skipped += 1;
      else if (m.status === 'NoShow') noShows += 1;
      else if (m.status === 'Eating') booked += 1;
    });
    return { attended, skipped, noShows, booked };
  }, [myMealHistory]);

  const filteredMeals = useMemo(() => {
    if (mealFilter === 'ALL') return myMealHistory;
    return myMealHistory.filter((m) => m.status === mealFilter);
  }, [mealFilter, myMealHistory]);

  const myActivity = useMemo(() => {
    return activityLog
      .filter((a) => a.mobile === resident.mobile)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activityLog, resident.mobile]);

  const laundryHistory = useMemo(() => {
    return myActivity.filter(
      (a) => a.category === 'LAUNDRY' || a.title.toLowerCase().includes('laundry')
    );
  }, [myActivity]);

  const activeMachines = useMemo(() => {
    return machines.filter((m) => m.residentMobile === resident.mobile);
  }, [machines, resident.mobile]);

  const streakEntries = useMemo(() => {
    const items = myActivity.filter(
      (a) => a.karmaDelta !== 0 || a.category === 'PENALTY' || a.category === 'BONUS'
    );
    if (ledgerFilter === 'BONUS') return items.filter((a) => a.karmaDelta > 0);
    if (ledgerFilter === 'PENALTY') return items.filter((a) => a.karmaDelta < 0);
    return items;
  }, [ledgerFilter, myActivity]);

  const overallRate =
    resident.totalBooked > 0
      ? Math.round((resident.totalEaten / resident.totalBooked) * 100)
      : 100;

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[42px] min-w-[42px] rounded-xl border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] flex items-center justify-center text-[#202124] transition-colors"
            aria-label="Back to Meals"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
              Resident Profile &amp; History
            </h1>
            <p className="text-xs sm:text-sm text-[#5F6368]">
              {demoMode
                ? 'Wisdom Home JP Nagar · Local Demo Sheet store'
                : 'Wisdom Home JP Nagar · Synced from Google Sheets'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAdminLogin}
          className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-xs font-medium text-[#5F6368] inline-flex items-center gap-1.5 transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          Staff / Warden Login
        </button>
      </div>

      {/* Hero Summary + Push Notification Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] flex flex-col justify-between gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-medium text-[#1A73E8]">{resident.plan}</div>
              <h2 className="text-2xl font-semibold text-[#202124] mt-0.5">
                {resident.fullName}
              </h2>
              <div className="text-sm text-[#5F6368] mt-1 tabular-nums">
                Room {resident.roomNumber} · +91 {resident.mobile}
              </div>
            </div>

            <div className="px-4 py-2.5 rounded-2xl bg-[#FEF7E0] border border-[#F9AB00]/30 text-right">
              <div className="text-xs font-medium text-[#7A4100]">
                Current Streak
              </div>
              <div className="text-2xl font-semibold text-[#202124] tabular-nums">
                🔥 {resident.karmaPoints}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-4 border-t border-[#E0E3E7]">
            <div>
              <div className="text-[11px] sm:text-xs text-[#5F6368]">Neighbor Run</div>
              <div className="text-sm sm:text-lg font-semibold text-[#1E8E3E] tabular-nums mt-0.5">
                🔥 {resident.goodNeighborStreak}d
              </div>
            </div>
            <div>
              <div className="text-xs text-[#5F6368]">Meal Rate</div>
              <div className="text-lg font-semibold text-[#202124] tabular-nums mt-0.5">
                {overallRate}%
              </div>
            </div>
            <div>
              <div className="text-xs text-[#5F6368]">Total No-Shows</div>
              <div
                className={`text-lg font-semibold tabular-nums mt-0.5 ${
                  resident.totalNoShows > 0 ? 'text-[#D93025]' : 'text-[#1E8E3E]'
                }`}
              >
                {resident.totalNoShows}
              </div>
            </div>
          </div>
        </div>

        {/* Push Notifications Preferences Card */}
        <div className="lg:col-span-5 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] flex flex-col justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {pushPermission === 'granted' && pushEnabled ? (
                  <Bell className="w-5 h-5 text-[#1E8E3E]" />
                ) : (
                  <BellOff className="w-5 h-5 text-[#5F6368]" />
                )}
                <h3 className="text-base font-semibold text-[#202124]">
                  Push Notifications
                </h3>
              </div>
              <span
                className={`text-xs font-semibold ${
                  pushPermission === 'granted' && pushEnabled
                    ? 'text-[#1E8E3E]'
                    : pushPermission === 'denied'
                    ? 'text-[#D93025]'
                    : 'text-[#5F6368]'
                }`}
              >
                {pushPermission === 'unsupported'
                  ? 'In-App Only'
                  : pushPermission === 'denied'
                  ? 'Blocked in Browser'
                  : pushPermission === 'granted'
                  ? pushEnabled
                    ? 'Active'
                    : 'Paused'
                  : 'Not Enabled'}
              </span>
            </div>
            <p className="text-xs text-[#5F6368] leading-relaxed">
              Receive instant phone &amp; browser alerts for Wisdom Home announcements, surplus food, laundry cycle completion, and when a washing machine becomes free.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {pushPermission === 'default' && (
              <button
                type="button"
                onClick={onEnablePush}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              >
                <Bell className="w-4 h-4" />
                Enable Push Notifications
              </button>
            )}

            {pushPermission === 'granted' && (
              <>
                <button
                  type="button"
                  onClick={() => onTogglePushPref(!pushEnabled)}
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium border transition-colors ${
                    pushEnabled
                      ? 'bg-[#E6F4EA] border-[#1E8E3E]/40 text-[#137333]'
                      : 'bg-[#F8F9FA] border-[#DADCE0] text-[#5F6368]'
                  }`}
                >
                  {pushEnabled ? 'Notifications On' : 'Resume Notifications'}
                </button>
                <button
                  type="button"
                  onClick={onTestPush}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] text-xs font-medium text-[#202124]"
                >
                  Send Test Push
                </button>
              </>
            )}

            {(pushPermission === 'denied' || pushPermission === 'unsupported') && (
              <button
                type="button"
                onClick={onTestPush}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] text-xs font-medium text-[#202124]"
              >
                Test In-App Alert Banner
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meal Attendance History + Laundry & Streak History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Meal Attendance History (DailyMeals tab) */}
        <div className="lg:col-span-6 bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
          <div className="p-4 sm:p-5 border-b border-[#E0E3E7] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#1A73E8]" />
                <h3 className="text-base font-semibold text-[#202124]">
                  Recent Meal Attendance
                </h3>
              </div>
              <span className="text-xs text-[#5F6368] tabular-nums">
                {mealStats.attended} attended · {mealStats.skipped} skipped · {mealStats.noShows} missed
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: 'ALL', label: `All (${myMealHistory.length})` },
                  { id: 'Eaten', label: `Attended (${mealStats.attended})` },
                  { id: 'Skipping', label: `Skipped (${mealStats.skipped})` },
                  { id: 'NoShow', label: `No-Show (${mealStats.noShows})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setMealFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    mealFilter === f.id
                      ? 'bg-[#E8F0FE] text-[#174EA6]'
                      : 'bg-[#F1F3F4] text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-[#E0E3E7] max-h-96 overflow-y-auto">
            {filteredMeals.map((row, idx) => {
              const label =
                row.status === 'Eaten'
                  ? 'Attended'
                  : row.status === 'Eating'
                  ? 'Booked'
                  : row.status === 'NoShow'
                  ? 'No-Show (-15 🔥)'
                  : 'Skipped';
              const tone =
                row.status === 'Eaten'
                  ? 'text-[#137333] bg-[#E6F4EA]'
                  : row.status === 'Eating'
                  ? 'text-[#174EA6] bg-[#E8F0FE]'
                  : row.status === 'NoShow'
                  ? 'text-[#A50E0E] bg-[#FCE8E6]'
                  : 'text-[#5F6368] bg-[#F1F3F4]';

              return (
                <div
                  key={`${row.date}-${row.mealType}-${idx}`}
                  className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium text-[#202124]">
                      {row.mealType}
                    </div>
                    <div className="text-xs text-[#5F6368] tabular-nums">
                      {row.date}
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${tone}`}>
                    {label}
                  </span>
                </div>
              );
            })}
            {filteredMeals.length === 0 && (
              <div className="p-8 text-center text-sm text-[#5F6368]">
                No meal attendance records found for this filter.
              </div>
            )}
          </div>
        </div>

        {/* Right: Laundry Usage & Penalties/Bonuses */}
        <div className="lg:col-span-6 space-y-6">
          {/* Laundry Usage Card */}
          <div className="bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
            <div className="p-4 sm:p-5 border-b border-[#E0E3E7] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <WashingMachine className="w-4 h-4 text-[#1A73E8]" />
                <h3 className="text-base font-semibold text-[#202124]">
                  Laundry Usage History
                </h3>
              </div>
              <span className="text-xs text-[#5F6368] tabular-nums">
                {laundryHistory.length} logged events
              </span>
            </div>

            {activeMachines.length > 0 && (
              <div className="px-4 sm:px-5 py-3 bg-[#E8F0FE]/60 border-b border-[#E0E3E7] flex items-center justify-between gap-3">
                <div className="text-xs sm:text-sm font-medium text-[#174EA6]">
                  Currently using {activeMachines.map((m) => m.name).join(', ')}
                </div>
                <span className="text-xs font-semibold text-[#174EA6]">
                  {activeMachines[0].status === 'In Use' ? 'Running' : 'Clothes Inside'}
                </span>
              </div>
            )}

            <div className="divide-y divide-[#E0E3E7] max-h-56 overflow-y-auto">
              {laundryHistory.map((item) => (
                <div
                  key={item.id}
                  className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#202124]">{item.title}</div>
                    <div className="text-xs text-[#5F6368] mt-0.5">
                      {item.detail} · {formatDateTimeIST(item.createdAt)}
                    </div>
                  </div>
                  {item.karmaDelta > 0 && (
                    <span className="text-xs font-semibold text-[#137333] tabular-nums whitespace-nowrap">
                      +{item.karmaDelta} 🔥
                    </span>
                  )}
                </div>
              ))}
              {laundryHistory.length === 0 && (
                <div className="p-6 text-center text-sm text-[#5F6368]">
                  No washing machine runs logged yet.
                </div>
              )}
            </div>
          </div>

          {/* Penalties & Bonuses Card */}
          <div className="bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
            <div className="p-4 sm:p-5 border-b border-[#E0E3E7] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#1A73E8]" />
                  <h3 className="text-base font-semibold text-[#202124]">
                    Penalties &amp; Streak Bonuses
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    { id: 'ALL', label: 'All Entries' },
                    { id: 'BONUS', label: 'Bonuses (+)' },
                    { id: 'PENALTY', label: 'Penalties (-)' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLedgerFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      ledgerFilter === tab.id
                        ? 'bg-[#E8F0FE] text-[#174EA6]'
                        : 'bg-[#F1F3F4] text-[#5F6368] hover:text-[#202124]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-[#E0E3E7] max-h-64 overflow-y-auto">
              {streakEntries.map((entry) => {
                const isPenalty = entry.karmaDelta < 0;
                return (
                  <div
                    key={entry.id}
                    className="px-4 sm:px-5 py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isPenalty ? (
                        <MinusCircle className="w-4 h-4 text-[#D93025] shrink-0 mt-0.5" />
                      ) : entry.karmaDelta > 0 ? (
                        <PlusCircle className="w-4 h-4 text-[#1E8E3E] shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-[#1A73E8] shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[#202124]">{entry.title}</div>
                        <div className="text-xs text-[#5F6368] mt-0.5">
                          {entry.detail} · {formatDateTimeIST(entry.createdAt)}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-semibold tabular-nums whitespace-nowrap ${
                        isPenalty ? 'text-[#D93025]' : 'text-[#137333]'
                      }`}
                    >
                      {entry.karmaDelta > 0 ? `+${entry.karmaDelta}` : entry.karmaDelta} 🔥
                    </span>
                  </div>
                );
              })}
              {streakEntries.length === 0 && (
                <div className="p-6 text-center text-sm text-[#5F6368]">
                  No streak bonuses or penalties recorded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
