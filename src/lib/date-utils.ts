/**
 * Date/Time Utilities
 * 
 * Handles timezone-aware date operations for the app.
 * Uses local timezone (client's timezone) for all date calculations.
 */

/**
 * Get today's date in YYYY-MM-DD format using LOCAL timezone (not UTC)
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Check if a date string (YYYY-MM-DD) is today in local timezone
 */
export function isToday(dateString: string): boolean {
  return dateString === getLocalDateString();
}

/**
 * Check if a date string (YYYY-MM-DD) is yesterday in local timezone
 */
export function isYesterday(dateString: string): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return dateString === getLocalDateString(yesterday);
}

/**
 * Format a date string for display
 * Returns: "Jan 18" format with day name
 */
export function formatDateForDisplay(dateString: string): {
  month: string;
  day: number;
  dayName: string;
  isToday: boolean;
  isYesterday: boolean;
} {
  // Parse the date string as local date (not UTC)
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
    dayName: days[date.getDay()],
    isToday: isToday(dateString),
    isYesterday: isYesterday(dateString),
  };
}

/**
 * Get current time as HH:MM string in local timezone
 */
export function getLocalTimeString(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Get ISO timestamp with timezone offset
 */
export function getLocalISOString(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const offsetHours = Math.floor(Math.abs(offset) / 60);
  const offsetMinutes = Math.abs(offset) % 60;
  const offsetSign = offset >= 0 ? '+' : '-';
  const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
  
  return now.toISOString().replace('Z', offsetStr);
}

// ========================================
// SLEEP & TIME CALCULATION UTILITIES
// ========================================

/**
 * Parse "HH:MM" time string into total minutes since midnight.
 */
export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Calculate sleep minutes from a sleep start time to now,
 * correctly handling midnight crossover.
 */
export function calculateSleepMinutesSoFar(sleepTime: string): number {
  const sleepStartMins = parseTimeToMinutes(sleepTime);
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  if (currentMins >= sleepStartMins) {
    return currentMins - sleepStartMins;
  }
  // Crossed midnight: e.g. slept at 23:00, now 06:00
  return (1440 - sleepStartMins) + currentMins;
}

/**
 * Calculate sleep duration between a sleep time and wake time,
 * correctly handling midnight crossover.
 * Both times are "HH:MM" strings.
 */
export function calculateSleepDuration(sleepTime: string, wakeTime: string): number {
  const sleepMins = parseTimeToMinutes(sleepTime);
  const wakeMins = parseTimeToMinutes(wakeTime);

  if (wakeMins > sleepMins) {
    // Same-day sleep (e.g. nap 14:00 -> 16:00)
    return wakeMins - sleepMins;
  }
  // Normal overnight: e.g. 23:00 -> 07:00
  return (1440 - sleepMins) + wakeMins;
}

/**
 * Get yesterday's date string in YYYY-MM-DD format (local timezone).
 */
export function getYesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateString(d);
}

/**
 * Get the Monday of the current week as YYYY-MM-DD.
 */
export function getMondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return getLocalDateString(monday);
}
