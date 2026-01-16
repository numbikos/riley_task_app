/**
 * @fileoverview View state storage utilities.
 * 
 * View state (current view, selected dates, etc.) is stored in localStorage
 * as it doesn't need to be synced across devices - each device can have its own view preferences.
 */

import { ViewType } from '../types';
import { logger } from './logger';

const VIEW_STATE_KEY = 'riley-view-state';
export interface ViewState {
  currentView: ViewType;
  selectedDayDate: string | null;
  weekViewDate: string | null;
  todayViewDate: string | null;
  tomorrowViewDate: string | null;
}

export const loadViewState = (): ViewState | null => {
  try {
    const stored = localStorage.getItem(VIEW_STATE_KEY);
    if (!stored) return null;
    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const saveViewState = (state: ViewState): void => {
  try {
    localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    logger.error('Failed to save view state:', error);
  }
};

// Love message storage - tracks when daily message was last shown
const LOVE_MESSAGE_KEY = 'riley-love-message-last-shown';

// Returns YYYY-MM-DD format in local time
export const getTodayDateString = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

export const getLastLoveMessageDate = (): string | null => {
  try {
    return localStorage.getItem(LOVE_MESSAGE_KEY);
  } catch {
    return null;
  }
};

export const setLastLoveMessageDate = (date: string): void => {
  try {
    localStorage.setItem(LOVE_MESSAGE_KEY, date);
  } catch (error) {
    logger.error('[storage] Failed to save love message date:', error);
  }
};
