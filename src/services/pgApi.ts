import {
  ActivityCategory,
  AdminSession,
  AnnouncementCategory,
  AppSettings,
  MealAttendanceStatus,
  MealType,
  PGState,
  TerraceStatus,
} from '../types';
import { createDemoSeed, getTodayISTDate } from '../data/demoSeed';

const SETTINGS_KEY = 'wisdom_settings_v1';
const DEMO_STATE_KEY = 'wisdom_demo_state_v1';
const DEMO_ADMIN_PASSCODE_KEY = 'wisdom_demo_admin_passcode_v1';

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        webAppUrl: String(parsed.webAppUrl || ''),
        demoMode: parsed.demoMode !== undefined ? Boolean(parsed.demoMode) : !parsed.webAppUrl,
        activeMobile: String(parsed.activeMobile || ''),
      };
    }
  } catch {
    // ignore storage errors
  }
  return {
    webAppUrl: '',
    demoMode: true,
    activeMobile: '',
  };
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export function loadDemoState(): PGState {
  try {
    const raw = localStorage.getItem(DEMO_STATE_KEY);
    if (raw) {
      const parsed: PGState = JSON.parse(raw);
      const now = Date.now();
      parsed.machines = parsed.machines.map((m) => {
        if (m.status === 'In Use' && m.endTime && new Date(m.endTime).getTime() <= now) {
          return { ...m, status: 'Cycle Finished – Clothes Inside' };
        }
        return m;
      });
      if (!parsed.mealHistory) parsed.mealHistory = parsed.dailyMeals;
      if (!parsed.activityLog) parsed.activityLog = [];
      if (!parsed.announcements) parsed.announcements = createDemoSeed().announcements;
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  const seed = createDemoSeed();
  saveDemoState(seed);
  return seed;
}

export function saveDemoState(state: PGState): void {
  try {
    localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function resetDemoState(): PGState {
  const seed = createDemoSeed();
  saveDemoState(seed);
  return seed;
}

function getDemoAdminPasscode(): string {
  try {
    return localStorage.getItem(DEMO_ADMIN_PASSCODE_KEY) || 'wisdom2026';
  } catch {
    return 'wisdom2026';
  }
}

function pushDemoActivity(
  state: PGState,
  mobile: string,
  category: ActivityCategory,
  title: string,
  detail: string,
  karmaDelta: number
) {
  if (!state.activityLog) state.activityLog = [];
  state.activityLog.unshift({
    id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    mobile,
    category,
    title,
    detail,
    karmaDelta,
    createdAt: new Date().toISOString(),
  });
}

function syncMealHistory(
  state: PGState,
  date: string,
  mobile: string,
  mealType: MealType,
  status: MealAttendanceStatus,
  updatedAt: string
) {
  if (!state.mealHistory) state.mealHistory = [];
  const existing = state.mealHistory.find(
    (m) => m.date === date && m.mobile === mobile && m.mealType === mealType
  );
  if (existing) {
    existing.status = status;
    existing.updatedAt = updatedAt;
  } else {
    state.mealHistory.unshift({ date, mobile, mealType, status, updatedAt });
  }
}

async function callAppsScript<T = PGState>(
  webAppUrl: string,
  payload?: Record<string, unknown>
): Promise<T> {
  if (!webAppUrl.trim()) {
    throw new Error('Google Sheets Web App URL is not configured.');
  }

  const res = payload
    ? await fetch(webAppUrl.trim(), {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      })
    : await fetch(webAppUrl.trim(), { method: 'GET' });

  if (!res.ok) {
    throw new Error(`Google Sheets API responded with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (data && data.ok === false) {
    const err = new Error(data.error || 'Action failed on Google Sheets.') as Error & {
      code?: string;
    };
    err.code = data.code;
    throw err;
  }

  return data as T;
}

function runDemoMutation(mutator: (state: PGState) => PGState): PGState {
  const current = loadDemoState();
  const next = mutator(structuredClone(current));
  next.serverTime = new Date().toISOString();
  saveDemoState(next);
  return next;
}

export const pgApi = {
  async fetchState(settings: AppSettings): Promise<PGState> {
    if (settings.demoMode || !settings.webAppUrl.trim()) {
      return loadDemoState();
    }
    return callAppsScript(settings.webAppUrl);
  },

  async testConnection(webAppUrl: string): Promise<PGState> {
    return callAppsScript(webAppUrl);
  },

  async verifyAdmin(
    settings: AppSettings,
    payload: { username: string; passcode: string }
  ): Promise<AdminSession> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript<AdminSession>(settings.webAppUrl, {
        action: 'verifyAdmin',
        ...payload,
      });
    }
    const cleanUser = payload.username.trim().toLowerCase();
    const cleanPass = payload.passcode.trim();
    const validUsers = ['admin', 'warden', 'wisdomadmin'];
    if (!validUsers.includes(cleanUser) || cleanPass !== getDemoAdminPasscode()) {
      throw new Error('Invalid Admin or Warden credentials.');
    }
    return {
      authenticated: true,
      role: cleanUser === 'warden' ? 'Warden' : 'Admin',
      username: cleanUser,
    };
  },

  async register(
    settings: AppSettings,
    payload: { fullName: string; roomNumber: string; mobile: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'register', ...payload });
    }
    const mobile = payload.mobile.trim();
    const fullName = payload.fullName.trim();
    const roomNumber = payload.roomNumber.trim();
    return runDemoMutation((state) => {
      const exists = state.residents.find((r) => r.mobile === mobile);
      if (exists) {
        const err = new Error('This mobile number is already registered.') as Error & { code?: string };
        err.code = 'DUPLICATE_MOBILE';
        throw err;
      }
      const now = new Date().toISOString();
      const today = getTodayISTDate();
      state.residents.push({
        mobile,
        fullName,
        roomNumber,
        plan: 'Standard (₹7,500/mo)',
        lunchUnlocked: false,
        karmaPoints: 10,
        goodNeighborStreak: 0,
        consecutiveNoShows: 0,
        autoOptedOut: false,
        optInRecoveryCount: 0,
        totalBooked: 0,
        totalEaten: 0,
        totalNoShows: 0,
        createdAt: now,
      });
      const initialMeals: { mealType: MealType; status: MealAttendanceStatus }[] = [
        { mealType: 'Breakfast', status: 'Eating' },
        { mealType: 'Lunch', status: 'Skipping' },
        { mealType: 'Dinner', status: 'Eating' },
      ];
      initialMeals.forEach(({ mealType, status }) => {
        state.dailyMeals.push({ date: today, mobile, mealType, status, updatedAt: now });
        syncMealHistory(state, today, mobile, mealType, status, now);
      });
      pushDemoActivity(
        state,
        mobile,
        'BONUS',
        'Welcome Streak Bonus',
        `Joined Wisdom Home JP Nagar in Room ${roomNumber}`,
        10
      );
      return state;
    });
  },

  async toggleMeal(
    settings: AppSettings,
    payload: { mobile: string; mealType: MealType; status: MealAttendanceStatus }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'toggleMeal', ...payload });
    }
    return runDemoMutation((state) => {
      const resident = state.residents.find((r) => r.mobile === payload.mobile);
      if (!resident) throw new Error('Resident not found.');
      if (payload.mealType === 'Lunch' && !resident.lunchUnlocked && payload.status === 'Eating') {
        throw new Error('Lunch is locked on the Standard Plan.');
      }
      const today = state.today || getTodayISTDate();
      const now = new Date().toISOString();
      const existing = state.dailyMeals.find(
        (m) => m.date === today && m.mobile === payload.mobile && m.mealType === payload.mealType
      );
      if (existing) {
        if (existing.status === 'Eaten') {
          throw new Error('Meal already scanned and eaten today.');
        }
        existing.status = payload.status;
        existing.updatedAt = now;
      } else {
        state.dailyMeals.push({
          date: today,
          mobile: payload.mobile,
          mealType: payload.mealType,
          status: payload.status,
          updatedAt: now,
        });
      }
      syncMealHistory(state, today, payload.mobile, payload.mealType, payload.status, now);
      return state;
    });
  },

  async checkInMeal(
    settings: AppSettings,
    payload: { mobile: string; mealType: MealType }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'checkInMeal', ...payload });
    }
    return runDemoMutation((state) => {
      const resident = state.residents.find((r) => r.mobile === payload.mobile);
      if (!resident) throw new Error('Resident not found.');
      if (payload.mealType === 'Lunch' && !resident.lunchUnlocked) {
        const err = new Error(
          `${resident.fullName} (Room ${resident.roomNumber}) has Lunch Locked on the Standard Plan (₹7,500/mo).`
        ) as Error & { code?: string };
        err.code = 'LUNCH_LOCKED';
        throw err;
      }
      const today = state.today || getTodayISTDate();
      const now = new Date().toISOString();
      const existing = state.dailyMeals.find(
        (m) => m.date === today && m.mobile === payload.mobile && m.mealType === payload.mealType
      );
      if (existing && existing.status === 'Eaten') {
        const err = new Error(
          `${resident.fullName} was already checked in for ${payload.mealType}.`
        ) as Error & { code?: string };
        err.code = 'ALREADY_EATEN';
        throw err;
      }
      if (existing) {
        existing.status = 'Eaten';
        existing.updatedAt = now;
      } else {
        state.dailyMeals.push({
          date: today,
          mobile: payload.mobile,
          mealType: payload.mealType,
          status: 'Eaten',
          updatedAt: now,
        });
      }
      syncMealHistory(state, today, payload.mobile, payload.mealType, 'Eaten', now);
      resident.consecutiveNoShows = 0;
      resident.totalBooked += 1;
      resident.totalEaten += 1;
      if (resident.autoOptedOut) {
        resident.optInRecoveryCount += 1;
        if (resident.optInRecoveryCount >= 3) {
          resident.autoOptedOut = false;
          resident.optInRecoveryCount = 0;
        }
      }
      pushDemoActivity(
        state,
        payload.mobile,
        'MEAL',
        `${payload.mealType} Attended`,
        `Verified at kitchen counter on ${today}`,
        0
      );
      return state;
    });
  },

  async reconcileMeal(settings: AppSettings, mealType: MealType): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'reconcileMeal', mealType });
    }
    return runDemoMutation((state) => {
      const today = state.today || getTodayISTDate();
      const now = new Date().toISOString();
      state.dailyMeals.forEach((m) => {
        if (m.date === today && m.mealType === mealType && m.status === 'Eating') {
          m.status = 'NoShow';
          m.updatedAt = now;
          syncMealHistory(state, today, m.mobile, mealType, 'NoShow', now);
          const res = state.residents.find((r) => r.mobile === m.mobile);
          if (res) {
            res.karmaPoints = Math.max(0, res.karmaPoints - 15);
            res.goodNeighborStreak = 0;
            res.consecutiveNoShows += 1;
            res.totalBooked += 1;
            res.totalNoShows += 1;
            if (res.consecutiveNoShows >= 3) {
              res.autoOptedOut = true;
              res.optInRecoveryCount = 0;
            }
            pushDemoActivity(
              state,
              m.mobile,
              'PENALTY',
              `Meal No-Show (${mealType})`,
              `Booked ${mealType} on ${today} but missed kitchen check-in`,
              -15
            );
          }
        }
      });
      return state;
    });
  },

  async toggleLunchUnlock(
    settings: AppSettings,
    payload: { mobile: string; unlocked: boolean }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'toggleLunchUnlock', ...payload });
    }
    return runDemoMutation((state) => {
      const res = state.residents.find((r) => r.mobile === payload.mobile);
      if (res) {
        res.lunchUnlocked = payload.unlocked;
        res.plan = payload.unlocked ? 'Full Meal (₹8,500/mo)' : 'Standard (₹7,500/mo)';
      }
      return state;
    });
  },

  async startWash(
    settings: AppSettings,
    payload: { machineId: 'WM-1' | 'WM-2'; mobile: string; durationMins: number }
  ): Promise<PGState> {
    const cleanMins = Math.min(180, Math.max(5, Math.round(payload.durationMins || 45)));
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, {
        action: 'startWash',
        machineId: payload.machineId,
        mobile: payload.mobile,
        durationMins: cleanMins,
      });
    }
    return runDemoMutation((state) => {
      const res = state.residents.find((r) => r.mobile === payload.mobile);
      if (!res) throw new Error('Resident not found.');
      const machine = state.machines.find((m) => m.id === payload.machineId);
      if (machine) {
        const now = Date.now();
        machine.status = 'In Use';
        machine.residentMobile = res.mobile;
        machine.residentName = res.fullName;
        machine.roomNumber = res.roomNumber;
        machine.durationMins = cleanMins;
        machine.startTime = new Date(now).toISOString();
        machine.endTime = new Date(now + cleanMins * 60000).toISOString();
        machine.updatedAt = new Date(now).toISOString();
        pushDemoActivity(
          state,
          res.mobile,
          'LAUNDRY',
          `Started ${machine.name}`,
          `${cleanMins} min wash cycle (Room ${res.roomNumber})`,
          0
        );
      }
      return state;
    });
  },

  async simulateFinishWash(
    settings: AppSettings,
    machineId: 'WM-1' | 'WM-2'
  ): Promise<PGState> {
    return runDemoMutation((state) => {
      const machine = state.machines.find((m) => m.id === machineId);
      if (machine && machine.status === 'In Use') {
        machine.status = 'Cycle Finished – Clothes Inside';
        machine.endTime = new Date(Date.now() - 60000).toISOString();
        machine.updatedAt = new Date().toISOString();
      }
      return state;
    });
  },

  async markMachineAvailable(
    settings: AppSettings,
    payload: { machineId: 'WM-1' | 'WM-2'; actorMobile: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'markMachineAvailable', ...payload });
    }
    return runDemoMutation((state) => {
      const machine = state.machines.find((m) => m.id === payload.machineId);
      if (machine) {
        const endMs = machine.endTime ? new Date(machine.endTime).getTime() : 0;
        const ownerMobile = machine.residentMobile;
        const within10Mins = endMs > 0 && Date.now() - endMs <= 10 * 60000;
        const awardMobile = payload.actorMobile || ownerMobile;

        machine.status = 'Available';
        machine.residentMobile = '';
        machine.residentName = '';
        machine.roomNumber = '';
        machine.durationMins = 0;
        machine.startTime = '';
        machine.endTime = '';
        machine.updatedAt = new Date().toISOString();

        if (awardMobile && (within10Mins || payload.actorMobile !== ownerMobile)) {
          const res = state.residents.find((r) => r.mobile === awardMobile);
          if (res) {
            res.karmaPoints += 10;
            res.goodNeighborStreak += 1;
            pushDemoActivity(
              state,
              awardMobile,
              'BONUS',
              'Timely Laundry Collection',
              `Cleared ${machine.name} within 10 mins of completion`,
              10
            );
          }
        }
      }
      return state;
    });
  },

  async nudgeClothesReady(
    settings: AppSettings,
    payload: { machineId: 'WM-1' | 'WM-2'; senderName: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'nudgeClothesReady', ...payload });
    }
    return runDemoMutation((state) => {
      const machine = state.machines.find((m) => m.id === payload.machineId);
      if (machine && machine.residentMobile) {
        state.alerts.unshift({
          id: `ALT-${Date.now()}`,
          type: 'CLOTHES_READY',
          targetMobile: machine.residentMobile,
          title: `Clothes Ready in ${machine.name}`,
          message: `Hey ${machine.residentName} (Room ${machine.roomNumber}), your washing machine cycle is finished! Please collect your clothes so the next person can use it.`,
          createdBy: payload.senderName,
          createdAt: new Date().toISOString(),
          dismissedBy: [],
        });
      }
      return state;
    });
  },

  async updateTerrace(
    settings: AppSettings,
    payload: { status: TerraceStatus; mobile: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'updateTerrace', ...payload });
    }
    return runDemoMutation((state) => {
      const res = state.residents.find((r) => r.mobile === payload.mobile);
      state.terrace = {
        status: payload.status,
        updatedByName: res ? res.fullName : 'Resident',
        updatedByMobile: payload.mobile,
        updatedAt: new Date().toISOString(),
      };
      if (res) {
        res.karmaPoints += 10;
        res.goodNeighborStreak += 1;
        pushDemoActivity(
          state,
          payload.mobile,
          'BONUS',
          'Terrace Status Update',
          `Updated drying space meter to "${payload.status}"`,
          10
        );
      }
      return state;
    });
  },

  async broadcastExtraFood(settings: AppSettings, senderName: string): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'broadcastExtraFood', senderName });
    }
    return runDemoMutation((state) => {
      state.alerts.unshift({
        id: `ALT-${Date.now()}`,
        type: 'EXTRA_FOOD',
        targetMobile: 'ALL',
        title: 'Extra Food Alert',
        message:
          'Extra Food Alert: Hot food is still available in the dining hall! Grab a plate before it goes to waste.',
        createdBy: senderName,
        createdAt: new Date().toISOString(),
        dismissedBy: [],
      });
      return state;
    });
  },

  async sendAdminPush(
    settings: AppSettings,
    payload: { title: string; message: string; targetMobile: string; author: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'sendAdminPush', ...payload });
    }
    return runDemoMutation((state) => {
      state.alerts.unshift({
        id: `ALT-${Date.now()}`,
        type: 'ADMIN_PUSH',
        targetMobile: payload.targetMobile || 'ALL',
        title: payload.title.trim() || 'Wisdom Home Update',
        message: payload.message.trim(),
        createdBy: payload.author,
        createdAt: new Date().toISOString(),
        dismissedBy: [],
      });
      return state;
    });
  },

  async postAnnouncement(
    settings: AppSettings,
    payload: {
      title: string;
      body: string;
      category: AnnouncementCategory;
      author: string;
      pinned: boolean;
      notifyResidents: boolean;
    }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'postAnnouncement', ...payload });
    }
    return runDemoMutation((state) => {
      if (!state.announcements) state.announcements = [];
      const now = new Date().toISOString();
      state.announcements.unshift({
        id: `ANN-${Date.now()}`,
        title: payload.title.trim(),
        body: payload.body.trim(),
        category: payload.category,
        author: payload.author,
        pinned: payload.pinned,
        createdAt: now,
      });
      if (payload.notifyResidents) {
        state.alerts.unshift({
          id: `ALT-${Date.now()}`,
          type: 'ANNOUNCEMENT',
          targetMobile: 'ALL',
          title: `Notice: ${payload.title.trim()}`,
          message: payload.body.trim(),
          createdBy: payload.author,
          createdAt: now,
          dismissedBy: [],
        });
      }
      return state;
    });
  },

  async deleteAnnouncement(settings: AppSettings, id: string): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'deleteAnnouncement', id });
    }
    return runDemoMutation((state) => {
      state.announcements = (state.announcements || []).filter((a) => a.id !== id);
      return state;
    });
  },

  async sendPoliteReminder(
    settings: AppSettings,
    payload: { targetMobile: string; targetName: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'sendPoliteReminder', ...payload });
    }
    return runDemoMutation((state) => {
      state.alerts.unshift({
        id: `ALT-${Date.now()}`,
        type: 'POLITE_REMINDER',
        targetMobile: payload.targetMobile,
        title: 'Friendly Kitchen Reminder',
        message: `Hi ${payload.targetName}, please remember to toggle Skipping if you are eating outside so our kitchen avoids food waste!`,
        createdBy: 'Wisdom Home Warden',
        createdAt: new Date().toISOString(),
        dismissedBy: [],
      });
      return state;
    });
  },

  async dismissAlert(
    settings: AppSettings,
    payload: { alertId: string; mobile: string }
  ): Promise<PGState> {
    if (!settings.demoMode && settings.webAppUrl.trim()) {
      return callAppsScript(settings.webAppUrl, { action: 'dismissAlert', ...payload });
    }
    return runDemoMutation((state) => {
      const alert = state.alerts.find((a) => a.id === payload.alertId);
      if (alert && payload.mobile && !alert.dismissedBy.includes(payload.mobile)) {
        alert.dismissedBy.push(payload.mobile);
      }
      return state;
    });
  },
};
