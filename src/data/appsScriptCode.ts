export const APPS_SCRIPT_CODE = `/**
 * Wisdom Home JP Nagar — Google Apps Script Web App Backend (₹0 Cost)
 *
 * Setup Instructions:
 * 1. Open https://sheets.new and name the sheet "Wisdom Home JP Nagar Database".
 * 2. Go to Extensions -> Apps Script, delete everything, and paste this code.
 * 3. Click Save, then Deploy -> New deployment -> Select type: Web app.
 * 4. Set "Execute as": Me, and "Who has access": Anyone.
 * 5. Click Deploy, authorize permissions, copy the Web App URL, and paste it in the app.
 */

const SHEET_TABS = {
  RESIDENTS: 'Residents',
  DAILY_MEALS: 'DailyMeals',
  LAUNDRY: 'LaundryStatus',
  ALERTS: 'Alerts',
  ACTIVITY_LOG: 'ActivityLog',
  ANNOUNCEMENTS: 'Announcements',
};

const HEADERS = {
  Residents: [
    'Mobile', 'FullName', 'RoomNumber', 'Plan', 'LunchUnlocked',
    'KarmaPoints', 'GoodNeighborStreak', 'ConsecutiveNoShows',
    'AutoOptedOut', 'OptInRecoveryCount', 'TotalBooked', 'TotalEaten',
    'TotalNoShows', 'CreatedAt'
  ],
  DailyMeals: ['Date', 'Mobile', 'MealType', 'Status', 'UpdatedAt'],
  LaundryStatus: [
    'MachineId', 'MachineName', 'Status', 'ResidentMobile', 'ResidentName',
    'RoomNumber', 'DurationMins', 'StartTime', 'EndTime', 'UpdatedAt'
  ],
  Alerts: [
    'Id', 'Type', 'TargetMobile', 'Title', 'Message',
    'CreatedBy', 'CreatedAt', 'DismissedBy'
  ],
  ActivityLog: [
    'Id', 'Mobile', 'Category', 'Title', 'Detail', 'KarmaDelta', 'CreatedAt'
  ],
  Announcements: [
    'Id', 'Title', 'Body', 'Category', 'Author', 'Pinned', 'CreatedAt'
  ],
};

function getTodayIST_() {
  return Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd');
}

function nowISO_() {
  return new Date().toISOString();
}

function toBool_(v) {
  return v === true || String(v).toUpperCase() === 'TRUE' || v === 1 || v === '1';
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function appendActivity_(ss, mobile, category, title, detail, karmaDelta) {
  const sheet = ss.getSheetByName(SHEET_TABS.ACTIVITY_LOG);
  if (!sheet) return;
  sheet.appendRow([
    'ACT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    String(mobile || '').trim(),
    String(category || 'INFO'),
    String(title || ''),
    String(detail || ''),
    Number(karmaDelta || 0),
    nowISO_(),
  ]);
}

function getAdminPasscode_() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ADMIN_PASSCODE') || 'wisdom2026';
}

function ensureDatabase_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(function (tabName) {
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      sheet = ss.insertSheet(tabName);
      sheet.appendRow(HEADERS[tabName]);
      sheet.getRange(1, 1, 1, HEADERS[tabName].length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    } else if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS[tabName]);
      sheet.getRange(1, 1, 1, HEADERS[tabName].length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  });

  const laundrySheet = ss.getSheetByName(SHEET_TABS.LAUNDRY);
  if (laundrySheet.getLastRow() <= 1) {
    const now = nowISO_();
    laundrySheet.appendRow(['WM-1', 'Washing Machine 1', 'Available', '', '', '', 0, '', '', now]);
    laundrySheet.appendRow(['WM-2', 'Washing Machine 2', 'Available', '', '', '', 0, '', '', now]);
    laundrySheet.appendRow(['TERRACE', 'Terrace Drying Space', 'Plenty of Space', '', 'System', '', 0, '', '', now]);
  }
  return ss;
}

function readTable_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row.every(function (cell) { return cell === '' || cell === null; })) continue;
    const obj = { _rowIndex: i + 1 };
    headers.forEach(function (h, idx) { obj[h] = row[idx]; });
    rows.push(obj);
  }
  return rows;
}

function formatDateCell_(d) {
  if (d instanceof Date) {
    return Utilities.formatDate(d, 'Asia/Kolkata', 'yyyy-MM-dd');
  }
  return String(d || '').trim();
}

function normalizeState_(ss) {
  const today = getTodayIST_();
  const residentsRaw = readTable_(ss.getSheetByName(SHEET_TABS.RESIDENTS));
  const mealsRaw = readTable_(ss.getSheetByName(SHEET_TABS.DAILY_MEALS));
  const laundryRaw = readTable_(ss.getSheetByName(SHEET_TABS.LAUNDRY));
  const alertsRaw = readTable_(ss.getSheetByName(SHEET_TABS.ALERTS));
  const activityRaw = readTable_(ss.getSheetByName(SHEET_TABS.ACTIVITY_LOG));
  const announcementsRaw = readTable_(ss.getSheetByName(SHEET_TABS.ANNOUNCEMENTS));

  const residents = residentsRaw.map(function (r) {
    return {
      mobile: String(r.Mobile || '').trim(),
      fullName: String(r.FullName || '').trim(),
      roomNumber: String(r.RoomNumber || '').trim(),
      plan: String(r.Plan || 'Standard (₹7,500/mo)'),
      lunchUnlocked: toBool_(r.LunchUnlocked),
      karmaPoints: Number(r.KarmaPoints || 0),
      goodNeighborStreak: Number(r.GoodNeighborStreak || 0),
      consecutiveNoShows: Number(r.ConsecutiveNoShows || 0),
      autoOptedOut: toBool_(r.AutoOptedOut),
      optInRecoveryCount: Number(r.OptInRecoveryCount || 0),
      totalBooked: Number(r.TotalBooked || 0),
      totalEaten: Number(r.TotalEaten || 0),
      totalNoShows: Number(r.TotalNoShows || 0),
      createdAt: String(r.CreatedAt || ''),
    };
  });

  const allMealsNormalized = mealsRaw.map(function (m) {
    return {
      date: formatDateCell_(m.Date),
      mobile: String(m.Mobile || '').trim(),
      mealType: String(m.MealType || '').trim(),
      status: String(m.Status || 'Skipping').trim(),
      updatedAt: String(m.UpdatedAt || ''),
    };
  });

  const dailyMeals = allMealsNormalized.filter(function (m) { return m.date === today; });
  const mealHistory = allMealsNormalized.slice(-300).reverse();

  const machines = [];
  let terrace = {
    status: 'Plenty of Space',
    updatedByName: 'Wisdom Home Admin',
    updatedByMobile: '',
    updatedAt: nowISO_(),
  };

  laundryRaw.forEach(function (item) {
    const id = String(item.MachineId || '').trim();
    if (id === 'TERRACE') {
      terrace = {
        status: String(item.Status || 'Plenty of Space'),
        updatedByName: String(item.ResidentName || 'Wisdom Home Admin'),
        updatedByMobile: String(item.ResidentMobile || ''),
        updatedAt: String(item.UpdatedAt || nowISO_()),
      };
    } else if (id === 'WM-1' || id === 'WM-2') {
      let status = String(item.Status || 'Available');
      const endTime = item.EndTime ? String(item.EndTime) : '';
      if (status === 'In Use' && endTime && new Date(endTime).getTime() <= Date.now()) {
        status = 'Cycle Finished – Clothes Inside';
      }
      machines.push({
        id: id,
        name: String(item.MachineName || id),
        status: status,
        residentMobile: String(item.ResidentMobile || ''),
        residentName: String(item.ResidentName || ''),
        roomNumber: String(item.RoomNumber || ''),
        durationMins: Number(item.DurationMins || 0),
        startTime: item.StartTime ? String(item.StartTime) : '',
        endTime: endTime,
        updatedAt: String(item.UpdatedAt || ''),
      });
    }
  });

  const alerts = alertsRaw.slice(-40).reverse().map(function (a) {
    return {
      id: String(a.Id || ''),
      type: String(a.Type || 'EXTRA_FOOD'),
      targetMobile: String(a.TargetMobile || 'ALL'),
      title: String(a.Title || ''),
      message: String(a.Message || ''),
      createdBy: String(a.CreatedBy || 'Kitchen'),
      createdAt: String(a.CreatedAt || ''),
      dismissedBy: String(a.DismissedBy || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean),
    };
  });

  const announcements = announcementsRaw.slice(-50).reverse().map(function (ann) {
    return {
      id: String(ann.Id || ''),
      title: String(ann.Title || ''),
      body: String(ann.Body || ''),
      category: String(ann.Category || 'General'),
      author: String(ann.Author || 'Admin'),
      pinned: toBool_(ann.Pinned),
      createdAt: String(ann.CreatedAt || ''),
    };
  });

  const activityLog = activityRaw.slice(-200).reverse().map(function (act) {
    return {
      id: String(act.Id || ''),
      mobile: String(act.Mobile || '').trim(),
      category: String(act.Category || 'BONUS'),
      title: String(act.Title || ''),
      detail: String(act.Detail || ''),
      karmaDelta: Number(act.KarmaDelta || 0),
      createdAt: String(act.CreatedAt || ''),
    };
  });

  return {
    ok: true,
    today: today,
    serverTime: nowISO_(),
    residents: residents,
    dailyMeals: dailyMeals,
    mealHistory: mealHistory,
    machines: machines,
    terrace: terrace,
    alerts: alerts,
    announcements: announcements,
    activityLog: activityLog,
  };
}

function doGet() {
  return jsonOut_(normalizeState_(ensureDatabase_()));
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const ss = ensureDatabase_();
    const body = JSON.parse(e.postData.contents || '{}');
    const action = body.action || 'sync';
    const today = getTodayIST_();
    const now = nowISO_();

    const residentsSheet = ss.getSheetByName(SHEET_TABS.RESIDENTS);
    const mealsSheet = ss.getSheetByName(SHEET_TABS.DAILY_MEALS);
    const laundrySheet = ss.getSheetByName(SHEET_TABS.LAUNDRY);
    const alertsSheet = ss.getSheetByName(SHEET_TABS.ALERTS);
    const announcementsSheet = ss.getSheetByName(SHEET_TABS.ANNOUNCEMENTS);

    if (action === 'verifyAdmin') {
      const username = String(body.username || '').trim().toLowerCase();
      const passcode = String(body.passcode || '').trim();
      const validUsers = ['admin', 'warden', 'wisdomadmin'];
      if (!validUsers.includes(username) || passcode !== getAdminPasscode_()) {
        return jsonOut_({ ok: false, code: 'INVALID_ADMIN', error: 'Invalid Admin or Warden credentials.' });
      }
      return jsonOut_({ ok: true, authenticated: true, role: username === 'warden' ? 'Warden' : 'Admin', username: username });
    } else if (action === 'updateAdminPasscode') {
      const currentPasscode = String(body.currentPasscode || '').trim();
      const newPasscode = String(body.newPasscode || '').trim();
      if (currentPasscode !== getAdminPasscode_() || newPasscode.length < 4) {
        return jsonOut_({ ok: false, error: 'Current passcode invalid or new passcode too short.' });
      }
      PropertiesService.getScriptProperties().setProperty('ADMIN_PASSCODE', newPasscode);
      return jsonOut_({ ok: true });
    } else if (action === 'register') {
      const mobile = String(body.mobile || '').trim();
      const fullName = String(body.fullName || '').trim();
      const roomNumber = String(body.roomNumber || '').trim();
      if (!mobile || !fullName || !roomNumber) return jsonOut_({ ok: false, error: 'Name, room number, and mobile number are required.' });
      const existing = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      if (existing) return jsonOut_({ ok: false, code: 'DUPLICATE_MOBILE', error: 'This mobile number is already registered.' });
      residentsSheet.appendRow([mobile, fullName, roomNumber, 'Standard (₹7,500/mo)', false, 10, 0, 0, false, 0, 0, 0, 0, now]);
      ['Breakfast', 'Dinner'].forEach(function (meal) { mealsSheet.appendRow([today, mobile, meal, 'Eating', now]); });
      mealsSheet.appendRow([today, mobile, 'Lunch', 'Skipping', now]);
      appendActivity_(ss, mobile, 'BONUS', 'Welcome Streak Bonus', 'Joined Wisdom Home JP Nagar in Room ' + roomNumber, 10);
    } else if (action === 'toggleMeal') {
      const mobile = String(body.mobile || '').trim();
      const mealType = String(body.mealType || '').trim();
      const status = String(body.status || 'Skipping').trim();
      const resident = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      if (!resident) return jsonOut_({ ok: false, error: 'Resident not found.' });
      if (mealType === 'Lunch' && !toBool_(resident.LunchUnlocked) && status === 'Eating') {
        return jsonOut_({ ok: false, error: 'Lunch is locked on the Standard Plan.' });
      }
      const found = readTable_(mealsSheet).find(function (m) {
        return formatDateCell_(m.Date) === today && String(m.Mobile || '').trim() === mobile && String(m.MealType || '').trim() === mealType;
      });
      if (found) {
        if (String(found.Status) === 'Eaten') return jsonOut_({ ok: false, error: 'Meal already scanned and eaten today.' });
        mealsSheet.getRange(found._rowIndex, 4).setValue(status);
        mealsSheet.getRange(found._rowIndex, 5).setValue(now);
      } else {
        mealsSheet.appendRow([today, mobile, mealType, status, now]);
      }
    } else if (action === 'checkInMeal') {
      const mobile = String(body.mobile || '').trim();
      const mealType = String(body.mealType || '').trim();
      const resident = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      if (!resident) return jsonOut_({ ok: false, error: 'Resident not found.' });
      if (mealType === 'Lunch' && !toBool_(resident.LunchUnlocked)) {
        return jsonOut_({ ok: false, code: 'LUNCH_LOCKED', error: resident.FullName + ' (Room ' + resident.RoomNumber + ') has Lunch Locked (Standard Plan).' });
      }
      const found = readTable_(mealsSheet).find(function (m) {
        return formatDateCell_(m.Date) === today && String(m.Mobile || '').trim() === mobile && String(m.MealType || '').trim() === mealType;
      });
      if (found && String(found.Status) === 'Eaten') {
        return jsonOut_({ ok: false, code: 'ALREADY_EATEN', error: resident.FullName + ' was already checked in for ' + mealType + '.' });
      }
      if (found) {
        mealsSheet.getRange(found._rowIndex, 4).setValue('Eaten');
        mealsSheet.getRange(found._rowIndex, 5).setValue(now);
      } else {
        mealsSheet.appendRow([today, mobile, mealType, 'Eaten', now]);
      }
      const rRow = resident._rowIndex;
      residentsSheet.getRange(rRow, 8).setValue(0);
      residentsSheet.getRange(rRow, 11).setValue(Number(resident.TotalBooked || 0) + 1);
      residentsSheet.getRange(rRow, 12).setValue(Number(resident.TotalEaten || 0) + 1);
      if (toBool_(resident.AutoOptedOut)) {
        const nextRecovery = Number(resident.OptInRecoveryCount || 0) + 1;
        if (nextRecovery >= 3) {
          residentsSheet.getRange(rRow, 9).setValue(false);
          residentsSheet.getRange(rRow, 10).setValue(0);
        } else {
          residentsSheet.getRange(rRow, 10).setValue(nextRecovery);
        }
      }
      appendActivity_(ss, mobile, 'MEAL', mealType + ' Attended', 'Verified at kitchen counter on ' + today, 0);
    } else if (action === 'reconcileMeal') {
      const mealType = String(body.mealType || '').trim();
      const meals = readTable_(mealsSheet);
      const residentMap = {};
      readTable_(residentsSheet).forEach(function (r) { residentMap[String(r.Mobile || '').trim()] = r; });
      meals.forEach(function (m) {
        if (formatDateCell_(m.Date) === today && String(m.MealType || '').trim() === mealType && String(m.Status || '').trim() === 'Eating') {
          mealsSheet.getRange(m._rowIndex, 4).setValue('NoShow');
          mealsSheet.getRange(m._rowIndex, 5).setValue(now);
          const mobile = String(m.Mobile || '').trim();
          const res = residentMap[mobile];
          if (res) {
            const row = res._rowIndex;
            const nextConsec = Number(res.ConsecutiveNoShows || 0) + 1;
            residentsSheet.getRange(row, 6).setValue(Math.max(0, Number(res.KarmaPoints || 0) - 15));
            residentsSheet.getRange(row, 7).setValue(0);
            residentsSheet.getRange(row, 8).setValue(nextConsec);
            residentsSheet.getRange(row, 11).setValue(Number(res.TotalBooked || 0) + 1);
            residentsSheet.getRange(row, 13).setValue(Number(res.TotalNoShows || 0) + 1);
            if (nextConsec >= 3) {
              residentsSheet.getRange(row, 9).setValue(true);
              residentsSheet.getRange(row, 10).setValue(0);
            }
            appendActivity_(ss, mobile, 'PENALTY', 'Meal No-Show (' + mealType + ')', 'Booked ' + mealType + ' on ' + today + ' but missed kitchen check-in', -15);
          }
        }
      });
    } else if (action === 'toggleLunchUnlock') {
      const mobile = String(body.mobile || '').trim();
      const unlocked = Boolean(body.unlocked);
      const res = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      if (res) {
        residentsSheet.getRange(res._rowIndex, 4).setValue(unlocked ? 'Full Meal (₹8,500/mo)' : 'Standard (₹7,500/mo)');
        residentsSheet.getRange(res._rowIndex, 5).setValue(unlocked);
      }
    } else if (action === 'startWash') {
      const machineId = String(body.machineId || 'WM-1');
      const mobile = String(body.mobile || '').trim();
      const durationMins = Math.min(180, Math.max(5, Number(body.durationMins || 45)));
      const res = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      if (!res) return jsonOut_({ ok: false, error: 'Resident not found.' });
      const machine = readTable_(laundrySheet).find(function (m) { return String(m.MachineId) === machineId; });
      if (machine) {
        const endDate = new Date(Date.now() + durationMins * 60000).toISOString();
        laundrySheet.getRange(machine._rowIndex, 3).setValue('In Use');
        laundrySheet.getRange(machine._rowIndex, 4).setValue(mobile);
        laundrySheet.getRange(machine._rowIndex, 5).setValue(res.FullName);
        laundrySheet.getRange(machine._rowIndex, 6).setValue(res.RoomNumber);
        laundrySheet.getRange(machine._rowIndex, 7).setValue(durationMins);
        laundrySheet.getRange(machine._rowIndex, 8).setValue(now);
        laundrySheet.getRange(machine._rowIndex, 9).setValue(endDate);
        laundrySheet.getRange(machine._rowIndex, 10).setValue(now);
        appendActivity_(ss, mobile, 'LAUNDRY', 'Started ' + machine.MachineName, durationMins + ' min wash cycle (Room ' + res.RoomNumber + ')', 0);
      }
    } else if (action === 'markMachineAvailable') {
      const machineId = String(body.machineId || 'WM-1');
      const actorMobile = String(body.actorMobile || '').trim();
      const machine = readTable_(laundrySheet).find(function (m) { return String(m.MachineId) === machineId; });
      if (machine) {
        const endTime = machine.EndTime ? new Date(String(machine.EndTime)).getTime() : 0;
        const ownerMobile = String(machine.ResidentMobile || '').trim();
        const within10Mins = endTime > 0 && Date.now() - endTime <= 10 * 60 * 1000;
        laundrySheet.getRange(machine._rowIndex, 3).setValue('Available');
        laundrySheet.getRange(machine._rowIndex, 4).setValue('');
        laundrySheet.getRange(machine._rowIndex, 5).setValue('');
        laundrySheet.getRange(machine._rowIndex, 6).setValue('');
        laundrySheet.getRange(machine._rowIndex, 7).setValue(0);
        laundrySheet.getRange(machine._rowIndex, 8).setValue('');
        laundrySheet.getRange(machine._rowIndex, 9).setValue('');
        laundrySheet.getRange(machine._rowIndex, 10).setValue(now);
        const awardMobile = actorMobile || ownerMobile;
        if (awardMobile && (within10Mins || actorMobile !== ownerMobile)) {
          const res = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === awardMobile; });
          if (res) {
            residentsSheet.getRange(res._rowIndex, 6).setValue(Number(res.KarmaPoints || 0) + 10);
            residentsSheet.getRange(res._rowIndex, 7).setValue(Number(res.GoodNeighborStreak || 0) + 1);
            appendActivity_(ss, awardMobile, 'BONUS', 'Timely Laundry Collection', 'Cleared ' + machine.MachineName + ' within 10 mins of completion', 10);
          }
        }
      }
    } else if (action === 'nudgeClothesReady') {
      const machineId = String(body.machineId || 'WM-1');
      const senderName = String(body.senderName || 'A Resident');
      const machine = readTable_(laundrySheet).find(function (m) { return String(m.MachineId) === machineId; });
      if (machine && machine.ResidentMobile) {
        alertsSheet.appendRow([
          'ALT-' + Date.now(), 'CLOTHES_READY', String(machine.ResidentMobile).trim(),
          'Clothes Ready in ' + machine.MachineName,
          'Hey ' + machine.ResidentName + ' (Room ' + machine.RoomNumber + '), your washing machine cycle is finished! Please collect your clothes so the next person can use it.',
          senderName, now, ''
        ]);
      }
    } else if (action === 'updateTerrace') {
      const status = String(body.status || 'Plenty of Space');
      const mobile = String(body.mobile || '').trim();
      const res = readTable_(residentsSheet).find(function (r) { return String(r.Mobile || '').trim() === mobile; });
      const terrace = readTable_(laundrySheet).find(function (m) { return String(m.MachineId) === 'TERRACE'; });
      if (terrace) {
        laundrySheet.getRange(terrace._rowIndex, 3).setValue(status);
        laundrySheet.getRange(terrace._rowIndex, 4).setValue(mobile);
        laundrySheet.getRange(terrace._rowIndex, 5).setValue(res ? res.FullName : 'Resident');
        laundrySheet.getRange(terrace._rowIndex, 6).setValue(res ? res.RoomNumber : '');
        laundrySheet.getRange(terrace._rowIndex, 10).setValue(now);
      }
      if (res) {
        residentsSheet.getRange(res._rowIndex, 6).setValue(Number(res.KarmaPoints || 0) + 10);
        residentsSheet.getRange(res._rowIndex, 7).setValue(Number(res.GoodNeighborStreak || 0) + 1);
        appendActivity_(ss, mobile, 'BONUS', 'Terrace Status Update', 'Updated drying space meter to "' + status + '"', 10);
      }
    } else if (action === 'broadcastExtraFood') {
      alertsSheet.appendRow([
        'ALT-' + Date.now(), 'EXTRA_FOOD', 'ALL', 'Extra Food Alert',
        'Extra Food Alert: Hot food is still available in the dining hall! Grab a plate before it goes to waste.',
        String(body.senderName || 'Wisdom Home Kitchen'), now, ''
      ]);
    } else if (action === 'sendAdminPush') {
      const title = String(body.title || 'Wisdom Home Update').trim();
      const message = String(body.message || '').trim();
      const targetMobile = String(body.targetMobile || 'ALL').trim();
      const author = String(body.author || 'Admin').trim();
      if (!message) return jsonOut_({ ok: false, error: 'Notification message is required.' });
      alertsSheet.appendRow(['ALT-' + Date.now(), 'ADMIN_PUSH', targetMobile, title, message, author, now, '']);
    } else if (action === 'postAnnouncement') {
      const title = String(body.title || '').trim();
      const annBody = String(body.body || '').trim();
      const category = String(body.category || 'General').trim();
      const author = String(body.author || 'Admin').trim();
      const pinned = Boolean(body.pinned);
      const notifyResidents = body.notifyResidents !== false;
      if (!title || !annBody) return jsonOut_({ ok: false, error: 'Title and message are required.' });
      announcementsSheet.appendRow(['ANN-' + Date.now(), title, annBody, category, author, pinned, now]);
      if (notifyResidents) {
        alertsSheet.appendRow(['ALT-' + Date.now(), 'ANNOUNCEMENT', 'ALL', 'Notice: ' + title, annBody, author, now, '']);
      }
    } else if (action === 'deleteAnnouncement') {
      const id = String(body.id || '').trim();
      const found = readTable_(announcementsSheet).find(function (a) { return String(a.Id) === id; });
      if (found) announcementsSheet.deleteRow(found._rowIndex);
    } else if (action === 'sendPoliteReminder') {
      alertsSheet.appendRow([
        'ALT-' + Date.now(), 'POLITE_REMINDER', String(body.targetMobile || '').trim(),
        'Friendly Kitchen Reminder',
        'Hi ' + String(body.targetName || 'Resident') + ', please remember to toggle Skipping if you are eating outside so our kitchen avoids food waste!',
        'Wisdom Home Warden', now, ''
      ]);
    } else if (action === 'dismissAlert') {
      const alertId = String(body.alertId || '').trim();
      const mobile = String(body.mobile || '').trim();
      const found = readTable_(alertsSheet).find(function (a) { return String(a.Id) === alertId; });
      if (found && mobile) {
        const list = String(found.DismissedBy || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (list.indexOf(mobile) === -1) {
          list.push(mobile);
          alertsSheet.getRange(found._rowIndex, 8).setValue(list.join(','));
        }
      }
    }

    return jsonOut_(normalizeState_(ss));
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}`;
