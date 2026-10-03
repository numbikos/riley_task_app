import { useState, useEffect, useRef, useCallback } from 'react';
import { ViewType } from '../types';
import { loadViewState, saveViewState } from '../utils/storage';
import type { User } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { formatDate, parseLocalDate } from '../utils/dateUtils';

const VIEW_STATE_SAVE_DEBOUNCE_MS = 500;
const DAY_ROLLOVER_CHECK_MS = 60000;
const VALID_VIEWS: ViewType[] = ['today', 'tomorrow', 'week', 'all', 'completed', 'day', 'stats'];

const getToday = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getTomorrow = (): Date => {
  const tomorrow = getToday();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
};

/**
 * Parse URL hash to extract view and optional day date
 * Format: #view or #day-YYYY-MM-DD
 */
const parseHash = (): { view: ViewType | null; dayDate: Date | null } => {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) return { view: null, dayDate: null };

  // Check for day view with date: #day-2025-01-14
  if (hash.startsWith('day-')) {
    const dateStr = hash.slice(4);
    // Parse as a local date (new Date('YYYY-MM-DD') is UTC, i.e. the previous day in US timezones)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const date = parseLocalDate(dateStr);
      if (!isNaN(date.getTime())) {
        return { view: 'day', dayDate: date };
      }
    }
  }

  // Check for valid view name
  if (VALID_VIEWS.includes(hash as ViewType)) {
    return { view: hash as ViewType, dayDate: null };
  }

  return { view: null, dayDate: null };
};

/**
 * Build URL hash from view and optional day date
 */
const buildHash = (view: ViewType, dayDate: Date | null): string => {
  if (view === 'day' && dayDate) {
    return `#day-${formatDate(dayDate)}`;
  }
  return `#${view}`;
};

/**
 * Get initial view from hash, then localStorage, then default
 */
const getInitialView = (): { view: ViewType; dayDate: Date | null } => {
  // First try URL hash
  const { view: hashView, dayDate } = parseHash();
  if (hashView) {
    logger.debug('[useViewState] Initial view from hash:', hashView);
    return { view: hashView, dayDate };
  }

  // Then try localStorage
  const savedViewState = loadViewState();
  if (savedViewState?.currentView) {
    logger.debug('[useViewState] Initial view from localStorage:', savedViewState.currentView);
    return {
      view: savedViewState.currentView,
      dayDate: savedViewState.selectedDayDate ? new Date(savedViewState.selectedDayDate) : null
    };
  }

  // Default to today
  logger.debug('[useViewState] Initial view default: today');
  return { view: 'today', dayDate: null };
};

/**
 * Custom hook for managing view state with hash-based routing
 */
