import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadViewState, saveViewState, ViewState } from '../storage';

describe('storage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadViewState', () => {
    it('should return null when no state is stored', () => {
      expect(loadViewState()).toBeNull();
    });

    it('should load stored view state', () => {
      const state: ViewState = {
        currentView: 'today',
        selectedDayDate: '2024-01-15',
        weekViewDate: null,
        todayViewDate: '2024-01-15',
        tomorrowViewDate: null,
      };

      localStorage.setItem('riley-view-state', JSON.stringify(state));
      const result = loadViewState();

      expect(result).toEqual(state);
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('riley-view-state', 'invalid json');
      expect(loadViewState()).toBeNull();
    });

    it('should handle missing localStorage gracefully', () => {
      // Mock localStorage.getItem to throw an error
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(loadViewState()).toBeNull();

      // Restore original
      localStorage.getItem = originalGetItem;
    });
  });

  describe('saveViewState', () => {
    it('should save view state to localStorage', () => {
      const state: ViewState = {
        currentView: 'week',
        selectedDayDate: null,
        weekViewDate: '2024-01-15',
        todayViewDate: null,
        tomorrowViewDate: null,
      };

      saveViewState(state);

      const stored = localStorage.getItem('riley-view-state');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(state);
    });

    it('should overwrite existing state', () => {
      const state1: ViewState = {
        currentView: 'today',
        selectedDayDate: null,
        weekViewDate: null,
        todayViewDate: '2024-01-15',
        tomorrowViewDate: null,
      };

      const state2: ViewState = {
        currentView: 'all',
        selectedDayDate: null,
        weekViewDate: null,
        todayViewDate: null,
        tomorrowViewDate: null,
      };

      saveViewState(state1);
      saveViewState(state2);

      const stored = localStorage.getItem('riley-view-state');
      expect(JSON.parse(stored!)).toEqual(state2);
    });

    it('should handle localStorage errors gracefully', () => {
      const state: ViewState = {
        currentView: 'today',
        selectedDayDate: null,
        weekViewDate: null,
        todayViewDate: '2024-01-15',
        tomorrowViewDate: null,
      };

      // Mock localStorage.setItem to throw an error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => saveViewState(state)).not.toThrow();

      // Restore original
      localStorage.setItem = originalSetItem;
    });
  });
});

