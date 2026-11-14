import React, { useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  CheckCircle2,
  Crown,
  Lock,
  QrCode,
  ShieldCheck,
  Utensils,
} from 'lucide-react';
import { DailyMealRecord, MealAttendanceStatus, MealType, Resident } from '../types';

interface MealsTabProps {
  resident: Resident;
  today: string;
  dailyMeals: DailyMealRecord[];
  busyMeal: MealType | null;
  onToggleMeal: (mealType: MealType, status: MealAttendanceStatus) => Promise<void>;
}

const MEAL_META: { type: MealType; timing: string; menuHint: string }[] = [
  { type: 'Breakfast', timing: '7:30 AM – 9:30 AM', menuHint: 'Idli Vada · Poha · Filter Coffee' },
  { type: 'Lunch', timing: '12:30 PM – 2:30 PM', menuHint: 'Rice · Dal Tadka · Curd · Sabzi' },
  { type: 'Dinner', timing: '7:30 PM – 9:30 PM', menuHint: 'Phulka · Paneer Curry · Jeera Rice' },
];

function getDefaultActiveMeal(): MealType {
  const hr = new Date().getHours();
  if (hr < 11) return 'Breakfast';
  if (hr < 16) return 'Lunch';
  return 'Dinner';
}

export const MealsTab: React.FC<MealsTabProps> = ({
  resident,
  today,
  dailyMeals,
  busyMeal,
  onToggleMeal,
}) => {
  const [selectedPassMeal, setSelectedPassMeal] = useState<MealType>(getDefaultActiveMeal);
  const [tilt, setTilt] = useState<{ rx: number; ry: number; glareX: number; glareY: number }>({
    rx: 0,
    ry: 0,
    glareX: 50,
    glareY: 50,
  });

  const mealStatusMap = useMemo(() => {
    const map: Record<MealType, MealAttendanceStatus> = {
      Breakfast: resident.autoOptedOut ? 'Skipping' : 'Eating',
      Lunch: resident.lunchUnlocked && !resident.autoOptedOut ? 'Eating' : 'Skipping',
      Dinner: resident.autoOptedOut ? 'Skipping' : 'Eating',
    };
    dailyMeals.forEach((m) => {
      if (m.mobile === resident.mobile && m.date === today) {
        map[m.mealType] = m.status;
      }
    });
    return map;
  }, [dailyMeals, resident, today]);

  const activeStatus = mealStatusMap[selectedPassMeal];
  const isGoldPass = resident.lunchUnlocked;

  const passStatus = useMemo(() => {
    if (!resident.lunchUnlocked && selectedPassMeal === 'Lunch') {
      return {
        tone: 'amber' as const,
        label: 'Standard Plan (Breakfast/Dinner Only – Lunch Locked)',
        sublabel: 'Upgrade to ₹8,500/mo plan via Admin to unlock daily lunch.',
        borderClass: 'border-[#F9AB00]',
        bannerClass: 'bg-[#FEF7E0] text-[#7A4100] border-[#F9AB00]/30',
      };
    }
    if (resident.autoOptedOut && activeStatus !== 'Eating' && activeStatus !== 'Eaten') {
      return {
        tone: 'red' as const,
        label: 'Opted Out or Auto-Paused',
        sublabel: `3-Strike Auto-Pause active (${resident.optInRecoveryCount}/3 booked meals attended).`,
        borderClass: 'border-[#D93025]',
        bannerClass: 'bg-[#FCE8E6] text-[#A50E0E] border-[#D93025]/30',
      };
    }
    if (activeStatus === 'Skipping' || activeStatus === 'NoShow') {
      return {
        tone: 'red' as const,
        label: 'Opted Out or Auto-Paused',
        sublabel:
          activeStatus === 'NoShow'
            ? 'Marked No-Show (-15 🔥 Streak).'
            : `You marked ${selectedPassMeal} as Skipping today.`,
        borderClass: 'border-[#D93025]',
        bannerClass: 'bg-[#FCE8E6] text-[#A50E0E] border-[#D93025]/30',
      };
    }
    if (!resident.lunchUnlocked) {
      return {
        tone: 'amber' as const,
        label: 'Standard Plan (Breakfast/Dinner Only – Lunch Locked)',
        sublabel: `${selectedPassMeal} is booked & ready to scan at the kitchen counter.`,
        borderClass: 'border-[#1E8E3E]',
        bannerClass: 'bg-[#FEF7E0] text-[#7A4100] border-[#F9AB00]/30',
      };
    }
    return {
      tone: 'green' as const,
      label: 'Meal Booked & Paid/Unlocked',
      sublabel:
        activeStatus === 'Eaten'
          ? `${selectedPassMeal} verified & served today.`
          : `Show this Golden 3D Pass at the counter for ${selectedPassMeal}.`,
      borderClass: 'border-[#1E8E3E]',
      bannerClass: 'bg-[#E6F4EA] text-[#137333] border-[#1E8E3E]/30',
    };
  }, [
    activeStatus,
    resident.autoOptedOut,
    resident.lunchUnlocked,
    resident.optInRecoveryCount,
    selectedPassMeal,
  ]);

  const qrPayload = useMemo(
    () =>
      JSON.stringify({
        v: 1,
        pg: 'Wisdom Home JP Nagar',
        mobile: resident.mobile,
        name: resident.fullName,
        room: resident.roomNumber,
        date: today,
        meal: selectedPassMeal,
        status: activeStatus,
        lunchUnlocked: resident.lunchUnlocked,
        autoOptedOut: resident.autoOptedOut,
      }),
    [activeStatus, resident, selectedPassMeal, today]
  );

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isGoldPass) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - y) * 14,
      ry: (x - 0.5) * 14,
      glareX: Math.round(x * 100),
      glareY: Math.round(y * 100),
    });
  };

  const resetTilt = () => {
    setTilt({ rx: 0, ry: 0, glareX: 50, glareY: 50 });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Daily Meal Attendance Controls */}
      <div className="lg:col-span-7 space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
              Today&apos;s Meal Attendance
            </h1>
            <p className="text-sm text-[#5F6368] tabular-nums">
              {today} · {resident.plan}
            </p>
          </div>
          <div className="text-xs text-[#5F6368] tabular-nums">
            No-Shows: {resident.consecutiveNoShows}/3 strikes
          </div>
        </div>

        {resident.autoOptedOut && (
          <div className="p-4 rounded-2xl bg-[#FCE8E6] border border-[#F6AEA9] flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#D93025] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-sm font-semibold text-[#A50E0E]">
                3-Strike Auto-Opt-Out Active
              </div>
              <p className="text-xs text-[#A50E0E]/90 leading-relaxed">
                After 3 consecutive No-Shows, default meal bookings pause automatically to prevent food waste. Toggle Eating below and scan in at the counter for 3 meals in a row to restore ({resident.optInRecoveryCount}/3 completed).
              </p>
            </div>
          </div>
        )}

        <div className="space-y-3.5">
          {MEAL_META.map(({ type, timing, menuHint }) => {
            const status = mealStatusMap[type];
            const isLunchLocked = type === 'Lunch' && !resident.lunchUnlocked;
            const isEaten = status === 'Eaten';
            const isNoShow = status === 'NoShow';
            const isBusy = busyMeal === type;

            return (
              <div
                key={type}
                className="bg-white border border-[#E0E3E7] rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4 text-[#1A73E8]" />
                      <h2 className="text-base font-semibold text-[#202124]">{type}</h2>
                    </div>
                    <div className="text-xs text-[#5F6368] mt-1 tabular-nums">
                      {timing} · {menuHint}
                    </div>
                  </div>

                  {isEaten ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#137333] whitespace-nowrap">
                      <CheckCircle2 className="w-4 h-4" />
                      Served
                    </span>
                  ) : isNoShow ? (
                    <span className="text-xs font-semibold text-[#D93025] whitespace-nowrap">
                      No-Show (-15 🔥)
                    </span>
                  ) : isLunchLocked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#B06000] whitespace-nowrap">
                      <Lock className="w-3.5 h-3.5" />
                      Locked
                    </span>
                  ) : (
                    <span
                      className={`text-xs font-semibold whitespace-nowrap ${
                        status === 'Eating' ? 'text-[#1E8E3E]' : 'text-[#5F6368]'
                      }`}
                    >
                      {status}
                    </span>
                  )}
                </div>

                {isLunchLocked ? (
                  <div className="p-3 rounded-xl bg-[#FEF7E0] border border-[#F9AB00]/30 flex items-center gap-2.5 text-xs font-medium text-[#7A4100]">
                    <Lock className="w-4 h-4 shrink-0 text-[#B06000]" />
                    <span>Lunch Locked – Pay ₹1,000/mo &amp; ask Admin to unlock.</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#F1F3F4] rounded-xl">
                    <button
                      type="button"
                      disabled={isBusy || isEaten}
                      onClick={() => onToggleMeal(type, 'Eating')}
                      className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        status === 'Eating' || isEaten
                          ? 'bg-[#1E8E3E] text-white shadow-sm'
                          : 'text-[#5F6368] hover:text-[#202124]'
                      } disabled:opacity-70`}
                    >
                      {isEaten ? 'Checked In' : 'Eating'}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy || isEaten}
                      onClick={() => onToggleMeal(type, 'Skipping')}
                      className={`min-h-[44px] rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        status === 'Skipping' || isNoShow
                          ? 'bg-white text-[#D93025] shadow-sm border border-[#E0E3E7]'
                          : 'text-[#5F6368] hover:text-[#202124]'
                      } disabled:opacity-50`}
                    >
                      Skipping
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Column: Dynamic QR Meal Pass (Golden 3D Pass when Lunch Unlocked) */}
      <div className="lg:col-span-5" style={{ perspective: '1100px' }}>
        <div
          onPointerMove={handleCardPointerMove}
          onPointerLeave={resetTilt}
          style={
            isGoldPass
              ? {
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                  transformStyle: 'preserve-3d',
                  background:
                    'linear-gradient(135deg, #FFF3B0 0%, #F5C542 28%, #D49B1A 54%, #FCE68A 78%, #B87B0E 100%)',
                  boxShadow:
                    '0 20px 38px -12px rgba(154, 102, 4, 0.45), inset 0 1px 1px rgba(255, 255, 255, 0.85), inset 0 -2px 6px rgba(120, 74, 0, 0.35)',
                }
              : undefined
          }
          className={`relative overflow-hidden rounded-3xl p-4 sm:p-6 space-y-4 sm:space-y-5 touch-pan-y ${
            isGoldPass
              ? 'border-2 border-[#FFF1A8] text-[#3E2700]'
              : 'bg-white border border-[#E0E3E7] shadow-[0_1px_3px_rgba(60,64,67,0.08)]'
          }`}
        >
          {/* Specular 3D Gold Foil Glare Layer */}
          {isGoldPass && (
            <div
              className="pointer-events-none absolute inset-0 opacity-45"
              style={{
                background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 58%)`,
              }}
            />
          )}

          <div className="relative flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isGoldPass ? (
                <Crown className="w-5 h-5 text-[#5C3A00] shrink-0" />
              ) : (
                <QrCode className="w-5 h-5 text-[#1A73E8] shrink-0" />
              )}
              <h2
                className={`text-base font-semibold ${
                  isGoldPass ? 'text-[#3E2700]' : 'text-[#202124]'
                }`}
              >
                {isGoldPass ? 'Golden 3D Meal Pass' : 'Daily QR Meal Pass'}
              </h2>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap ${
                isGoldPass ? 'text-[#4E3100]' : 'text-[#5F6368]'
              }`}
            >
              <ShieldCheck
                className={`w-4 h-4 ${isGoldPass ? 'text-[#4E3100]' : 'text-[#1E8E3E]'}`}
              />
              {isGoldPass ? 'All-Meals Gold' : 'Anti-Theft ID'}
            </span>
          </div>

          {/* Meal selector for QR Pass */}
          <div
            className={`relative grid grid-cols-3 gap-1 p-1 rounded-xl ${
              isGoldPass ? 'bg-[#6F4800]/15' : 'bg-[#F1F3F4]'
            }`}
          >
            {(['Breakfast', 'Lunch', 'Dinner'] as MealType[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setSelectedPassMeal(m)}
                className={`min-h-[40px] rounded-lg text-xs font-semibold transition-colors ${
                  selectedPassMeal === m
                    ? isGoldPass
                      ? 'bg-[#3E2700] text-[#FFF3B0] shadow-sm'
                      : 'bg-white text-[#1A73E8] shadow-sm'
                    : isGoldPass
                    ? 'text-[#3E2700]/80 hover:text-[#3E2700]'
                    : 'text-[#5F6368] hover:text-[#202124]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Color-coded Authorization Status Banner */}
          <div
            className={`relative p-3.5 rounded-2xl border ${
              isGoldPass && passStatus.tone === 'green'
                ? 'bg-[#FFFDF2]/90 border-[#A67100]/40 text-[#3E2700]'
                : passStatus.bannerClass
            }`}
          >
            <div className="text-sm font-semibold">{passStatus.label}</div>
            <div className="text-xs opacity-90 mt-0.5">{passStatus.sublabel}</div>
          </div>

          {/* Scannable QR Code Frame */}
          <div className="relative flex flex-col items-center justify-center py-2 sm:py-3">
            <div
              style={isGoldPass ? { transform: 'translateZ(24px)' } : undefined}
              className={`p-3.5 sm:p-4 bg-white rounded-3xl border-4 ${
                isGoldPass
                  ? passStatus.tone === 'red'
                    ? 'border-[#D93025] shadow-lg'
                    : 'border-[#FFF6C2] shadow-[0_14px_24px_rgba(92,58,0,0.3)]'
                  : passStatus.borderClass
              }`}
            >
              <QRCodeSVG
                value={qrPayload}
                size={196}
                className="w-40 h-40 sm:w-48 sm:h-48"
                level="M"
                bgColor="#FFFFFF"
                fgColor="#202124"
              />
            </div>
          </div>

          {/* Resident Pass Metadata */}
          <div
            className={`relative border-t pt-4 text-center space-y-1 ${
              isGoldPass ? 'border-[#6F4800]/25' : 'border-[#E0E3E7]'
            }`}
          >
            <div
              className={`text-base font-semibold ${
                isGoldPass ? 'text-[#3E2700]' : 'text-[#202124]'
              }`}
            >
              {resident.fullName}
            </div>
            <div
              className={`text-xs tabular-nums ${
                isGoldPass ? 'text-[#4E3100] font-medium' : 'text-[#5F6368]'
              }`}
            >
              Wisdom Home JP Nagar · Room {resident.roomNumber} · {selectedPassMeal}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
