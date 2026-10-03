// Run in a US timezone, where parsing 'YYYY-MM-DD' as UTC lands on the previous local day
process.env.TZ = 'America/Los_Angeles';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Task } from '../../types';
import { generateRecurringDates } from '../dateUtils';
import {
  extendRecurringTaskInstances,
  getNextRecurrenceDate,
  getTasksToRemoveForRegeneration,
  haveSubtasksChanged,
} from '../recurringTaskHelpers';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).slice(2, 11)}`,
  title: 'Recurring',
  dueDate: '2026-03-02',
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-01-01T00:00:00.000Z',
  recurrence: 'weekly',
  recurrenceGroupId: 'group-1',
  isLastInstance: false,
  autoRenew: true,
  ...overrides,
});

describe('generateRecurringDates', () => {
  it('clamps monthly dates to the end of shorter months instead of drifting', () => {
    expect(generateRecurringDates('2026-01-31', 'monthly', 4)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });

  it('keeps weekly dates on the same weekday', () => {
    expect(generateRecurringDates('2026-03-02', 'weekly', 3)).toEqual([
      '2026-03-02',
      '2026-03-09',
      '2026-03-16',
    ]);
  });

  it('applies the custom multiplier and frequency', () => {
    expect(generateRecurringDates('2026-03-02', 'custom', 3, 2, 'weekly')).toEqual([
      '2026-03-02',
      '2026-03-16',
      '2026-03-30',
    ]);
  });
});

describe('getNextRecurrenceDate', () => {
  it('returns the next weekly occurrence on the same weekday', () => {
    expect(getNextRecurrenceDate(createTask({ recurrence: 'weekly' }), '2026-03-02')).toBe('2026-03-09');
  });

  it('returns the next monthly occurrence', () => {
    expect(getNextRecurrenceDate(createTask({ recurrence: 'monthly' }), '2026-03-15')).toBe('2026-04-15');
  });

  it('honors custom recurrence', () => {
    const task = createTask({ recurrence: 'custom', recurrenceMultiplier: 3, customFrequency: 'daily' });
    expect(getNextRecurrenceDate(task, '2026-03-02')).toBe('2026-03-05');
  });

  it('returns null for non-recurring tasks', () => {
    expect(getNextRecurrenceDate(createTask({ recurrence: null }), '2026-03-02')).toBeNull();
  });
});

describe('extendRecurringTaskInstances', () => {
  it('continues the series at the next occurrence after the last instance', () => {
    const first = createTask({ dueDate: '2026-03-02' });
    const last = createTask({ dueDate: '2026-03-09', isLastInstance: true });

    const newTasks = extendRecurringTaskInstances(first, [first, last]);

    expect(newTasks[0].dueDate).toBe('2026-03-16');
    expect(newTasks[1].dueDate).toBe('2026-03-23');
    expect(newTasks.every(t => t.recurrenceGroupId === 'group-1')).toBe(true);
  });

  it('starts new instances with unchecked subtasks', () => {
    const task = createTask({
      subtasks: [{ id: 's1', text: 'Step', completed: true }],
    });

    const newTasks = extendRecurringTaskInstances(task, [task]);

    expect(newTasks[0].subtasks).toEqual([{ id: 's1', text: 'Step', completed: false }]);
  });
});

describe('getTasksToRemoveForRegeneration', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("treats today's completed instance as today (local), not past, in the evening", () => {
    // 9pm Pacific on Mar 2 is already Mar 3 in UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 2, 21, 0, 0));

    const todayCompleted = createTask({ id: 'today', dueDate: '2026-03-02', completed: true });
    const pastCompleted = createTask({ id: 'past', dueDate: '2026-02-23', completed: true });

    const ids = getTasksToRemoveForRegeneration([todayCompleted, pastCompleted], 'group-1').map(t => t.id);

    expect(ids).toEqual(['today']);
  });
});

describe('haveSubtasksChanged', () => {
  it('ignores completion state', () => {
    expect(haveSubtasksChanged(
      [{ id: 's1', text: 'Step', completed: true }],
      [{ id: 's1', text: 'Step', completed: false }]
    )).toBe(false);
  });

  it('detects added or renamed subtasks', () => {
    const original = [{ id: 's1', text: 'Step', completed: false }];
    expect(haveSubtasksChanged([...original, { id: 's2', text: 'More', completed: false }], original)).toBe(true);
    expect(haveSubtasksChanged([{ id: 's1', text: 'Renamed', completed: false }], original)).toBe(true);
  });
});
