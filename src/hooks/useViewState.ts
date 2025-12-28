import { useState, useEffect, useRef } from 'react';
import { ViewType } from '../types';
import { loadViewState, saveViewState } from '../utils/storage';
import type { User } from '@supabase/supabase-js';

const VIEW_STATE_SAVE_DEBOUNCE_MS = 500;

/**
 * Custom hook for managing view state
 */
export const useViewState = (user: User | null) => {
  const savedViewState = loadViewState();
  
  const [currentView, setCurrentView] = useState<ViewType>(savedViewState?.currentView || 'today');
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(() => {
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
  const [todayViewDate, setTodayViewDate] = useState<Date>(() => {
    if (savedViewState?.todayViewDate) {
      const date = new Date(savedViewState.todayViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [tomorrowViewDate, setTomorrowViewDate] = useState<Date>(() => {
    if (savedViewState?.tomorrowViewDate) {
      const date = new Date(savedViewState.tomorrowViewDate);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const saveTimeoutRef = useRef<number | null>(null);

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

  // Reset view to 'today' when user logs in
  useEffect(() => {
    if (user) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTodayViewDate(today);
      setCurrentView('today');
      setSearchQuery('');
      
      // Scroll to top when logging in
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Reset view state when user logs out
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      setTodayViewDate(today);
      setCurrentView('today');
      setSearchQuery('');
      // Scroll to top when logging out
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [user]);

  // Scroll to top when switching to 'today' view
  useEffect(() => {
    if (currentView === 'today') {
      // Small delay to ensure view has rendered
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }, [currentView]);

  const resetToToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setTodayViewDate(today);
    setCurrentView('today');
    setSearchQuery('');
  };

  return {
    currentView,
    setCurrentView,
    selectedDayDate,
    setSelectedDayDate,
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

