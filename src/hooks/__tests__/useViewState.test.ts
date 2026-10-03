// Run in a US timezone, where parsing 'YYYY-MM-DD' as UTC lands on the previous local day
process.env.TZ = 'America/Los_Angeles';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { useViewState } from '../useViewState';
import { formatDate } from '../../utils/dateUtils';

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const user = { id: 'user-1' } as User;

describe('useViewState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 2, 9, 0, 0)); // Mon Mar 2 2026, 9am local
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts Today on the current day even if yesterday was saved', () => {
    localStorage.setItem('riley-view-state', JSON.stringify({
      currentView: 'today',
      selectedDayDate: null,
      weekViewDate: null,
      todayViewDate: new Date(2026, 2, 1).toISOString(),
      tomorrowViewDate: new Date(2026, 2, 2).toISOString(),
    }));

    const { result } = renderHook(() => useViewState(user));

    expect(formatDate(result.current.todayViewDate)).toBe('2026-03-02');
    expect(formatDate(result.current.tomorrowViewDate)).toBe('2026-03-03');
  });

  it('keeps a saved Upcoming date that is still in the future', () => {
    localStorage.setItem('riley-view-state', JSON.stringify({
      currentView: 'tomorrow',
      selectedDayDate: null,
      weekViewDate: null,
      todayViewDate: new Date(2026, 2, 2).toISOString(),
      tomorrowViewDate: new Date(2026, 2, 10).toISOString(),
    }));

    const { result } = renderHook(() => useViewState(user));

    expect(formatDate(result.current.tomorrowViewDate)).toBe('2026-03-10');
  });

  it('reads the day view date from the URL as a local date', () => {
    window.history.replaceState(null, '', '#day-2026-03-05');

    const { result } = renderHook(() => useViewState(user));

    expect(result.current.currentView).toBe('day');
    expect(formatDate(result.current.selectedDayDate!)).toBe('2026-03-05');
    expect(window.location.hash).toBe('#day-2026-03-05');
  });

  it('rolls Today and Upcoming forward when the day changes while the app is open', () => {
    const { result } = renderHook(() => useViewState(user));
    expect(formatDate(result.current.todayViewDate)).toBe('2026-03-02');

    act(() => {
      vi.setSystemTime(new Date(2026, 2, 3, 7, 30, 0));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(formatDate(result.current.todayViewDate)).toBe('2026-03-03');
    expect(formatDate(result.current.tomorrowViewDate)).toBe('2026-03-04');
  });
});