export const useViewState = (user: User | null) => {
  const savedViewState = loadViewState();
  const initialState = getInitialView();

  // Track if this is the initial mount (to distinguish login from refresh)
  const isInitialMount = useRef(true);
  const previousUserRef = useRef<User | null>(null);

  const [currentView, setCurrentViewInternal] = useState<ViewType>(initialState.view);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(() => {
    // First check if we got a day date from the hash
    if (initialState.dayDate) {
      return initialState.dayDate;
    }
    // Then check localStorage
    if (savedViewState?.selectedDayDate) {
      const date = new Date(savedViewState.selectedDayDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  });
  const [weekViewDate, setWeekViewDate] = useState<Date | null>(() => {
    if (savedViewState?.weekViewDate) {
      const date = new Date(savedViewState.weekViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return null;
  });
  // Today view always starts on the actual current day - a saved date would be stale the next day
  const [todayViewDate, setTodayViewDate] = useState<Date>(getToday);
  const [tomorrowViewDate, setTomorrowViewDate] = useState<Date>(() => {
    const tomorrow = getTomorrow();
    if (savedViewState?.tomorrowViewDate) {
      const date = new Date(savedViewState.tomorrowViewDate);
      date.setHours(0, 0, 0, 0);
      // Only restore a saved date that hasn't passed yet
      if (!isNaN(date.getTime()) && date >= tomorrow) {
        return date;
      }
    }
    return tomorrow;
  });
  const currentDayRef = useRef(formatDate(new Date()));
  const [searchQuery, setSearchQuery] = useState('');
  const saveTimeoutRef = useRef<number | null>(null);

  // Wrapped setCurrentView that also updates URL hash and history
  const setCurrentView = useCallback((view: ViewType, options?: { replaceState?: boolean; dayDate?: Date | null }) => {
    setCurrentViewInternal(view);

    // Build the hash for this view
    const dayDate = options?.dayDate ?? (view === 'day' ? selectedDayDate : null);
    const hash = buildHash(view, dayDate);

    // Update URL hash with history
    if (options?.replaceState) {
      window.history.replaceState({ view, dayDate: dayDate?.toISOString() }, '', hash);
    } else {
      window.history.pushState({ view, dayDate: dayDate?.toISOString() }, '', hash);
    }

    logger.debug('[useViewState] View changed to:', view, 'hash:', hash);
  }, [selectedDayDate]);

  // Set initial hash on mount (replaceState so we don't add to history)
  useEffect(() => {
    const hash = buildHash(currentView, selectedDayDate);
    window.history.replaceState({ view: currentView, dayDate: selectedDayDate?.toISOString() }, '', hash);
    logger.debug('[useViewState] Set initial hash:', hash);
  }, []); // Only run once on mount

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      logger.debug('[useViewState] Popstate event:', event.state);

      if (event.state?.view && VALID_VIEWS.includes(event.state.view)) {
        setCurrentViewInternal(event.state.view);

        // Also restore day date if applicable
        if (event.state.view === 'day' && event.state.dayDate) {
          const date = new Date(event.state.dayDate);
          date.setHours(0, 0, 0, 0);
          setSelectedDayDate(date);
        }
      } else {
        // Fallback: parse hash directly
        const { view, dayDate } = parseHash();
        if (view) {
          setCurrentViewInternal(view);
          if (view === 'day' && dayDate) {
            setSelectedDayDate(dayDate);
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save view state to localStorage whenever it changes (debounced)
  useEffect(() => {
    if (!user) return; // Only save if user is authenticated

    // Clear any existing timeout
    if (saveTimeoutRef.current !== null) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout to save after debounce delay
    saveTimeoutRef.current = window.setTimeout(() => {
      saveViewState({
        currentView,
        selectedDayDate: selectedDayDate ? selectedDayDate.toISOString() : null,
        weekViewDate: weekViewDate ? weekViewDate.toISOString() : null,
        todayViewDate: todayViewDate.toISOString(),
        tomorrowViewDate: tomorrowViewDate.toISOString(),
      });
      saveTimeoutRef.current = null;
    }, VIEW_STATE_SAVE_DEBOUNCE_MS);

    // Cleanup function to clear timeout on unmount or dependency change
    return () => {
      if (saveTimeoutRef.current !== null) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [currentView, selectedDayDate, weekViewDate, todayViewDate, tomorrowViewDate, user]);

  // Handle user auth changes (login/logout)
  // Only reset to 'today' on actual login, not on refresh with existing session
  useEffect(() => {
    // Skip if user is null (still loading or logged out)
    // We only want to track transitions, not initial null state
    if (user === null) {
      // User logged out (was previously logged in)
      if (previousUserRef.current !== null) {
        logger.debug('[useViewState] User logged out, resetting to today');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        setTodayViewDate(today);
        setCurrentViewInternal('today');
        setSearchQuery('');
        window.history.replaceState({ view: 'today' }, '', '#today');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        previousUserRef.current = null;
      }
      // Don't update isInitialMount here - wait for auth to complete
      return;
    }

    // User is now authenticated
    const wasLoggedOut = previousUserRef.current === null;
    const isActualLogin = wasLoggedOut && !isInitialMount.current;

    if (isActualLogin) {
      // User just logged in (not a refresh) - reset to today view
      logger.debug('[useViewState] User logged in, resetting to today');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTodayViewDate(today);
      setCurrentView('today');
      setSearchQuery('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (isInitialMount.current) {
      // First auth on page load (refresh) - keep the URL hash view
      logger.debug('[useViewState] Initial auth on refresh, keeping current view:', currentView);
    }

    // Update refs - only mark initial mount complete once we have a user
    previousUserRef.current = user;
    isInitialMount.current = false;
  }, [user, setCurrentView, currentView]);

  // Roll the Today/Upcoming dates forward when the calendar day changes while the app stays open
  // (e.g. a phone resuming the app the next morning), so Today doesn't keep showing yesterday
  useEffect(() => {
    const checkForDayChange = () => {
      const todayStr = formatDate(new Date());
      if (todayStr === currentDayRef.current) return;

      const previousDay = parseLocalDate(currentDayRef.current);
      const previousTomorrowStr = formatDate(
        new Date(previousDay.getFullYear(), previousDay.getMonth(), previousDay.getDate() + 1)
      );
      logger.debug('[useViewState] Day changed, updating view dates:', currentDayRef.current, '->', todayStr);
      currentDayRef.current = todayStr;
      setTodayViewDate(getToday());
      setTomorrowViewDate(prev => (formatDate(prev) === previousTomorrowStr ? getTomorrow() : prev));
    };

    const intervalId = window.setInterval(checkForDayChange, DAY_ROLLOVER_CHECK_MS);
    document.addEventListener('visibilitychange', checkForDayChange);
    window.addEventListener('focus', checkForDayChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkForDayChange);
      window.removeEventListener('focus', checkForDayChange);
    };
  }, []);

  // Scroll to top when switching to 'today' view
  useEffect(() => {
    if (currentView === 'today') {
      // Small delay to ensure view has rendered
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [currentView]);

  const resetToToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setTodayViewDate(today);
    setCurrentView('today');
    setSearchQuery('');
  }, [setCurrentView]);

  // Wrapper for setSelectedDayDate that also updates hash when in day view
  const setSelectedDayDateWithHash = useCallback((date: Date | null) => {
    setSelectedDayDate(date);
    // If we're in day view, update the hash to reflect the new date
    if (currentView === 'day' && date) {
      const hash = buildHash('day', date);
      window.history.replaceState({ view: 'day', dayDate: date.toISOString() }, '', hash);
    }
  }, [currentView]);

  return {
    currentView,
    setCurrentView,
    selectedDayDate,
    setSelectedDayDate: setSelectedDayDateWithHash,
    weekViewDate,
    setWeekViewDate,
    todayViewDate,
    setTodayViewDate,
    tomorrowViewDate,
    setTomorrowViewDate,
    searchQuery,
    setSearchQuery,
    resetToToday,
  };
};

