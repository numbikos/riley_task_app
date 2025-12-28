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
