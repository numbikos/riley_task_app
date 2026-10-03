// Run in a US timezone, where parsing 'YYYY-MM-DD' as UTC lands on the previous local day
process.env.TZ = 'America/Los_Angeles';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { Task } from '../../types';
import { useRecurringTasks } from '../useRecurringTasks';

const { mockDeleteTasks } = vi.hoisted(() => ({
  mockDeleteTasks: vi.fn(),
}));

vi.mock('../../utils/supabaseStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/supabaseStorage')>();
  return { ...actual, deleteTasks: mockDeleteTasks };
});

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).slice(2, 11)}`,
  title: 'Water plants',
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

const renderRecurringHook = (initialTasks: Task[]) => {
  return renderHook(() => {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const recurring = useRecurringTasks(tasks, setTasks, vi.fn());
    return { tasks, ...recurring };
  });
};

describe('useRecurringTasks', () => {
  beforeEach(() => {
    mockDeleteTasks.mockReset();
    mockDeleteTasks.mockResolvedValue(undefined);
  });

  describe('handleAutoRenewal', () => {
    it('starts the next batch at the next occurrence, without duplicating the completed date', () => {
      const last = createTask({ id: 'last', dueDate: '2026-03-02', isLastInstance: true });
      const { result } = renderRecurringHook([last]);

      act(() => {
        result.current.handleAutoRenewal(last);
      });

      const newTasks = result.current.tasks.filter(t => t.id !== 'last');
      expect(newTasks.length).toBe(10);
      expect(newTasks[0].dueDate).toBe('2026-03-09');
      expect(newTasks.some(t => t.dueDate === '2026-03-02')).toBe(false);
    });

    it('clears the last-instance flag so undo + re-complete does not create a second batch', () => {
      const last = createTask({ id: 'last', isLastInstance: true });
      const { result } = renderRecurringHook([last]);

      act(() => {
        result.current.handleAutoRenewal(last);
      });

      const renewedLast = result.current.tasks.find(t => t.id === 'last')!;
      expect(renewedLast.isLastInstance).toBe(false);

      act(() => {
        result.current.handleAutoRenewal(renewedLast);
      });

      expect(result.current.tasks.length).toBe(11);
    });

    it('starts the new batch with unchecked subtasks', () => {
      const last = createTask({
        id: 'last',
        isLastInstance: true,
        subtasks: [{ id: 's1', text: 'Fill can', completed: true }],
      });
      const { result } = renderRecurringHook([last]);

      act(() => {
        result.current.handleAutoRenewal(last);
      });

      const firstNew = result.current.tasks.find(t => t.id !== 'last')!;
      expect(firstNew.subtasks[0].completed).toBe(false);
    });
  });

  describe('updateRecurringTask', () => {
    it('only changes the edited instance when a subtask is checked off', () => {
      const subtasks = [{ id: 's1', text: 'Fill can', completed: false }];
      const current = createTask({ id: 'current', dueDate: '2099-03-02', subtasks });
      const future = createTask({
        id: 'future',
        dueDate: '2099-03-09',
        subtasks: [{ id: 's1', text: 'Fill can', completed: true }],
        lastModified: 'unchanged',
      });
      const { result } = renderRecurringHook([current, future]);

      act(() => {
        result.current.updateRecurringTask('current', {
          subtasks: [{ id: 's1', text: 'Fill can', completed: true }],
        });
      });

      const updatedCurrent = result.current.tasks.find(t => t.id === 'current')!;
      const untouchedFuture = result.current.tasks.find(t => t.id === 'future')!;
      expect(updatedCurrent.subtasks[0].completed).toBe(true);
      expect(untouchedFuture).toBe(future);
    });

    it('still propagates a changed subtask list to future instances', () => {
      const current = createTask({ id: 'current', dueDate: '2099-03-02' });
      const future = createTask({ id: 'future', dueDate: '2099-03-09' });
      const { result } = renderRecurringHook([current, future]);

      act(() => {
        result.current.updateRecurringTask('current', {
          subtasks: [{ id: 's1', text: 'New step', completed: false }],
        });
      });

      const updatedFuture = result.current.tasks.find(t => t.id === 'future')!;
      expect(updatedFuture.subtasks).toEqual([{ id: 's1', text: 'New step', completed: false }]);
    });

    it('turns the task into a one-off and removes remaining open instances when recurrence is removed', () => {
      const completedPast = createTask({ id: 'past', dueDate: '2026-02-23', completed: true });
      const current = createTask({ id: 'current', dueDate: '2026-03-02' });
      const future = createTask({ id: 'future', dueDate: '2026-03-09', isLastInstance: true });
      const { result } = renderRecurringHook([completedPast, current, future]);

      act(() => {
        result.current.updateRecurringTask('current', {
          title: 'Water plants once',
          recurrence: null,
        });
      });

      expect(result.current.tasks.map(t => t.id).sort()).toEqual(['current', 'past']);
      const updatedCurrent = result.current.tasks.find(t => t.id === 'current')!;
      expect(updatedCurrent).toMatchObject({
        title: 'Water plants once',
        dueDate: '2026-03-02',
        recurrence: null,
        recurrenceGroupId: null,
        isLastInstance: false,
        autoRenew: false,
      });
      expect(mockDeleteTasks).toHaveBeenCalledWith(['future']);
    });
  });
});
