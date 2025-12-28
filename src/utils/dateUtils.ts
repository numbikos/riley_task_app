import { isSameDay, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks as addWeeksFns, subWeeks as subWeeksFns, addDays as addDaysFns, subDays as subDaysFns, startOfDay } from 'date-fns';

/**
 * Parses a date string (YYYY-MM-DD) as a local date at midnight local time.
 * This ensures dates are interpreted in the user's timezone, not UTC.
 */
const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  // Create date at midnight local time
  return new Date(year, month - 1, day);
};

/**
 * Converts a Date or string to a Date object, parsing strings as local dates.
 * Always normalizes to ensure dates are in local timezone.
 */
const toLocalDate = (date: Date | string): Date => {
  if (typeof date === 'string') {
    // If it's a date string (YYYY-MM-DD), parse as local date
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return parseLocalDate(date);
    }
    // Otherwise, parse normally and normalize to local midnight
    const d = new Date(date);
    return startOfDay(d);
  }
  // For Date objects, normalize to start of day in local timezone
  // This ensures consistent date comparisons regardless of how the Date was created
  return startOfDay(date);
};

export const formatDate = (date: Date | string): string => {
  const d = toLocalDate(date);
  // Use local timezone to match device timezone
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const isDateToday = (date: Date | string | null): boolean => {
  if (!date) return false;
  const d = toLocalDate(date);
  // Normalize to start of day for accurate comparison
  const normalizedDate = startOfDay(d);
  const today = startOfDay(new Date());
  return isSameDay(normalizedDate, today);
};

export const isDateTomorrow = (date: Date | string | null): boolean => {
  if (!date) return false;
  const d = toLocalDate(date);
  // Normalize to start of day for accurate comparison
  const normalizedDate = startOfDay(d);
  const tomorrow = startOfDay(new Date());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(normalizedDate, tomorrow);
};

export const isSameDate = (date1: Date | string | null, date2: Date | string | null): boolean => {
  if (!date1 || !date2) return false;
  const d1 = toLocalDate(date1);
  const d2 = toLocalDate(date2);
  return isSameDay(startOfDay(d1), startOfDay(d2));
};

export const getWeekDates = (date: Date = new Date()): Date[] => {
  // Normalize to start of day in local timezone
  const d = startOfDay(date);
  const weekStart = startOfWeek(d, { weekStartsOn: 0 }); // Sunday
  const weekEnd = endOfWeek(d, { weekStartsOn: 0 });
  const dates = eachDayOfInterval({ start: weekStart, end: weekEnd });
  // Ensure all dates are normalized to start of day
  return dates.map(dt => startOfDay(dt));
};

export const getNext5Days = (date: Date = new Date()): Date[] => {
  // Normalize to start of day in local timezone
  const d = startOfDay(date);
  const dates: Date[] = [];
  // Get the next 5 days starting from the given date
  for (let i = 0; i < 5; i++) {
    const nextDate = new Date(d);
    nextDate.setDate(d.getDate() + i);
    dates.push(startOfDay(nextDate));
  }
  return dates;
};

/**
 * Formats a date as MM/DD/YY
 */
const formatDateMMDDYY = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
};

export const getDateDisplay = (date: Date | string | null): string => {
  if (!date) return 'No date';
  const d = toLocalDate(date);
  if (isDateToday(date)) return 'Today';
  if (isDateTomorrow(date)) return 'Tomorrow';
  // Format: MM/DD/YY
  return formatDateMMDDYY(d);
};

/**
 * Formats a date for full display: MM/DD/YY
 */
export const formatFullDate = (date: Date | string): string => {
  const d = toLocalDate(date);
  return formatDateMMDDYY(d);
};

export const isDateOverdue = (date: Date | string | null): boolean => {
  if (!date) return false;
  const d = toLocalDate(date);
  // Normalize both dates to start of day for accurate comparison
  const normalizedDate = startOfDay(d);
  const today = startOfDay(new Date());
  // Only overdue if it's before today (not today itself)
  return normalizedDate < today;
};

export const addWeeks = (date: Date, amount: number): Date => {
  return addWeeksFns(date, amount);
};

export const subWeeks = (date: Date, amount: number): Date => {
  return subWeeksFns(date, amount);
};

export const addDays = (date: Date, amount: number): Date => {
  return addDaysFns(date, amount);
};

export const subDays = (date: Date, amount: number): Date => {
  return subDaysFns(date, amount);
};

/**
 * Formats recurrence display text for UI
 */
export const formatRecurrenceDisplay = (
  recurrence: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom' | null,
  multiplier?: number,
  customFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
): string => {
  if (!recurrence) return '';
  
  if (recurrence === 'custom' && multiplier && customFrequency) {
    const frequencyLabel = customFrequency === 'quarterly' ? 'quarters' : 
                           customFrequency === 'yearly' ? 'years' :
                           customFrequency + 's';
    return `Every ${multiplier} ${frequencyLabel}`;
  }
  
  return recurrence.charAt(0).toUpperCase() + recurrence.slice(1);
};

/**
 * Generates all recurring dates for a task (exactly 50 instances)
 * @param startDate The starting date for the recurrence
 * @param recurrence The recurrence type
 * @param multiplier For custom recurrence, the multiplier (1-50) with frequency
 * @param customFrequency For custom recurrence, the base frequency to multiply
 * @param count Number of instances to generate (default 50)
 */
export const generateRecurringDates = (
  startDate: Date | string, 
  recurrence: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom', 
  count: number = 50,
  multiplier: number = 1,
  customFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
): string[] => {
  const dates: string[] = [];
  let currentDate = toLocalDate(startDate);
  
  // For custom recurrence, use the customFrequency with multiplier
  const effectiveRecurrence = recurrence === 'custom' && customFrequency ? customFrequency : recurrence;
  const effectiveMultiplier = recurrence === 'custom' ? multiplier : 1;
  
  for (let i = 0; i < count; i++) {
    dates.push(formatDate(currentDate));
    
    const nextDate = new Date(currentDate);
    switch (effectiveRecurrence) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + (1 * effectiveMultiplier));
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * effectiveMultiplier));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + (1 * effectiveMultiplier));
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + (3 * effectiveMultiplier));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + (1 * effectiveMultiplier));
        break;
    }
    currentDate = nextDate;
  }
  
  return dates;
};
