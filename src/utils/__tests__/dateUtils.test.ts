import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  formatDate,
  isDateToday,
  isDateTomorrow,
  isSameDate,
  getWeekDates,
  getNext5Days,
  getDateDisplay,
  formatFullDate,
  isDateOverdue,
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  formatRecurrenceDisplay,
  generateRecurringDates,
} from '../dateUtils';

describe('dateUtils', () => {
  beforeEach(() => {
    // Mock current date to 2024-01-15 for consistent testing
    // Use local date to avoid timezone issues
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12, 0, 0)); // Jan 15, 2024, 12:00 PM local time
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format Date object as YYYY-MM-DD', () => {
      const date = new Date(2024, 0, 15); // January 15, 2024
      expect(formatDate(date)).toBe('2024-01-15');
    });

    it('should format date string as YYYY-MM-DD', () => {
      expect(formatDate('2024-01-15')).toBe('2024-01-15');
    });

    it('should pad single digit months and days', () => {
      const date = new Date(2024, 0, 5); // January 5, 2024
      expect(formatDate(date)).toBe('2024-01-05');
    });
  });

  describe('isDateToday', () => {
    it('should return true for today', () => {
      expect(isDateToday('2024-01-15')).toBe(true);
    });

    it('should return false for yesterday', () => {
      expect(isDateToday('2024-01-14')).toBe(false);
    });

    it('should return false for tomorrow', () => {
      expect(isDateToday('2024-01-16')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isDateToday(null)).toBe(false);
    });

    it('should handle Date objects', () => {
      const today = new Date('2024-01-15T12:00:00.000Z');
      expect(isDateToday(today)).toBe(true);
    });
  });

  describe('isDateTomorrow', () => {
    it('should return true for tomorrow', () => {
      expect(isDateTomorrow('2024-01-16')).toBe(true);
    });

    it('should return false for today', () => {
      expect(isDateTomorrow('2024-01-15')).toBe(false);
    });

    it('should return false for day after tomorrow', () => {
      expect(isDateTomorrow('2024-01-17')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isDateTomorrow(null)).toBe(false);
    });
  });

  describe('isSameDate', () => {
    it('should return true for same dates', () => {
      expect(isSameDate('2024-01-15', '2024-01-15')).toBe(true);
    });

    it('should return false for different dates', () => {
      expect(isSameDate('2024-01-15', '2024-01-16')).toBe(false);
    });

    it('should return false if first date is null', () => {
      expect(isSameDate(null, '2024-01-15')).toBe(false);
    });

    it('should return false if second date is null', () => {
      expect(isSameDate('2024-01-15', null)).toBe(false);
    });

    it('should handle Date objects', () => {
      const date1 = new Date('2024-01-15T12:00:00.000Z');
      const date2 = new Date('2024-01-15T18:00:00.000Z');
      expect(isSameDate(date1, date2)).toBe(true);
    });
  });

  describe('getWeekDates', () => {
    it('should return 7 dates for a week', () => {
      const dates = getWeekDates(new Date('2024-01-15'));
      expect(dates).toHaveLength(7);
    });

    it('should start with Sunday', () => {
      const dates = getWeekDates(new Date('2024-01-15')); // Monday
      expect(formatDate(dates[0])).toBe('2024-01-14'); // Sunday
    });

    it('should end with Saturday', () => {
      const dates = getWeekDates(new Date('2024-01-15')); // Monday
      expect(formatDate(dates[6])).toBe('2024-01-20'); // Saturday
    });

    it('should use current date if no date provided', () => {
      const dates = getWeekDates();
      expect(dates).toHaveLength(7);
    });
  });

  describe('getNext5Days', () => {
    it('should return 5 dates', () => {
      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const dates = getNext5Days(testDate);
      expect(dates).toHaveLength(5);
    });

    it('should start from the given date', () => {
      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const dates = getNext5Days(testDate);
      expect(formatDate(dates[0])).toBe('2024-01-15');
    });

    it('should include the next 4 days', () => {
      const testDate = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const dates = getNext5Days(testDate);
      expect(formatDate(dates[1])).toBe('2024-01-16');
      expect(formatDate(dates[2])).toBe('2024-01-17');
      expect(formatDate(dates[3])).toBe('2024-01-18');
      expect(formatDate(dates[4])).toBe('2024-01-19');
    });

    it('should use current date if no date provided', () => {
      const dates = getNext5Days();
      expect(dates).toHaveLength(5);
    });
  });

  describe('getDateDisplay', () => {
    it('should return "Today" for today', () => {
      expect(getDateDisplay('2024-01-15')).toBe('Today');
    });

    it('should return "Tomorrow" for tomorrow', () => {
      expect(getDateDisplay('2024-01-16')).toBe('Tomorrow');
    });

    it('should return formatted date for other dates', () => {
      expect(getDateDisplay('2024-01-20')).toBe('01/20/24');
    });

    it('should return "No date" for null', () => {
      expect(getDateDisplay(null)).toBe('No date');
    });
  });

  describe('formatFullDate', () => {
    it('should format date as MM/DD/YY', () => {
      expect(formatFullDate('2024-01-15')).toBe('01/15/24');
    });

    it('should pad single digit months and days', () => {
      expect(formatFullDate('2024-01-05')).toBe('01/05/24');
    });
  });

  describe('isDateOverdue', () => {
    it('should return true for dates before today', () => {
      expect(isDateOverdue('2024-01-14')).toBe(true);
    });

    it('should return false for today', () => {
      expect(isDateOverdue('2024-01-15')).toBe(false);
    });

    it('should return false for future dates', () => {
      expect(isDateOverdue('2024-01-16')).toBe(false);
    });

    it('should return false for null', () => {
      expect(isDateOverdue(null)).toBe(false);
    });
  });

  describe('addWeeks', () => {
    it('should add weeks to a date', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = addWeeks(date, 2);
      expect(formatDate(result)).toBe('2024-01-29');
    });
  });

  describe('subWeeks', () => {
    it('should subtract weeks from a date', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = subWeeks(date, 2);
      expect(formatDate(result)).toBe('2024-01-01');
    });
  });

  describe('addDays', () => {
    it('should add days to a date', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = addDays(date, 5);
      expect(formatDate(result)).toBe('2024-01-20');
    });
  });

  describe('subDays', () => {
    it('should subtract days from a date', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const result = subDays(date, 5);
      expect(formatDate(result)).toBe('2024-01-10');
    });
  });

  describe('formatRecurrenceDisplay', () => {
    it('should format daily recurrence', () => {
      expect(formatRecurrenceDisplay('daily')).toBe('Daily');
    });

    it('should format weekly recurrence', () => {
      expect(formatRecurrenceDisplay('weekly')).toBe('Weekly');
    });

    it('should format monthly recurrence', () => {
      expect(formatRecurrenceDisplay('monthly')).toBe('Monthly');
    });

    it('should format custom recurrence with multiplier', () => {
      expect(formatRecurrenceDisplay('custom', 2, 'weekly')).toBe('Every 2 weeklys');
    });

    it('should format custom quarterly recurrence', () => {
      expect(formatRecurrenceDisplay('custom', 3, 'quarterly')).toBe('Every 3 quarters');
    });

    it('should format custom yearly recurrence', () => {
      expect(formatRecurrenceDisplay('custom', 1, 'yearly')).toBe('Every 1 years');
    });

    it('should return empty string for null', () => {
      expect(formatRecurrenceDisplay(null)).toBe('');
    });
  });

  describe('generateRecurringDates', () => {
    it('should generate daily recurring dates', () => {
      const dates = generateRecurringDates('2024-01-15', 'daily', 5);
      expect(dates).toHaveLength(5);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2024-01-16');
      expect(dates[2]).toBe('2024-01-17');
      expect(dates[3]).toBe('2024-01-18');
      expect(dates[4]).toBe('2024-01-19');
    });

    it('should generate weekly recurring dates', () => {
      const dates = generateRecurringDates('2024-01-15', 'weekly', 3);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2024-01-22');
      expect(dates[2]).toBe('2024-01-29');
    });

    it('should generate monthly recurring dates', () => {
      const dates = generateRecurringDates('2024-01-15', 'monthly', 3);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2024-02-15');
      expect(dates[2]).toBe('2024-03-15');
    });

    it('should generate quarterly recurring dates', () => {
      const dates = generateRecurringDates('2024-01-15', 'quarterly', 2);
      expect(dates).toHaveLength(2);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2024-04-15');
    });

    it('should generate yearly recurring dates', () => {
      const dates = generateRecurringDates('2024-01-15', 'yearly', 2);
      expect(dates).toHaveLength(2);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2025-01-15');
    });

    it('should generate custom recurring dates with multiplier', () => {
      const dates = generateRecurringDates('2024-01-15', 'custom', 3, 2, 'weekly');
      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe('2024-01-15');
      expect(dates[1]).toBe('2024-01-29'); // 2 weeks later
      expect(dates[2]).toBe('2024-02-12'); // 4 weeks later
    });

    it('should default to 50 instances', () => {
      const dates = generateRecurringDates('2024-01-15', 'daily');
      expect(dates).toHaveLength(50);
    });

    it('should handle Date objects', () => {
      const date = new Date(2024, 0, 15); // Jan 15, 2024 local time
      const dates = generateRecurringDates(date, 'daily', 3);
      expect(dates).toHaveLength(3);
      expect(dates[0]).toBe('2024-01-15');
    });
  });
});

