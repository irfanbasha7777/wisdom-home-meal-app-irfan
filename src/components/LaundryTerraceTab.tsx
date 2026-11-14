import React, { useEffect, useState } from 'react';
import { BellRing, CheckCircle2, Clock, Sun, WashingMachine } from 'lucide-react';
import { Resident, TerraceState, TerraceStatus, WashingMachine as MachineType } from '../types';

interface LaundryTerraceTabProps {
  resident: Resident;
  machines: MachineType[];
  terrace: TerraceState;
  demoMode: boolean;
  busyAction: string | null;
  onStartWash: (machineId: 'WM-1' | 'WM-2', durationMins: number) => Promise<void>;
  onMarkAvailable: (machineId: 'WM-1' | 'WM-2') => Promise<void>;
  onNudgeOwner: (machineId: 'WM-1' | 'WM-2') => Promise<void>;
  onSimulateFinish: (machineId: 'WM-1' | 'WM-2') => Promise<void>;
  onUpdateTerrace: (status: TerraceStatus) => Promise<void>;
}

const TERRACE_OPTIONS: {
  value: TerraceStatus;
  hint: string;
  activeClass: string;
}[] = [
  {
    value: 'Plenty of Space',
    hint: 'Open lines & sunlight available',
    activeClass: 'bg-[#E6F4EA] border-[#1E8E3E] text-[#137333]',
  },
  {
    value: 'Filling Up',
    hint: 'A few racks left on the east side',
    activeClass: 'bg-[#FEF7E0] border-[#F9AB00] text-[#7A4100]',
  },
  {
    value: 'Full',
    hint: 'Wait before bringing heavy loads',
    activeClass: 'bg-[#FCE8E6] border-[#D93025] text-[#A50E0E]',
  },
];

function formatRelativeTime(iso: string): string {
  if (!iso) return 'Just now';
  const diffMins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const hrs = Math.floor(diffMins / 60);
  return `${hrs}h ${diffMins % 60}m ago`;
}

