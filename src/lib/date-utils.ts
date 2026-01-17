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
