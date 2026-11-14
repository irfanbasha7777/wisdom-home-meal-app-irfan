import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  BellOff,
  Database,
  LogOut,
  Newspaper,
  RefreshCw,
  ShieldCheck,
  Trophy,
  User,
  Utensils,
  WashingMachine,
} from 'lucide-react';
import { AddToHomeBanner } from './components/AddToHomeBanner';
import { AdminKitchenTab } from './components/AdminKitchenTab';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AlertBanners } from './components/AlertBanners';
import { AnnouncementsTab } from './components/AnnouncementsTab';
import { LaundryTerraceTab } from './components/LaundryTerraceTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { MealsTab } from './components/MealsTab';
import { ProfilePage } from './components/ProfilePage';
import { RegistrationCard } from './components/RegistrationCard';
import { SheetsSetupModal } from './components/SheetsSetupModal';
import {
  getNotificationPermission,
  isPushEnabledPref,
  loadNotifiedLaundryKeys,
  loadSeenAlertIds,
  PushPermissionState,
  registerNotificationServiceWorker,
  requestNotificationPermission,
  saveNotifiedLaundryKeys,
  saveSeenAlertIds,
  sendWebPushNotification,
  setPushEnabledPref,
} from './services/notifications';
import {
  loadSettings,
  pgApi,
  resetDemoState,
  saveSettings,
} from './services/pgApi';
import {
  AdminSession,
  AnnouncementCategory,
  AppSettings,
  MealAttendanceStatus,
  MealType,
  NavTab,
  PGState,
  TerraceStatus,
} from './types';

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [pgState, setPgState] = useState<PGState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [activeTab, setActiveTab] = useState<NavTab>('meals');
  const [setupOpen, setSetupOpen] = useState(false);
  const [adminLoginOpen, setAdminLoginOpen] = useState(false);
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [busyMeal, setBusyMeal] = useState<MealType | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Push Notification state
  const [pushPermission, setPushPermission] = useState<PushPermissionState>(() =>
    getNotificationPermission()
  );
  const [pushEnabled, setPushEnabled] = useState<boolean>(() => isPushEnabledPref());
  const seenAlertIdsRef = useRef<Set<string>>(loadSeenAlertIds());
  const notifiedLaundryRef = useRef<Set<string>>(loadNotifiedLaundryKeys());
  const prevMachineStatusesRef = useRef<Record<string, string>>({});

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3800);
  }, []);

  useEffect(() => {
    registerNotificationServiceWorker();
  }, []);

  const refreshState = useCallback(
    async (currentSettings: AppSettings, quiet = false) => {
      if (!quiet) setSyncing(true);
      try {
        const next = await pgApi.fetchState(currentSettings);
        setPgState(next);
        setSyncError('');
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : 'Unable to sync with Google Sheets.');
      } finally {
        setLoading(false);
        setSyncing(false);
      }
    },
    []
  );

  useEffect(() => {
    refreshState(settings);
  }, [refreshState, settings]);

  // Poll Google Sheets every 15 seconds when live Sheet backend is active
  useEffect(() => {
    if (settings.demoMode || !settings.webAppUrl.trim()) return;
    const timer = setInterval(() => {
      refreshState(settings, true);
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshState, settings]);

  const updateSettings = (next: AppSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const activeResident = useMemo(() => {
    if (!pgState || !settings.activeMobile) return null;
    return pgState.residents.find((r) => r.mobile === settings.activeMobile) || null;
  }, [pgState, settings.activeMobile]);

  // Dispatch Web Push Notifications when new rows arrive in Google Sheets Alerts tab
  useEffect(() => {
    if (!pgState || (!activeResident && !adminSession?.authenticated)) return;
    const seen = seenAlertIdsRef.current;
    const isInitialSeed = seen.size === 0;
    const twoMinutesAgo = Date.now() - 2 * 60000;
    let changed = false;

    pgState.alerts.forEach((alert) => {
      if (seen.has(alert.id)) return;
      seen.add(alert.id);
      changed = true;

      const myMobile = activeResident?.mobile || '';
      const targetsMe = alert.targetMobile === 'ALL' || (myMobile && alert.targetMobile === myMobile);
      const dismissed = myMobile ? alert.dismissedBy.includes(myMobile) : false;
      const createdMs = alert.createdAt ? new Date(alert.createdAt).getTime() : Date.now();

      if (targetsMe && !dismissed && (!isInitialSeed || createdMs >= twoMinutesAgo)) {
        sendWebPushNotification({
          title: alert.title || 'Wisdom Home Alert',
          body: alert.message,
          tag: `alert-${alert.id}`,
        });
        showToast(`${alert.title}: ${alert.message}`);
      }
    });

    if (changed) {
      saveSeenAlertIds(seen);
    }
  }, [activeResident, adminSession, pgState, showToast]);

  // Monitor Washing Machine status transitions -> notify when finished OR when washing machine is free!
  useEffect(() => {
    if (!pgState) return;
    const prevMap = prevMachineStatusesRef.current;
    const nextMap: Record<string, string> = {};

    pgState.machines.forEach((m) => {
      const prevStatus = prevMap[m.id];
      nextMap[m.id] = m.status;

      // Pop notification when a previously busy/finished machine becomes Available ("washing machine is free")
      if (
        prevStatus &&
        prevStatus !== 'Available' &&
        m.status === 'Available'
      ) {
        const title = 'Washing Machine Free';
        const body = `Washing machine is free (${m.name} is now available to use!)`;
        sendWebPushNotification({
          title,
          body,
          tag: `wm-free-${m.id}-${Date.now()}`,
        });
        showToast(`Washing machine is free — ${m.name} is ready!`);
      }
    });

    prevMachineStatusesRef.current = nextMap;
  }, [pgState, showToast]);

  // Monitor Washing Machine countdowns & push notify owner when cycle finishes
  useEffect(() => {
    if (!pgState || !activeResident) return;

    const checkFinishedMachines = () => {
      const notified = notifiedLaundryRef.current;
      let changed = false;

      pgState.machines.forEach((m) => {
        if (m.residentMobile !== activeResident.mobile) return;
        const endMs = m.endTime ? new Date(m.endTime).getTime() : 0;
        const finished =
          m.status === 'Cycle Finished – Clothes Inside' ||
          (m.status === 'In Use' && endMs > 0 && Date.now() >= endMs);

        if (!finished || !m.endTime) return;
        const key = `${m.id}:${m.endTime}`;
        if (notified.has(key)) return;

        notified.add(key);
        changed = true;

        const title = `${m.name} Cycle Finished`;
        const body = `Hey ${activeResident.fullName} (Room ${activeResident.roomNumber}), your wash cycle is done! Collect within 10 mins for +10 🔥 Streak.`;

        sendWebPushNotification({ title, body, tag: `laundry-${m.id}` });
        showToast(`${title} — collect clothes for +10 🔥 Streak!`);
      });

      if (changed) {
        saveNotifiedLaundryKeys(notified);
      }
    };

    checkFinishedMachines();
    const timer = setInterval(checkFinishedMachines, 2000);
    return () => clearInterval(timer);
  }, [activeResident, pgState, showToast]);

  const handleEnablePush = async () => {
    const result = await requestNotificationPermission();
    setPushPermission(result);
    if (result === 'granted') {
      setPushEnabled(true);
      setPushEnabledPref(true);
      await sendWebPushNotification({
        title: 'Wisdom Home JP Nagar Alerts Active',
        body: 'You will get notifications for announcements, surplus food, and when a washing machine is free.',
        tag: 'wisdom-welcome-push',
      });
      showToast('Push notifications enabled!');
    } else if (result === 'denied') {
      showToast('Browser blocked notifications. In-app banners will still appear.');
    } else {
      showToast('Browser notifications unavailable here. In-app banners active.');
    }
  };

  const handleTogglePushPref = (enabled: boolean) => {
    setPushEnabled(enabled);
    setPushEnabledPref(enabled);
    showToast(enabled ? 'Push notifications resumed.' : 'Push notifications paused.');
  };

  const handleTestPush = async () => {
    const delivered = await sendWebPushNotification({
      title: 'Washing Machine Free',
      body: 'Washing machine is free — Washing Machine 1 is ready to use!',
      tag: `wisdom-test-${Date.now()}`,
    });
    showToast(
      delivered
        ? 'Test push notification sent!'
        : 'In-app alert triggered (enable browser permission for OS notifications).'
    );
  };

  const handleAdminAuthenticate = async (username: string, passcode: string) => {
    const session = await pgApi.verifyAdmin(settings, { username, passcode });
    setAdminSession(session);
    setActiveTab('admin');
    showToast(`Signed in as ${session.role}.`);
  };

  const handleLockAdmin = () => {
    setAdminSession(null);
    setActiveTab('meals');
    showToast('Admin & Warden portal locked.');
  };

  const handleRegister = async (payload: {
    fullName: string;
    roomNumber: string;
    mobile: string;
  }) => {
    const nextState = await pgApi.register(settings, payload);
    setPgState(nextState);
    updateSettings({ ...settings, activeMobile: payload.mobile });
    setActiveTab('meals');
    showToast(`Welcome ${payload.fullName}! Standard Plan activated.`);
  };

  const handleSignIn = (mobile: string) => {
    updateSettings({ ...settings, activeMobile: mobile });
    setActiveTab('meals');
  };

  const handleSignOut = () => {
    updateSettings({ ...settings, activeMobile: '' });
  };

  const handleToggleMeal = async (mealType: MealType, status: MealAttendanceStatus) => {
    if (!activeResident) return;
    setBusyMeal(mealType);
    try {
      const next = await pgApi.toggleMeal(settings, {
        mobile: activeResident.mobile,
        mealType,
        status,
      });
      setPgState(next);
      showToast(`${mealType} set to ${status}.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update meal.');
    } finally {
      setBusyMeal(null);
    }
  };

  const handleStartWash = async (machineId: 'WM-1' | 'WM-2', durationMins: number) => {
    if (!activeResident) return;
    setBusyAction(machineId);
    try {
      const next = await pgApi.startWash(settings, {
        machineId,
        mobile: activeResident.mobile,
        durationMins,
      });
      setPgState(next);
      showToast(`${machineId} started for ${durationMins} mins.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleMarkAvailable = async (machineId: 'WM-1' | 'WM-2') => {
    if (!activeResident) return;
    setBusyAction(machineId);
    try {
      const prevStreak = activeResident.karmaPoints;
      const next = await pgApi.markMachineAvailable(settings, {
        machineId,
        actorMobile: activeResident.mobile,
      });
      setPgState(next);
      const updated = next.residents.find((r) => r.mobile === activeResident.mobile);
      if (updated && updated.karmaPoints > prevStreak) {
        showToast(`${machineId} is free! +10 🔥 Streak earned.`);
      } else {
        showToast('Washing machine is free!');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleNudgeOwner = async (machineId: 'WM-1' | 'WM-2') => {
    if (!activeResident) return;
    setBusyAction(machineId);
    try {
      const next = await pgApi.nudgeClothesReady(settings, {
        machineId,
        senderName: activeResident.fullName,
      });
      setPgState(next);
      showToast('Sent "Clothes Ready" alert & push notification to the owner.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSimulateFinish = async (machineId: 'WM-1' | 'WM-2') => {
    setBusyAction(machineId);
    try {
      const next = await pgApi.simulateFinishWash(settings, machineId);
      setPgState(next);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateTerrace = async (status: TerraceStatus) => {
    if (!activeResident) return;
    setBusyAction('TERRACE');
    try {
      const next = await pgApi.updateTerrace(settings, {
        status,
        mobile: activeResident.mobile,
      });
      setPgState(next);
      showToast(`Terrace updated to "${status}" (+10 🔥 Streak!).`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleCheckInMeal = async (mobile: string, mealType: MealType) => {
    setBusyAction(`CHECKIN_${mobile}`);
    try {
      const next = await pgApi.checkInMeal(settings, { mobile, mealType });
      setPgState(next);
    } finally {
      setBusyAction(null);
    }
  };

  const handleReconcileMeal = async (mealType: MealType) => {
    setBusyAction('RECONCILE');
    try {
      const next = await pgApi.reconcileMeal(settings, mealType);
      setPgState(next);
      showToast(`${mealType} attendance reconciled & No-Shows updated.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleBroadcastExtraFood = async () => {
    setBusyAction('EXTRA_FOOD');
    try {
      const next = await pgApi.broadcastExtraFood(
        settings,
        adminSession ? `${adminSession.role} · Wisdom Home` : 'Wisdom Home Kitchen'
      );
      setPgState(next);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendAdminPush = async (payload: {
    title: string;
    message: string;
    targetMobile: string;
    author: string;
  }) => {
    setBusyAction('ADMIN_PUSH');
    try {
      const next = await pgApi.sendAdminPush(settings, payload);
      setPgState(next);
      showToast('Admin push notification sent!');
    } finally {
      setBusyAction(null);
    }
  };

  const handlePostAnnouncement = async (payload: {
    title: string;
    body: string;
    category: AnnouncementCategory;
    author: string;
    pinned: boolean;
    notifyResidents: boolean;
  }) => {
    setBusyAction('POST_ANN');
    try {
      const next = await pgApi.postAnnouncement(settings, payload);
      setPgState(next);
      showToast('Announcement published!');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    setBusyAction(`DEL_ANN_${id}`);
    try {
      const next = await pgApi.deleteAnnouncement(settings, id);
      setPgState(next);
      showToast('Announcement removed.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleLunchUnlock = async (mobile: string, unlocked: boolean) => {
    setBusyAction(`LUNCH_${mobile}`);
    try {
      const next = await pgApi.toggleLunchUnlock(settings, { mobile, unlocked });
      setPgState(next);
      showToast(unlocked ? 'Gold Pass Lunch unlocked (₹8,500 Plan).' : 'Reverted to Standard Plan.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSendPoliteReminder = async (targetMobile: string, targetName: string) => {
    setBusyAction(`REMIND_${targetMobile}`);
    try {
      const next = await pgApi.sendPoliteReminder(settings, { targetMobile, targetName });
      setPgState(next);
      showToast(`Polite reminder sent to ${targetName}.`);
    } finally {
      setBusyAction(null);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    if (!activeResident) return;
    const next = await pgApi.dismissAlert(settings, {
      alertId,
      mobile: activeResident.mobile,
    });
    setPgState(next);
  };

  if (loading && !pgState) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="bg-white border border-[#E0E3E7] rounded-2xl px-6 py-5 text-sm text-[#5F6368] flex items-center gap-3 shadow-sm">
          <RefreshCw className="w-4 h-4 animate-spin text-[#1A73E8]" />
          Loading Wisdom Home JP Nagar...
        </div>
      </div>
    );
  }

  // Standalone authenticated Admin / Warden view when staff signs in from landing screen without resident profile
  const isStaffOnlyView = !activeResident && adminSession?.authenticated;

  return (
    <>
      {!activeResident && !isStaffOnlyView ? (
        <RegistrationCard
          residents={pgState?.residents || []}
          demoMode={settings.demoMode}
          onRegister={handleRegister}
          onSignIn={handleSignIn}
          onOpenSetup={() => setSetupOpen(true)}
          onOpenAdminLogin={() => setAdminLoginOpen(true)}
        />
      ) : (
        <div className="min-h-screen bg-[#F8F9FA] pb-24 overflow-x-hidden">
          {/* Compact Sticky Top Header (No PG Logo) */}
          <header className="sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E0E3E7]">
            <div className="max-w-6xl mx-auto h-full px-2.5 sm:px-6 flex items-center justify-between gap-1.5 sm:gap-4">
              {activeResident ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`min-h-[40px] px-2 sm:px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 sm:gap-2 min-w-0 transition-colors ${
                    activeTab === 'profile'
                      ? 'bg-[#E8F0FE] text-[#174EA6]'
                      : 'hover:bg-[#F1F3F4] text-[#202124]'
                  }`}
                  title="Open Resident Profile & History"
                >
                  <User className="w-4 h-4 text-[#1A73E8] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold truncate">
                    {activeResident.fullName}
                  </span>
                  <span className="hidden min-[380px]:inline text-xs text-[#5F6368] tabular-nums whitespace-nowrap shrink-0">
                    · {activeResident.roomNumber}
                  </span>
                </button>
              ) : (
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-[#1A73E8] shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-[#202124] truncate">
                    Wisdom Home · {adminSession?.role}
                  </span>
                </div>
              )}

              <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                {activeResident && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('profile')}
                    className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-xl bg-[#FEF7E0] text-[#7A4100] text-xs font-semibold tabular-nums whitespace-nowrap hover:bg-[#FDEFC7] transition-colors"
                    title="View Streak & History"
                  >
                    🔥 {activeResident.karmaPoints}
                    <span className="hidden sm:inline">Streak</span>
                  </button>
                )}

                {adminSession?.authenticated && activeTab !== 'admin' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className="min-h-[36px] px-2 sm:px-2.5 rounded-xl bg-[#E8F0FE] text-[#174EA6] text-[11px] sm:text-xs font-semibold whitespace-nowrap"
                  >
                    {adminSession.role}
                    <span className="hidden sm:inline"> Panel</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={
                    pushPermission === 'granted'
                      ? () => activeResident && setActiveTab('profile')
                      : handleEnablePush
                  }
                  aria-label="Push Notifications"
                  title={
                    pushPermission === 'granted' && pushEnabled
                      ? 'Push Notifications Active'
                      : 'Enable Push Notifications'
                  }
                  className={`min-h-[38px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl transition-colors ${
                    pushPermission === 'granted' && pushEnabled
                      ? 'text-[#1E8E3E] bg-[#E6F4EA]/70 hover:bg-[#E6F4EA]'
                      : 'text-[#5F6368] hover:bg-[#F1F3F4]'
                  }`}
                >
                  {pushPermission === 'granted' && pushEnabled ? (
                    <Bell className="w-4 h-4" />
                  ) : (
                    <BellOff className="w-4 h-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => refreshState(settings)}
                  aria-label="Sync with Google Sheet"
                  className="min-h-[38px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-[#1A73E8]' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  aria-label="Google Sheets Setup"
                  className="min-h-[38px] min-w-[36px] sm:min-w-0 px-2 sm:px-3 rounded-xl border border-[#DADCE0] hover:bg-[#F8F9FA] text-xs font-medium text-[#1A73E8] inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">
                    {settings.demoMode ? 'Demo Mode' : 'Sheet Live'}
                  </span>
                </button>

                {activeResident && (
                  <button
                    type="button"
                    onClick={handleSignOut}
                    aria-label="Switch Resident"
                    title="Switch Resident"
                    className="min-h-[38px] min-w-[36px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-[#5F6368] hover:bg-[#F1F3F4] transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Main Content Container */}
          <main className="max-w-6xl mx-auto px-3 sm:px-6 pt-4 sm:pt-7">
            <AddToHomeBanner />

            {syncError && (
              <div className="mb-4 p-3.5 rounded-2xl bg-[#FCE8E6] border border-[#F6AEA9] text-xs sm:text-sm text-[#A50E0E] flex items-center justify-between gap-3">
                <span>Google Sheet sync warning: {syncError}</span>
                <button
                  type="button"
                  onClick={() => setSetupOpen(true)}
                  className="text-xs font-semibold underline whitespace-nowrap"
                >
                  Check Setup
                </button>
              </div>
            )}

            {activeResident && (
              <AlertBanners
                alerts={pgState?.alerts || []}
                residentMobile={activeResident.mobile}
                onDismiss={handleDismissAlert}
              />
            )}

            {activeResident && activeTab === 'meals' && pgState && (
              <MealsTab
                resident={activeResident}
                today={pgState.today}
                dailyMeals={pgState.dailyMeals}
                busyMeal={busyMeal}
                onToggleMeal={handleToggleMeal}
              />
            )}

            {activeResident && activeTab === 'laundry' && pgState && (
              <LaundryTerraceTab
                resident={activeResident}
                machines={pgState.machines}
                terrace={pgState.terrace}
                demoMode={settings.demoMode}
                busyAction={busyAction}
                onStartWash={handleStartWash}
                onMarkAvailable={handleMarkAvailable}
                onNudgeOwner={handleNudgeOwner}
                onSimulateFinish={handleSimulateFinish}
                onUpdateTerrace={handleUpdateTerrace}
              />
            )}

            {activeTab === 'announcements' && pgState && (
              <AnnouncementsTab announcements={pgState.announcements || []} />
            )}

            {activeResident && activeTab === 'leaderboard' && pgState && (
              <LeaderboardTab
                residents={pgState.residents}
                activeMobile={activeResident.mobile}
              />
            )}

            {activeResident && activeTab === 'profile' && pgState && (
              <ProfilePage
                resident={activeResident}
                mealHistory={pgState.mealHistory || pgState.dailyMeals}
                activityLog={pgState.activityLog || []}
                machines={pgState.machines}
                demoMode={settings.demoMode}
                pushPermission={pushPermission}
                pushEnabled={pushEnabled}
                onEnablePush={handleEnablePush}
                onTogglePushPref={handleTogglePushPref}
                onTestPush={handleTestPush}
                onOpenAdminLogin={() => setAdminLoginOpen(true)}
                onBack={() => setActiveTab('meals')}
              />
            )}

            {(activeTab === 'admin' || isStaffOnlyView) &&
              adminSession?.authenticated &&
              pgState && (
                <AdminKitchenTab
                  adminSession={adminSession}
                  today={pgState.today}
                  residents={pgState.residents}
                  dailyMeals={pgState.dailyMeals}
                  announcements={pgState.announcements || []}
                  busyKey={busyAction}
                  onLockAdmin={handleLockAdmin}
                  onCheckInMeal={handleCheckInMeal}
                  onReconcileMeal={handleReconcileMeal}
                  onBroadcastExtraFood={handleBroadcastExtraFood}
                  onSendAdminPush={handleSendAdminPush}
                  onPostAnnouncement={handlePostAnnouncement}
                  onDeleteAnnouncement={handleDeleteAnnouncement}
                  onToggleLunchUnlock={handleToggleLunchUnlock}
                  onSendPoliteReminder={handleSendPoliteReminder}
                />
              )}
          </main>

          {/* Toast Feedback */}
          {toast && (
            <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 px-4 py-2.5 rounded-xl bg-[#202124] text-white text-xs sm:text-sm font-medium shadow-lg max-w-[92vw] truncate">
              {toast}
            </div>
          )}

          {/* Fixed Bottom Navigation Bar (Resident Public Tabs Only — Admin/Warden hidden behind login) */}
          {activeResident && (
            <nav
              aria-label="Primary Navigation"
              className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl z-40 bg-white/95 backdrop-blur-md border-t md:border border-[#E0E3E7] md:rounded-2xl md:shadow-lg pb-safe"
            >
              <div className="grid grid-cols-4 h-16">
                {(
                  [
                    { id: 'meals', label: 'Meals', icon: Utensils },
                    { id: 'laundry', label: 'Laundry & Terrace', icon: WashingMachine },
                    { id: 'announcements', label: 'Updates', icon: Newspaper },
                    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
                  ] as const
                ).map((tab) => {
                  const Icon = tab.icon;
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex flex-col items-center justify-center gap-1 px-1 transition-colors ${
                        active ? 'text-[#1A73E8]' : 'text-[#5F6368] hover:text-[#202124]'
                      }`}
                    >
                      <div
                        className={`px-3 py-1 rounded-full transition-colors ${
                          active ? 'bg-[#E8F0FE]' : ''
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] sm:text-[11px] font-medium tracking-tight whitespace-nowrap truncate max-w-full">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </nav>
          )}
        </div>
      )}

      <AdminLoginModal
        open={adminLoginOpen}
        onClose={() => setAdminLoginOpen(false)}
        onAuthenticate={handleAdminAuthenticate}
      />

      <SheetsSetupModal
        open={setupOpen}
        settings={settings}
        onClose={() => setSetupOpen(false)}
        onSaveSettings={(next) => {
          updateSettings(next);
          refreshState(next);
        }}
        onTestConnection={async (url) => {
          const state = await pgApi.testConnection(url);
          setPgState(state);
        }}
        onResetDemo={() => {
          const fresh = resetDemoState();
          setPgState(fresh);
          if (
            settings.activeMobile &&
            !fresh.residents.some((r) => r.mobile === settings.activeMobile)
          ) {
            updateSettings({ ...settings, activeMobile: '' });
          }
        }}
      />
    </>
  );
}