export const LaundryTerraceTab: React.FC<LaundryTerraceTabProps> = ({
  resident,
  machines,
  terrace,
  demoMode,
  busyAction,
  onStartWash,
  onMarkAvailable,
  onNudgeOwner,
  onSimulateFinish,
  onUpdateTerrace,
}) => {
  const [durations, setDurations] = useState<Record<'WM-1' | 'WM-2', string>>({
    'WM-1': '45',
    'WM-2': '45',
  });
  const [durationErrors, setDurationErrors] = useState<Record<string, string>>({});
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [nudgedIds, setNudgedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleNudge = async (machineId: 'WM-1' | 'WM-2') => {
    await onNudgeOwner(machineId);
    setNudgedIds((prev) => ({ ...prev, [machineId]: true }));
  };

  const handleStart = async (machineId: 'WM-1' | 'WM-2') => {
    const parsed = Number(durations[machineId]);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 180) {
      setDurationErrors((prev) => ({
        ...prev,
        [machineId]: 'Enter a wash time between 5 and 180 minutes.',
      }));
      return;
    }
    setDurationErrors((prev) => ({ ...prev, [machineId]: '' }));
    await onStartWash(machineId, Math.round(parsed));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
            Laundry &amp; Terrace Tracker
          </h1>
          <p className="text-sm text-[#5F6368]">
            Earn +10 🔥 Streak when you collect clothes within 10 mins or update terrace space. You&apos;ll also get an alert when a machine is free.
          </p>
        </div>
      </div>

      {/* Washing Machines Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {machines.map((m) => {
          const endMs = m.endTime ? new Date(m.endTime).getTime() : 0;
          const startMs = m.startTime ? new Date(m.startTime).getTime() : 0;
          const remainingMs = Math.max(0, endMs - nowMs);
          const minsLeft = Math.ceil(remainingMs / 60000);
          const secsLeft = Math.floor((remainingMs % 60000) / 1000);
          const totalMs = Math.max(1, endMs - startMs);
          const progressPct =
            m.status === 'In Use'
              ? Math.min(100, Math.max(4, ((nowMs - startMs) / totalMs) * 100))
              : 100;

          const effectiveStatus =
            m.status === 'In Use' && endMs > 0 && remainingMs <= 0
              ? 'Cycle Finished – Clothes Inside'
              : m.status;

          const isOwner = m.residentMobile === resident.mobile;
          const rawDuration = durations[m.id] ?? '45';
          const numericDuration = Number(rawDuration) || 0;
          const isBusy = busyAction === m.id;

          const badgeColor =
            effectiveStatus === 'Available'
              ? 'text-[#137333] bg-[#E6F4EA]'
              : effectiveStatus === 'In Use'
              ? 'text-[#7A4100] bg-[#FEF7E0]'
              : 'text-[#A50E0E] bg-[#FCE8E6]';

          return (
            <div
              key={m.id}
              className="bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] flex flex-col justify-between gap-5"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
                      <WashingMachine className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-[#202124]">{m.name}</h2>
                      <div className="text-xs text-[#5F6368]">
                        {effectiveStatus === 'Available'
                          ? 'Ready for next load'
                          : `Used by ${m.residentName} · Room ${m.roomNumber}`}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${badgeColor}`}
                  >
                    {effectiveStatus === 'Cycle Finished – Clothes Inside'
                      ? 'Clothes Inside'
                      : effectiveStatus}
                  </span>
                </div>

                {effectiveStatus === 'Available' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#5F6368]">
                        Quick Presets or Custom Time (mins)
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {([30, 45, 60] as const).map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            setDurations((prev) => ({ ...prev, [m.id]: String(mins) }));
                            setDurationErrors((prev) => ({ ...prev, [m.id]: '' }));
                          }}
                          className={`min-h-[42px] rounded-xl text-sm font-medium border transition-colors tabular-nums ${
                            numericDuration === mins
                              ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                              : 'bg-white border-[#DADCE0] text-[#5F6368] hover:bg-[#F8F9FA]'
                          }`}
                        >
                          {mins} mins
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor={`manual-mins-${m.id}`}
                        className="text-xs font-medium text-[#5F6368] whitespace-nowrap"
                      >
                        Manual Time:
                      </label>
                      <input
                        id={`manual-mins-${m.id}`}
                        type="number"
                        min={5}
                        max={180}
                        inputMode="numeric"
                        value={rawDuration}
                        onChange={(e) => {
                          setDurations((prev) => ({ ...prev, [m.id]: e.target.value }));
                          setDurationErrors((prev) => ({ ...prev, [m.id]: '' }));
                        }}
                        placeholder="e.g. 52"
                        className="w-24 sm:w-28 min-h-[42px] px-3 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] tabular-nums focus:outline-none focus:border-[#1A73E8]"
                      />
                      <span className="text-xs text-[#5F6368] whitespace-nowrap">mins (5–180)</span>
                    </div>

                    {durationErrors[m.id] && (
                      <div className="text-xs text-[#D93025]">{durationErrors[m.id]}</div>
                    )}
                  </div>
                )}

                {effectiveStatus === 'In Use' && (
                  <div className="p-4 rounded-2xl bg-[#FEF7E0]/70 border border-[#F9AB00]/30 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-[#7A4100] truncate">
                        In Use by {m.residentName} · Room {m.roomNumber}
                      </span>
                      <span className="font-semibold text-[#7A4100] tabular-nums whitespace-nowrap flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        ~{minsLeft}m {String(secsLeft).padStart(2, '0')}s left
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F9AB00]/20 overflow-hidden">
                      <div
                        className="h-full bg-[#F9AB00] transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {effectiveStatus === 'Cycle Finished – Clothes Inside' && (
                  <div className="p-4 rounded-2xl bg-[#FCE8E6] border border-[#F6AEA9] space-y-1.5">
                    <div className="text-sm font-semibold text-[#A50E0E]">
                      Cycle Finished – Clothes Inside
                    </div>
                    <p className="text-xs text-[#A50E0E]/90 tabular-nums">
                      Finished {formatRelativeTime(m.endTime)}. {m.residentName} (Room {m.roomNumber}) has clothes inside.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Footer */}
              <div className="space-y-2">
                {effectiveStatus === 'Available' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleStart(m.id)}
                    className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-60 text-white text-sm font-medium transition-colors tabular-nums"
                  >
                    {isBusy
                      ? 'Starting Wash...'
                      : `Start Wash (${numericDuration || 45} mins)`}
                  </button>
                )}

                {effectiveStatus === 'In Use' && (
                  <div className="flex flex-wrap gap-2">
                    {isOwner && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onMarkAvailable(m.id)}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E8E3E] hover:bg-[#187733] text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Collect Early &amp; Free (+10 🔥)
                      </button>
                    )}
                    {demoMode && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onSimulateFinish(m.id)}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] text-[#5F6368] text-xs font-medium"
                      >
                        Simulate Cycle End
                      </button>
                    )}
                  </div>
                )}

                {effectiveStatus === 'Cycle Finished – Clothes Inside' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      disabled={isBusy || nudgedIds[m.id]}
                      onClick={() => handleNudge(m.id)}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#F9AB00] hover:bg-[#E39B00] disabled:opacity-70 text-[#202124] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <BellRing className="w-4 h-4" />
                      {nudgedIds[m.id] ? 'Owner Notified' : 'Notify Owner: Clothes Ready'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => onMarkAvailable(m.id)}
                      className="min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1E8E3E] hover:bg-[#187733] disabled:opacity-60 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Available (+10 🔥)
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Terrace Drying Space Meter */}
      <div className="bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FEF7E0] text-[#B06000] flex items-center justify-center shrink-0">
              <Sun className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#202124]">
                Terrace Drying Space Meter
              </h2>
              <p className="text-xs text-[#5F6368] tabular-nums">
                Last updated by {terrace.updatedByName} · {formatRelativeTime(terrace.updatedAt)} · Tap to update (+10 🔥 Streak)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TERRACE_OPTIONS.map((opt) => {
            const active = terrace.status === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busyAction === 'TERRACE'}
                onClick={() => onUpdateTerrace(opt.value)}
                className={`min-h-[60px] p-4 rounded-2xl border text-left transition-colors ${
                  active
                    ? opt.activeClass
                    : 'bg-white border-[#DADCE0] hover:bg-[#F8F9FA] text-[#202124]'
                }`}
              >
                <div className="text-sm font-semibold">{opt.value}</div>
                <div className="text-xs opacity-85 mt-0.5">{opt.hint}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
