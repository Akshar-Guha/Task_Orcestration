/**
 * RRule utilities for recurring tasks
 * Based on RFC 5545 iCalendar format
 * 
 * Example rules:
 * - Daily: "FREQ=DAILY"
 * - Weekly on Mon/Wed/Fri: "FREQ=WEEKLY;BYDAY=MO,WE,FR"
 * - Monthly on the 15th: "FREQ=MONTHLY;BYMONTHDAY=15"
 * - Every 2 weeks: "FREQ=WEEKLY;INTERVAL=2"
 */

export interface RecurrenceRule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string;
  byDay?: string[];
  byMonthDay?: number[];
  byMonth?: number[];
}

/**
 * Parse RRule string into structured object
 */
export function parseRRule(rruleString: string): RecurrenceRule | null {
  if (!rruleString) return null;

  const parts = rruleString.split(';');
  const rule: Partial<RecurrenceRule> = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    switch (key) {
      case 'FREQ':
        rule.frequency = value as RecurrenceRule['frequency'];
        break;
      case 'INTERVAL':
        rule.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        rule.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        rule.until = value;
        break;
      case 'BYDAY':
        rule.byDay = value.split(',');
        break;
      case 'BYMONTHDAY':
        rule.byMonthDay = value.split(',').map(v => parseInt(v, 10));
        break;
      case 'BYMONTH':
        rule.byMonth = value.split(',').map(v => parseInt(v, 10));
        break;
    }
  }

  if (!rule.frequency) return null;
  return rule as RecurrenceRule;
}

/**
 * Convert structured rule to RRule string
 */
export function toRRuleString(rule: RecurrenceRule): string {
  const parts: string[] = [`FREQ=${rule.frequency}`];

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }
  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }
  if (rule.until) {
    parts.push(`UNTIL=${rule.until}`);
  }
  if (rule.byDay?.length) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }
  if (rule.byMonthDay?.length) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }
  if (rule.byMonth?.length) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }

  return parts.join(';');
}

/**
 * Get next occurrence date based on rule
 */
export function getNextOccurrence(rule: RecurrenceRule, fromDate: Date = new Date()): Date {
  const next = new Date(fromDate);
  const interval = rule.interval || 1;

  switch (rule.frequency) {
    case 'DAILY':
      next.setDate(next.getDate() + interval);
      break;
    case 'WEEKLY':
      next.setDate(next.getDate() + (7 * interval));
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + interval);
      break;
    case 'YEARLY':
      next.setFullYear(next.getFullYear() + interval);
      break;
  }

  return next;
}

/**
 * Generate occurrence dates for a period
 */
export function generateOccurrences(
  rule: RecurrenceRule,
  startDate: Date,
  endDate: Date
): Date[] {
  const occurrences: Date[] = [];
  let current = new Date(startDate);
  let count = 0;
  const maxCount = rule.count || 100;

  while (current <= endDate && count < maxCount) {
    occurrences.push(new Date(current));
    current = getNextOccurrence(rule, current);
    count++;
  }

  return occurrences;
}

// Common presets
export const RECURRENCE_PRESETS = {
  DAILY: 'FREQ=DAILY',
  WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  WEEKLY: 'FREQ=WEEKLY',
  BIWEEKLY: 'FREQ=WEEKLY;INTERVAL=2',
  MONTHLY: 'FREQ=MONTHLY',
  YEARLY: 'FREQ=YEARLY',
} as const;
