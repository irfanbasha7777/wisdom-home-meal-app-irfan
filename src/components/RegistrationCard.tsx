import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Lock, LogIn, Search, UserPlus } from 'lucide-react';
import { PG_ROOMS } from '../data/rooms';
import { Resident } from '../types';
import { AddToHomeBanner } from './AddToHomeBanner';

interface RegistrationCardProps {
  residents: Resident[];
  onRegister: (payload: { fullName: string; roomNumber: string; mobile: string }) => Promise<void>;
  onSignIn: (mobile: string) => void;
  onOpenAdminLogin: () => void;
}

export const RegistrationCard: React.FC<RegistrationCardProps> = ({
  residents,
  onRegister,
  onSignIn,
  onOpenAdminLogin,
}) => {
  const [mode, setMode] = useState<'register' | 'signin'>('register');
  const [fullName, setFullName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [roomQuery, setRoomQuery] = useState('');
  const [roomOpen, setRoomOpen] = useState(false);
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredRooms = useMemo(() => {
    const q = roomQuery.trim().toLowerCase();
    if (!q) return PG_ROOMS;
    return PG_ROOMS.filter(
      (r) =>
        r.value.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.floor.toLowerCase().includes(q)
    );
  }, [roomQuery]);

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = fullName.trim();
    const cleanRoom = (roomNumber || roomQuery).trim();
    const cleanMobile = mobile.replace(/\D/g, '');

    if (cleanName.length < 2) {
      setError('Please enter your full name.');
      return;
    }
    if (!cleanRoom) {
      setError('Please select or enter your Room / Hall number (101–8010 or Hall).');
      return;
    }
    if (cleanMobile.length !== 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSubmitting(true);
    try {
      await onRegister({
        fullName: cleanName,
        roomNumber: cleanRoom,
        mobile: cleanMobile,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanMobile = mobile.replace(/\D/g, '');
    const match = residents.find((r) => r.mobile === cleanMobile);
    if (!match) {
      setError('No resident found with this mobile number. Register in 10 seconds instead.');
      return;
    }
    onSignIn(match.mobile);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col justify-center px-3 sm:px-4 py-6 sm:py-8 overflow-x-hidden">
      <div className="max-w-5xl w-full mx-auto">
        <AddToHomeBanner />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Info Column (No PG logo) */}
          <div className="lg:col-span-5 space-y-5 sm:space-y-6 pt-1 order-2 lg:order-1">
            <div className="hidden lg:flex items-center justify-between gap-2">
              <span className="text-xl font-semibold tracking-tight text-[#202124]">
                Wisdom Home JP Nagar
              </span>
            </div>

            <div className="hidden lg:block space-y-3">
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#202124] leading-tight text-balance">
                Resident Check-In, Meals &amp; Laundry
              </h1>
              <p className="text-[15px] text-[#5F6368] leading-relaxed">
                Activate your Wisdom Home JP Nagar pass in three fields. Manage daily meals, show your kitchen QR pass, track washing machines live, and build your 🔥 Streak.
              </p>
            </div>

            <div className="bg-white border border-[#E0E3E7] rounded-2xl p-4 sm:p-5 space-y-2.5 sm:space-y-3">
              <h2 className="text-sm font-semibold text-[#202124]">
                Standard Plan Activated Instantly
              </h2>
              <div className="text-xs text-[#5F6368] flex flex-wrap items-center gap-x-2 gap-y-1">
                <span>₹7,500/month</span>
                <span aria-hidden="true">·</span>
                <span>Breakfast &amp; Dinner Unlocked</span>
                <span aria-hidden="true">·</span>
                <span>Lunch Locked (₹1,000/mo add-on)</span>
                <span aria-hidden="true">·</span>
                <span>Washing Machine &amp; Terrace Enabled</span>
              </div>
            </div>

            {residents.length > 0 && (
              <div className="bg-white border border-[#E0E3E7] rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#202124]">
                    Quick Switch (Preview Residents)
                  </h3>
                  <span className="text-xs text-[#5F6368] tabular-nums">
                    {residents.length} active
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {residents.slice(0, 4).map((r) => (
                    <button
                      key={r.mobile}
                      type="button"
                      onClick={() => onSignIn(r.mobile)}
                      className="text-left p-2.5 rounded-xl border border-[#E0E3E7] hover:border-[#1A73E8] hover:bg-[#F8FAFF] transition-colors min-h-[44px]"
                    >
                      <div className="text-xs font-semibold text-[#202124] truncate">
                        {r.fullName}
                      </div>
                      <div className="text-[11px] text-[#5F6368] tabular-nums truncate">
                        Room {r.roomNumber} · {r.lunchUnlocked ? 'Gold Pass' : 'Standard'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-1 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="min-h-[40px] inline-flex items-center gap-1.5 text-xs font-medium text-[#5F6368] hover:text-[#1A73E8] transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                Admin / Warden Portal Login
              </button>
            </div>
          </div>

          {/* Right 3-Field Registration Card (appears first on mobile right under brand bar) */}
          <div className="lg:col-span-7 order-1 lg:order-2 space-y-4">
            <div className="lg:hidden px-1">
              <div className="text-lg font-semibold tracking-tight text-[#202124]">
                Wisdom Home JP Nagar
              </div>
              <div className="text-xs text-[#5F6368]">
                Resident Check-In, Meals &amp; Laundry
              </div>
            </div>

            <div className="bg-white border border-[#E0E3E7] rounded-3xl p-4 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.08)]">
              <div className="flex items-center gap-1.5 sm:gap-2 p-1 bg-[#F1F3F4] rounded-xl mb-5 sm:mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className={`flex-1 min-h-[44px] px-2 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    mode === 'register'
                      ? 'bg-white text-[#1A73E8] shadow-sm'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  New Resident
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError('');
                  }}
                  className={`flex-1 min-h-[44px] px-2 inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                    mode === 'signin'
                      ? 'bg-white text-[#1A73E8] shadow-sm'
                      : 'text-[#5F6368] hover:text-[#202124]'
                  }`}
                >
                  <LogIn className="w-4 h-4 shrink-0" />
                  Existing Resident
                </button>
              </div>

            {mode === 'register' ? (
              <form onSubmit={handleRegisterSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-sm font-medium text-[#202124] mb-1.5"
                  >
                    1. Full Name
                  </label>
                  <input
                    id="reg-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aditya Kulkarni"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-[#DADCE0] bg-white text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 text-[15px]"
                  />
                </div>

                <div className="relative">
                  <label
                    htmlFor="reg-room"
                    className="block text-sm font-medium text-[#202124] mb-1.5"
                  >
                    2. Room / Hall Number
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="reg-room"
                      type="text"
                      value={roomOpen ? roomQuery : roomNumber || roomQuery}
                      onFocus={() => {
                        setRoomOpen(true);
                        setRoomQuery(roomNumber);
                      }}
                      onChange={(e) => {
                        setRoomQuery(e.target.value);
                        setRoomNumber(e.target.value);
                        setRoomOpen(true);
                      }}
                      placeholder="Search 101–8010, Hall-A, Hall-B..."
                      className="w-full min-h-[48px] pl-10 pr-10 rounded-xl border border-[#DADCE0] bg-white text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 text-[15px]"
                    />
                    <button
                      type="button"
                      aria-label="Toggle room list"
                      onClick={() => setRoomOpen((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center text-[#5F6368] hover:text-[#202124]"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>

                  {roomOpen && (
                    <div className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto bg-white border border-[#E0E3E7] rounded-2xl shadow-lg p-1.5">
                      {filteredRooms.length > 0 ? (
                        filteredRooms.map((r) => {
                          const selected = roomNumber === r.value;
                          const occupantCount = residents.filter(
                            (res) => res.roomNumber.toLowerCase() === r.value.toLowerCase()
                          ).length;
                          return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={() => {
                                setRoomNumber(r.value);
                                setRoomQuery(r.value);
                                setRoomOpen(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-colors ${
                                selected
                                  ? 'bg-[#E8F0FE] text-[#174EA6] font-medium'
                                  : 'hover:bg-[#F8F9FA] text-[#202124]'
                              }`}
                            >
                              <div>
                                <span className="font-medium">{r.label}</span>
                                <span className="text-xs text-[#5F6368] ml-2">
                                  {r.floor} · {r.sharing}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                {occupantCount > 0 && (
                                  <span className="text-xs text-[#5F6368] tabular-nums">
                                    {occupantCount} in room
                                  </span>
                                )}
                                {selected && <Check className="w-4 h-4 text-[#1A73E8]" />}
                              </div>
                            </button>
                          );
                        })
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRoomNumber(roomQuery.trim());
                            setRoomOpen(false);
                          }}
                          className="w-full px-3 py-2.5 text-left text-sm text-[#1A73E8] hover:bg-[#F8F9FA] rounded-xl"
                        >
                          Use room &ldquo;{roomQuery.trim()}&rdquo;
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-1.5 text-xs text-[#5F6368]">
                    Supports Single, Double, Triple &amp; 4-sharing Halls (multiple residents can share the same room).
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="reg-mobile"
                    className="block text-sm font-medium text-[#202124] mb-1.5"
                  >
                    3. Mobile Number (Unique ID)
                  </label>
                  <input
                    id="reg-mobile"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit mobile number"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-[#DADCE0] bg-white text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 text-[15px] tabular-nums"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#F6AEA9] text-sm text-[#A50E0E]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-60 text-white font-medium text-[15px] transition-colors shadow-sm"
                >
                  {submitting ? 'Activating Account...' : 'Activate Standard Plan (₹7,500/mo)'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignInSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="signin-mobile"
                    className="block text-sm font-medium text-[#202124] mb-1.5"
                  >
                    Registered 10-Digit Mobile Number
                  </label>
                  <input
                    id="signin-mobile"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="e.g. 9845011223"
                    className="w-full min-h-[48px] px-4 rounded-xl border border-[#DADCE0] bg-white text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8] focus:ring-2 focus:ring-[#1A73E8]/20 text-[15px] tabular-nums"
                  />
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-[#FCE8E6] border border-[#F6AEA9] text-sm text-[#A50E0E]">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full min-h-[48px] px-6 py-3 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] text-white font-medium text-[15px] transition-colors shadow-sm"
                >
                  Sign In to Wisdom Home
                </button>
              </form>
            )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
