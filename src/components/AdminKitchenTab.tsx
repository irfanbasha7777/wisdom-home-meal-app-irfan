import React, { useEffect, useMemo, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  AlertOctagon,
  Bell,
  Camera,
  CameraOff,
  CheckCircle2,
  Database,
  Lock,
  Megaphone,
  Newspaper,
  Search,
  Send,
  ShieldAlert,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react';
import {
  AdminSession,
  AnnouncementCategory,
  AnnouncementItem,
  DailyMealRecord,
  MealType,
  Resident,
} from '../types';

interface AdminKitchenTabProps {
  adminSession: AdminSession;
  today: string;
  residents: Resident[];
  dailyMeals: DailyMealRecord[];
  announcements: AnnouncementItem[];
  busyKey: string | null;
  demoMode: boolean;
  onOpenSetup: () => void;
  onLockAdmin: () => void;
  onCheckInMeal: (mobile: string, mealType: MealType) => Promise<void>;
  onReconcileMeal: (mealType: MealType) => Promise<void>;
  onBroadcastExtraFood: () => Promise<void>;
  onSendAdminPush: (payload: {
    title: string;
    message: string;
    targetMobile: string;
    author: string;
  }) => Promise<void>;
  onPostAnnouncement: (payload: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    author: string;
    pinned: boolean;
    notifyResidents: boolean;
  }) => Promise<void>;
  onDeleteAnnouncement: (id: string) => Promise<void>;
  onToggleLunchUnlock: (mobile: string, unlocked: boolean) => Promise<void>;
  onSendPoliteReminder: (targetMobile: string, targetName: string) => Promise<void>;
}

function getCurrentMealDefault(): MealType {
  const hr = new Date().getHours();
  if (hr < 11) return 'Breakfast';
  if (hr < 16) return 'Lunch';
  return 'Dinner';
}

