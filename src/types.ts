export type MealType = 'Breakfast' | 'Lunch' | 'Dinner';

export type MealAttendanceStatus = 'Eating' | 'Skipping' | 'Eaten' | 'NoShow';

export type MachineStatus = 'Available' | 'In Use' | 'Cycle Finished – Clothes Inside';

export type TerraceStatus = 'Plenty of Space' | 'Filling Up' | 'Full';

export type AlertType =
  | 'EXTRA_FOOD'
  | 'CLOTHES_READY'
  | 'POLITE_REMINDER'
  | 'ADMIN_PUSH'
  | 'ANNOUNCEMENT';

export type AnnouncementCategory = 'General' | 'Menu' | 'Maintenance' | 'Urgent';

export type ActivityCategory = 'MEAL' | 'LAUNDRY' | 'PENALTY' | 'BONUS';

export type NavTab = 'meals' | 'laundry' | 'announcements' | 'leaderboard' | 'profile' | 'admin';

export interface Resident {
  mobile: string;
  fullName: string;
  roomNumber: string;
  plan: string;
  lunchUnlocked: boolean;
  karmaPoints: number;
  goodNeighborStreak: number;
  consecutiveNoShows: number;
  autoOptedOut: boolean;
  optInRecoveryCount: number;
  totalBooked: number;
  totalEaten: number;
  totalNoShows: number;
  createdAt: string;
}

export interface DailyMealRecord {
  date: string;
  mobile: string;
  mealType: MealType;
  status: MealAttendanceStatus;
  updatedAt: string;
}

export interface ActivityLogEntry {
  id: string;
  mobile: string;
  category: ActivityCategory;
  title: string;
  detail: string;
  karmaDelta: number;
  createdAt: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  category: AnnouncementCategory;
  author: string;
  pinned: boolean;
  createdAt: string;
}

export interface WashingMachine {
  id: 'WM-1' | 'WM-2';
  name: string;
  status: MachineStatus;
  residentMobile: string;
  residentName: string;
  roomNumber: string;
  durationMins: number;
  startTime: string;
  endTime: string;
  updatedAt: string;
}

export interface TerraceState {
  status: TerraceStatus;
  updatedByName: string;
  updatedByMobile: string;
  updatedAt: string;
}

export interface PGAlert {
  id: string;
  type: AlertType;
  targetMobile: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: string;
  dismissedBy: string[];
}

export interface PGState {
  today: string;
  serverTime: string;
  residents: Resident[];
  dailyMeals: DailyMealRecord[];
  mealHistory?: DailyMealRecord[];
  machines: WashingMachine[];
  terrace: TerraceState;
  alerts: PGAlert[];
  announcements?: AnnouncementItem[];
  activityLog?: ActivityLogEntry[];
}

export interface AdminSession {
  authenticated: boolean;
  role: 'Admin' | 'Warden';
  username: string;
}

export interface AppSettings {
  webAppUrl: string;
  demoMode: boolean;
  activeMobile: string;
}