export const AdminKitchenTab: React.FC<AdminKitchenTabProps> = ({
  adminSession,
  today,
  residents,
  dailyMeals,
  announcements,
  busyKey,
  demoMode,
  onOpenSetup,
  onLockAdmin,
  onCheckInMeal,
  onReconcileMeal,
  onBroadcastExtraFood,
  onSendAdminPush,
  onPostAnnouncement,
  onDeleteAnnouncement,
  onToggleLunchUnlock,
  onSendPoliteReminder,
}) => {
  const [activeMeal, setActiveMeal] = useState<MealType>(getCurrentMealDefault);
  const [counterSearch, setCounterSearch] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [scanFeedback, setScanFeedback] = useState<{
    type: 'success' | 'warning' | 'error';
    text: string;
  } | null>(null);
  const [confirmReconcile, setConfirmReconcile] = useState(false);
  const [remindedMap, setRemindedMap] = useState<Record<string, boolean>>({});
  const [extraFoodSent, setExtraFoodSent] = useState(false);

  // Admin Push Notification Composer
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushTarget, setPushTarget] = useState('ALL');
  const [pushSentMsg, setPushSentMsg] = useState('');

  // Announcement Composer
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annCategory, setAnnCategory] = useState<AnnouncementCategory>('General');
  const [annPinned, setAnnPinned] = useState(false);
  const [annNotify, setAnnNotify] = useState(true);
  const [annSavedMsg, setAnnSavedMsg] = useState('');

  // Camera QR Scanner state
  const [scannerOn, setScannerOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ value: string; time: number }>({ value: '', time: 0 });

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerOn(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleDecodedQR = async (rawValue: string) => {
    const now = Date.now();
    if (
      lastScanRef.current.value === rawValue &&
      now - lastScanRef.current.time < 3000
    ) {
      return;
    }
    lastScanRef.current = { value: rawValue, time: now };

    let mobile = rawValue.trim();
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed && parsed.mobile) {
        mobile = String(parsed.mobile);
      }
    } catch {
      // raw string may just be mobile number
    }

    await performCheckIn(mobile);
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setScannerOn(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraError(
        'Camera permission unavailable in this browser. Use Quick Search Check-In beside this panel.'
      );
      setScannerOn(false);
    }
  };

  useEffect(() => {
    if (!scannerOn) return;
    let rafId = 0;
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleDecodedQR(code.data);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  });

  const plateCounts = useMemo(() => {
    const counts: Record<MealType, { booked: number; eaten: number; pending: number }> = {
      Breakfast: { booked: 0, eaten: 0, pending: 0 },
      Lunch: { booked: 0, eaten: 0, pending: 0 },
      Dinner: { booked: 0, eaten: 0, pending: 0 },
    };
    dailyMeals.forEach((m) => {
      if (m.date !== today) return;
      if (m.status === 'Eating') {
        counts[m.mealType].booked += 1;
        counts[m.mealType].pending += 1;
      } else if (m.status === 'Eaten') {
        counts[m.mealType].booked += 1;
        counts[m.mealType].eaten += 1;
      }
    });
    return counts;
  }, [dailyMeals, today]);

  const mealStatusLookup = useMemo(() => {
    const map: Record<string, string> = {};
    dailyMeals.forEach((m) => {
      if (m.date === today && m.mealType === activeMeal) {
        map[m.mobile] = m.status;
      }
    });
    return map;
  }, [activeMeal, dailyMeals, today]);

  const performCheckIn = async (mobile: string) => {
    const res = residents.find((r) => r.mobile === mobile);
    if (!res) {
      setScanFeedback({ type: 'error', text: `Unrecognized resident ID (${mobile}).` });
      return;
    }

    if (activeMeal === 'Lunch' && !res.lunchUnlocked) {
      setScanFeedback({
        type: 'warning',
        text: `LUNCH LOCKED ALERT: ${res.fullName} (Room ${res.roomNumber}) is on Standard Plan (₹7,500/mo). Lunch is not unlocked!`,
      });
      return;
    }

    try {
      await onCheckInMeal(mobile, activeMeal);
      setScanFeedback({
        type: 'success',
        text: `Verified & Checked In: ${res.fullName} (Room ${res.roomNumber}) for ${activeMeal}.`,
      });
    } catch (err) {
      const code = (err as Error & { code?: string }).code;
      setScanFeedback({
        type: code === 'LUNCH_LOCKED' ? 'warning' : 'error',
        text: err instanceof Error ? err.message : 'Check-in failed.',
      });
    }
  };

  const counterResidents = useMemo(() => {
    const q = counterSearch.trim().toLowerCase();
    const list = q
      ? residents.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            r.roomNumber.toLowerCase().includes(q) ||
            r.mobile.includes(q)
        )
      : residents;
    return list.slice(0, 12);
  }, [counterSearch, residents]);

  const groupedRooms = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    const filtered = q
      ? residents.filter(
          (r) =>
            r.fullName.toLowerCase().includes(q) ||
            r.roomNumber.toLowerCase().includes(q) ||
            r.mobile.includes(q)
        )
      : residents;

    const groups: Record<string, Resident[]> = {};
    filtered.forEach((r) => {
      const key = r.roomNumber || 'Unassigned';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });

    return Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, undefined, { numeric: true })
    );
  }, [residents, rosterSearch]);

  const culprits = useMemo(() => {
    return [...residents]
      .filter((r) => r.totalNoShows > 0 || r.consecutiveNoShows > 0)
      .sort((a, b) => b.totalNoShows - a.totalNoShows);
  }, [residents]);

  const handleBroadcast = async () => {
    await onBroadcastExtraFood();
    setExtraFoodSent(true);
    setTimeout(() => setExtraFoodSent(false), 3000);
  };

  const handleSendReminder = async (res: Resident) => {
    await onSendPoliteReminder(res.mobile, res.fullName);
    setRemindedMap((prev) => ({ ...prev, [res.mobile]: true }));
  };

  const handlePushSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pushMessage.trim()) return;
    await onSendAdminPush({
      title: pushTitle.trim() || `${adminSession.role} Alert · Wisdom Home`,
      message: pushMessage.trim(),
      targetMobile: pushTarget,
      author: `${adminSession.role} · Wisdom Home`,
    });
    setPushTitle('');
    setPushMessage('');
    setPushSentMsg('Push notification dispatched!');
    setTimeout(() => setPushSentMsg(''), 3000);
  };

  const handleAnnouncementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annBody.trim()) return;
    await onPostAnnouncement({
      title: annTitle.trim(),
      body: annBody.trim(),
      category: annCategory,
      author: `${adminSession.role} · Wisdom Home`,
      pinned: annPinned,
      notifyResidents: annNotify,
    });
    setAnnTitle('');
    setAnnBody('');
    setAnnPinned(false);
    setAnnSavedMsg('Announcement published to feed!');
    setTimeout(() => setAnnSavedMsg(''), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header + Extra Food Broadcast + Lock Portal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-[#1A73E8]">
            {adminSession.role} Portal · Wisdom Home JP Nagar
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-[#202124] tracking-tight">
            Admin, Warden &amp; Kitchen Dashboard
          </h1>
          <p className="text-sm text-[#5F6368]">
            Manage announcements, push notifications, kitchen verification, and room-wise Lunch unlocks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={busyKey === 'EXTRA_FOOD'}
            onClick={handleBroadcast}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1E8E3E] hover:bg-[#187733] disabled:opacity-60 text-white text-sm font-medium inline-flex items-center gap-2 shadow-sm whitespace-nowrap transition-colors"
          >
            <Megaphone className="w-4 h-4" />
            {extraFoodSent ? 'Extra Food Alert Sent' : 'Broadcast Extra Food Alert'}
          </button>

          <button
            type="button"
            onClick={onOpenSetup}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#1A73E8] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <Database className="w-4 h-4" />
            {demoMode ? 'Connect Google Sheet' : 'Sheet Connected'}
          </button>

          <button
            type="button"
            onClick={onLockAdmin}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#202124] text-sm font-medium inline-flex items-center gap-2 whitespace-nowrap transition-colors"
          >
            <Lock className="w-4 h-4 text-[#5F6368]" />
            Lock Admin
          </button>
        </div>
      </div>

      {/* Admin Push Notification & Regular Announcements Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Post Regular Announcement */}
        <form
          onSubmit={handleAnnouncementSubmit}
          className="lg:col-span-7 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Newspaper className="w-5 h-5 text-[#1A73E8]" />
              <h2 className="text-base font-semibold text-[#202124]">
                Post Regular Announcement
              </h2>
            </div>
            {annSavedMsg && (
              <span className="text-xs font-semibold text-[#137333]">{annSavedMsg}</span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label htmlFor="ann-title" className="block text-xs font-medium text-[#5F6368] mb-1">
                Announcement Title
              </label>
              <input
                id="ann-title"
                type="text"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
                placeholder="e.g. Wi-Fi Maintenance Tonight"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DADCE0] text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
            <div>
              <label htmlFor="ann-cat" className="block text-xs font-medium text-[#5F6368] mb-1">
                Category
              </label>
              <select
                id="ann-cat"
                value={annCategory}
                onChange={(e) => setAnnCategory(e.target.value as AnnouncementCategory)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
              >
                <option value="General">General</option>
                <option value="Menu">Menu</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="ann-body" className="block text-xs font-medium text-[#5F6368] mb-1">
              Update Details
            </label>
            <textarea
              id="ann-body"
              rows={3}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              placeholder="Write the update for Wisdom Home JP Nagar residents..."
              className="w-full p-3.5 rounded-xl border border-[#DADCE0] text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#202124]">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annPinned}
                  onChange={(e) => setAnnPinned(e.target.checked)}
                  className="rounded border-[#DADCE0] text-[#1A73E8]"
                />
                Pin to top
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={annNotify}
                  onChange={(e) => setAnnNotify(e.target.checked)}
                  className="rounded border-[#DADCE0] text-[#1A73E8]"
                />
                Also send Push Notification
              </label>
            </div>

            <button
              type="submit"
              disabled={!annTitle.trim() || !annBody.trim() || busyKey === 'POST_ANN'}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              Publish Update
            </button>
          </div>

          {announcements.length > 0 && (
            <div className="pt-3 border-t border-[#E0E3E7] space-y-2">
              <div className="text-xs font-medium text-[#5F6368]">
                Published Updates ({announcements.length})
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {announcements.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-[#F8F9FA] border border-[#E0E3E7]"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#202124] truncate">
                        [{a.category}] {a.title}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteAnnouncement(a.id)}
                      aria-label={`Delete ${a.title}`}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-[#5F6368] hover:text-[#D93025] hover:bg-[#FCE8E6]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </form>

        {/* Admin Push Notification Broadcaster */}
        <form
          onSubmit={handlePushSubmit}
          className="lg:col-span-5 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#1A73E8]" />
              <h2 className="text-base font-semibold text-[#202124]">
                Admin Push Notification
              </h2>
            </div>
            {pushSentMsg && (
              <span className="text-xs font-semibold text-[#137333]">{pushSentMsg}</span>
            )}
          </div>

          <p className="text-xs text-[#5F6368]">
            Writes to the Google Sheets <span className="font-medium text-[#202124]">Alerts</span> tab and pops a push notification on residents&apos; phones.
          </p>

          <div>
            <label htmlFor="push-target" className="block text-xs font-medium text-[#5F6368] mb-1">
              Recipient
            </label>
            <select
              id="push-target"
              value={pushTarget}
              onChange={(e) => setPushTarget(e.target.value)}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#DADCE0] bg-white text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            >
              <option value="ALL">All Active Residents ({residents.length})</option>
              {residents.map((r) => (
                <option key={r.mobile} value={r.mobile}>
                  {r.fullName} (Room {r.roomNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="push-title" className="block text-xs font-medium text-[#5F6368] mb-1">
              Notification Title
            </label>
            <input
              id="push-title"
              type="text"
              value={pushTitle}
              onChange={(e) => setPushTitle(e.target.value)}
              placeholder="e.g. Gate Closing Reminder"
              className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#DADCE0] text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <div>
            <label htmlFor="push-msg" className="block text-xs font-medium text-[#5F6368] mb-1">
              Message
            </label>
            <textarea
              id="push-msg"
              rows={2}
              value={pushMessage}
              onChange={(e) => setPushMessage(e.target.value)}
              placeholder="Write instant alert message..."
              className="w-full p-3.5 rounded-xl border border-[#DADCE0] text-sm text-[#202124] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>

          <button
            type="submit"
            disabled={!pushMessage.trim() || busyKey === 'ADMIN_PUSH'}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#1A73E8] hover:bg-[#1765CC] disabled:opacity-50 text-white text-sm font-medium inline-flex items-center justify-center gap-2 transition-colors"
          >
            <Send className="w-4 h-4" />
            Send Push Notification
          </button>
        </form>
      </div>

      {/* Live Plate Counts Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['Breakfast', 'Lunch', 'Dinner'] as MealType[]).map((meal) => {
          const stats = plateCounts[meal];
          const isSelected = activeMeal === meal;
          return (
            <button
              key={meal}
              type="button"
              onClick={() => {
                setActiveMeal(meal);
                setConfirmReconcile(false);
                setScanFeedback(null);
              }}
              className={`text-left p-5 rounded-2xl border transition-colors ${
                isSelected
                  ? 'bg-[#E8F0FE]/60 border-[#1A73E8] shadow-sm'
                  : 'bg-white border-[#E0E3E7] hover:bg-[#F8F9FA]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[#202124]">{meal}</span>
                <span className="text-xs font-medium text-[#1A73E8]">
                  {isSelected ? 'Active Counter' : 'Select'}
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-semibold text-[#202124] tabular-nums">
                  {stats.booked}
                </span>
                <span className="text-xs text-[#5F6368] tabular-nums">
                  plates booked · {stats.eaten} eaten · {stats.pending} pending
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Kitchen Counter Verification + Reconciliation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-[#1A73E8]" />
              <h2 className="text-base font-semibold text-[#202124]">
                {activeMeal} Counter Check-In
              </h2>
            </div>

            <button
              type="button"
              onClick={scannerOn ? stopCamera : startCamera}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-medium inline-flex items-center gap-2 transition-colors ${
                scannerOn
                  ? 'bg-[#FCE8E6] text-[#A50E0E]'
                  : 'bg-[#E8F0FE] text-[#174EA6] hover:bg-[#D2E3FC]'
              }`}
            >
              {scannerOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {scannerOn ? 'Stop QR Camera' : 'Open Camera QR Scanner'}
            </button>
          </div>

          {cameraError && (
            <div className="p-3 rounded-xl bg-[#FEF7E0] border border-[#F9AB00]/30 text-xs text-[#7A4100]">
              {cameraError}
            </div>
          )}

          {scannerOn && (
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video max-h-64 flex items-center justify-center">
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-2 border-[#1A73E8]/70 rounded-2xl pointer-events-none" />
            </div>
          )}

          {scanFeedback && (
            <div
              className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-sm ${
                scanFeedback.type === 'success'
                  ? 'bg-[#E6F4EA] border-[#A8DAB5] text-[#137333]'
                  : scanFeedback.type === 'warning'
                  ? 'bg-[#FCE8E6] border-[#D93025] text-[#A50E0E] font-medium'
                  : 'bg-[#FEF7E0] border-[#F9AB00]/40 text-[#7A4100]'
              }`}
            >
              {scanFeedback.type === 'warning' ? (
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-[#D93025]" />
              ) : (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              )}
              <span>{scanFeedback.text}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={counterSearch}
                onChange={(e) => setCounterSearch(e.target.value)}
                placeholder="Quick Check-In: search resident name, room, or mobile..."
                className="w-full min-h-[44px] pl-10 pr-4 rounded-xl border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8]"
              />
            </div>

            <div className="divide-y divide-[#E0E3E7] border border-[#E0E3E7] rounded-2xl overflow-hidden max-h-72 overflow-y-auto">
              {counterResidents.map((res) => {
                const status = mealStatusLookup[res.mobile] || 'Skipping';
                const isEaten = status === 'Eaten';
                const lunchBlocked = activeMeal === 'Lunch' && !res.lunchUnlocked;
                return (
                  <div
                    key={res.mobile}
                    className="flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-[#F8F9FA]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#202124] truncate">
                        {res.fullName}
                      </div>
                      <div className="text-xs text-[#5F6368] tabular-nums">
                        Room {res.roomNumber} · {status}
                        {lunchBlocked ? ' · Lunch Locked' : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isEaten || busyKey === `CHECKIN_${res.mobile}`}
                      onClick={() => performCheckIn(res.mobile)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                        isEaten
                          ? 'bg-[#E6F4EA] text-[#137333]'
                          : lunchBlocked
                          ? 'bg-[#FCE8E6] text-[#D93025] hover:bg-[#FAD2CF]'
                          : 'bg-[#1A73E8] text-white hover:bg-[#1765CC]'
                      }`}
                    >
                      {isEaten ? 'Eaten ✓' : lunchBlocked ? 'Verify / Blocked' : 'Mark Eaten'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* End Meal & Reconcile Attendance */}
        <div className="lg:col-span-5 bg-white border border-[#E0E3E7] rounded-3xl p-5 sm:p-6 shadow-[0_1px_2px_rgba(60,64,67,0.06)] space-y-4">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-[#D93025]" />
            <h2 className="text-base font-semibold text-[#202124]">
              End Meal &amp; Reconcile Attendance
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-[#5F6368] leading-relaxed">
            When <span className="font-semibold text-[#202124]">{activeMeal}</span> service ends, reconcile attendance to flag anyone who booked <span className="font-semibold text-[#202124]">Eating</span> but never scanned in as a <span className="font-semibold text-[#D93025]">No-Show</span>.
          </p>

          <div className="p-4 rounded-2xl bg-[#F8F9FA] border border-[#E0E3E7] space-y-2 text-xs text-[#5F6368]">
            <div className="flex flex-wrap justify-between gap-2">
              <span>Unscanned {activeMeal} bookings</span>
              <span className="font-semibold text-[#202124] tabular-nums">
                {plateCounts[activeMeal].pending} residents
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>Penalty per No-Show</span>
              <span className="font-semibold text-[#D93025] tabular-nums">
                -15 🔥 Streak · Neighbor Run 0
              </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <span>3-Strike Rule</span>
              <span className="font-semibold text-[#202124]">Auto-Opt-Out after 3</span>
            </div>
          </div>

          {!confirmReconcile ? (
            <button
              type="button"
              disabled={plateCounts[activeMeal].pending === 0 || busyKey === 'RECONCILE'}
              onClick={() => setConfirmReconcile(true)}
              className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#D93025] hover:bg-[#B3261E] disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              End {activeMeal} &amp; Reconcile Attendance
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-[#FCE8E6] border border-[#F6AEA9] space-y-3">
              <div className="text-xs font-semibold text-[#A50E0E]">
                Confirm: Mark {plateCounts[activeMeal].pending} unscanned residents as No-Show?
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busyKey === 'RECONCILE'}
                  onClick={async () => {
                    await onReconcileMeal(activeMeal);
                    setConfirmReconcile(false);
                  }}
                  className="flex-1 min-h-[42px] rounded-xl bg-[#D93025] text-white text-xs font-semibold"
                >
                  {busyKey === 'RECONCILE' ? 'Reconciling...' : 'Confirm Reconcile'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReconcile(false)}
                  className="min-h-[42px] px-4 rounded-xl bg-white border border-[#DADCE0] text-xs font-medium text-[#202124]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resident Roster Grouped by Room */}
      <div className="bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
        <div className="p-4 sm:p-5 border-b border-[#E0E3E7] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#202124]">
              Warden Room Roster ({residents.length} Residents)
            </h2>
            <p className="text-xs text-[#5F6368]">
              Toggle Lunch access (₹8,500/mo Gold Meal Pass) per resident.
            </p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[#5F6368] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Filter room or resident..."
              className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#DADCE0] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:border-[#1A73E8]"
            />
          </div>
        </div>

        <div className="divide-y divide-[#E0E3E7]">
          {groupedRooms.map(([room, occupants]) => (
            <div key={room} className="p-4 sm:px-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1A73E8] tabular-nums">
                  {room.startsWith('Hall') ? room : `Room ${room}`}
                </span>
                <span className="text-xs text-[#5F6368] tabular-nums">
                  {occupants.length} {occupants.length === 1 ? 'resident' : 'residents'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {occupants.map((res) => (
                  <div
                    key={res.mobile}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#F8F9FA] border border-[#E0E3E7]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#202124] truncate">
                        {res.fullName}
                      </div>
                      <div className="text-xs text-[#5F6368] tabular-nums">
                        {res.mobile} · {res.lunchUnlocked ? '₹8,500 Gold Pass' : '₹7,500 Standard'}
                      </div>
                    </div>

                    <label className="inline-flex items-center gap-2 cursor-pointer shrink-0">
                      <span className="text-xs font-medium text-[#5F6368]">
                        Unlock Lunch
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={res.lunchUnlocked}
                        aria-label={`Unlock Lunch for ${res.fullName}`}
                        disabled={busyKey === `LUNCH_${res.mobile}`}
                        onClick={() => onToggleLunchUnlock(res.mobile, !res.lunchUnlocked)}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          res.lunchUnlocked ? 'bg-[#1E8E3E]' : 'bg-[#DADCE0]'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                            res.lunchUnlocked ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Wastage Culprits Report */}
      <div className="bg-white border border-[#E0E3E7] rounded-3xl overflow-hidden shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
        <div className="p-4 sm:p-5 border-b border-[#E0E3E7]">
          <h2 className="text-base font-semibold text-[#202124]">
            Wastage Culprits Report
          </h2>
          <p className="text-xs text-[#5F6368]">
            Sorted by highest No-Show count so staff can send a polite reminder.
          </p>
        </div>

        {/* Mobile Card List (<640px) */}
        <div className="sm:hidden divide-y divide-[#E0E3E7]">
          {culprits.map((res) => {
            const wastagePct =
              res.totalBooked > 0
                ? Math.round((res.totalNoShows / res.totalBooked) * 100)
                : 0;
            const sent = remindedMap[res.mobile];

            return (
              <div key={res.mobile} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-[#202124] truncate">
                      {res.fullName}
                    </div>
                    <div className="text-xs text-[#5F6368] tabular-nums">
                      Room {res.roomNumber} · {res.totalBooked}/{res.totalEaten} booked/eaten
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-[#D93025] tabular-nums whitespace-nowrap">
                    {res.totalNoShows} no-shows ({wastagePct}%)
                  </span>
                </div>
                <button
                  type="button"
                  disabled={sent || busyKey === `REMIND_${res.mobile}`}
                  onClick={() => handleSendReminder(res)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DADCE0] hover:bg-[#E8F0FE] hover:border-[#1A73E8] hover:text-[#174EA6] disabled:opacity-60 text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                  {sent ? 'Reminder Sent' : 'Send Polite Reminder'}
                </button>
              </div>
            );
          })}
          {culprits.length === 0 && (
            <div className="p-8 text-center text-sm text-[#5F6368]">
              Zero no-shows recorded. Great job keeping food waste at 0%!
            </div>
          )}
        </div>

        {/* Desktop & Tablet Table (>=640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F8F9FA] text-xs font-medium text-[#5F6368] border-b border-[#E0E3E7]">
                <th className="py-3 px-4">Resident</th>
                <th className="py-3 px-4">Room</th>
                <th className="py-3 px-4 text-right">Booked vs. Eaten</th>
                <th className="py-3 px-4 text-right">No-Shows</th>
                <th className="py-3 px-4 text-right">Wastage %</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0E3E7] text-sm">
              {culprits.map((res) => {
                const wastagePct =
                  res.totalBooked > 0
                    ? Math.round((res.totalNoShows / res.totalBooked) * 100)
                    : 0;
                const sent = remindedMap[res.mobile];

                return (
                  <tr key={res.mobile} className="hover:bg-[#F8F9FA]">
                    <td className="py-3 px-4 font-medium text-[#202124]">
                      {res.fullName}
                      {res.autoOptedOut && (
                        <span className="ml-2 text-xs font-semibold text-[#D93025]">
                          Auto-Paused
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-[#5F6368] tabular-nums">{res.roomNumber}</td>
                    <td className="py-3 px-4 text-right text-[#5F6368] tabular-nums">
                      {res.totalBooked} / {res.totalEaten}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#D93025] tabular-nums">
                      {res.totalNoShows}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-[#202124] tabular-nums">
                      {wastagePct}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        disabled={sent || busyKey === `REMIND_${res.mobile}`}
                        onClick={() => handleSendReminder(res)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl border border-[#DADCE0] hover:bg-[#E8F0FE] hover:border-[#1A73E8] hover:text-[#174EA6] disabled:opacity-60 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {sent ? 'Reminder Sent' : 'Send Polite Reminder'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {culprits.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-[#5F6368]">
                    Zero no-shows recorded. Great job keeping food waste at 0%!
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
