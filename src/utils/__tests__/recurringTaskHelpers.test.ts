import { describe, it, expect } from 'vitest';
import { createRecurringTaskInstances, findFirstInstance, findLastInstance, getTasksToRemoveForRegeneration, extendRecurringTaskInstances } from '../recurringTaskHelpers';
import { Task } from '../../types';

describe('createRecurringTaskInstances', () => {
  const baseTaskData: Partial<Task> = {
    title: 'Test Task',
    tags: ['work', 'important'],
    subtasks: [
      { id: 'sub1', text: 'Subtask 1', completed: false },
      { id: 'sub2', text: 'Subtask 2', completed: true },
    ],
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  it('should create 50 daily recurring tasks by default', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily'
    );

    expect(tasks).toHaveLength(50);
    expect(tasks[0].dueDate).toBe('2024-01-01');
    expect(tasks[1].dueDate).toBe('2024-01-02');
    expect(tasks[49].dueDate).toBe('2024-02-19'); // 50 days later
  });

  it('should create tasks with correct recurrence properties', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily'
    );

    tasks.forEach(task => {
      expect(task.recurrence).toBe('daily');
      expect(task.recurrenceGroupId).toBeTruthy();
      expect(task.autoRenew).toBe(true);
      expect(task.completed).toBe(false);
    });
  });

  it('should mark the last instance correctly', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily',
      5
    );

    expect(tasks[0].isLastInstance).toBe(false);
    expect(tasks[1].isLastInstance).toBe(false);
    expect(tasks[2].isLastInstance).toBe(false);
    expect(tasks[3].isLastInstance).toBe(false);
    expect(tasks[4].isLastInstance).toBe(true);
  });

  it('should preserve original creation date', () => {
    const tasks = createRecurringTaskInstances(
      { ...baseTaskData, createdAt: '2024-01-01T00:00:00.000Z' },
      '2024-01-15',
      'daily',
      3
    );

    tasks.forEach(task => {
      expect(task.createdAt).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  it('should normalize tags to lowercase', () => {
    const tasks = createRecurringTaskInstances(
      { ...baseTaskData, tags: ['WORK', 'Important', 'personal'] },
      '2024-01-01',
      'daily',
      3
    );

    tasks.forEach(task => {
      expect(task.tags).toEqual(['work', 'important', 'personal']);
    });
  });

  it('should handle subtasks correctly', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily',
      3
    );

    // First instance should have original subtasks
    expect(tasks[0].subtasks).toEqual(baseTaskData.subtasks);

    // Other instances should have subtasks with completed: false
    expect(tasks[1].subtasks).toHaveLength(2);
    expect(tasks[1].subtasks[0].completed).toBe(false);
    expect(tasks[1].subtasks[1].completed).toBe(false);
    expect(tasks[2].subtasks[0].completed).toBe(false);
  });

  it('should use provided recurrenceGroupId', () => {
    const groupId = 'custom-group-id';
    const tasks = createRecurringTaskInstances(
      { ...baseTaskData, recurrenceGroupId: groupId },
      '2024-01-01',
      'daily',
      3
    );

    tasks.forEach(task => {
      expect(task.recurrenceGroupId).toBe(groupId);
    });
  });

  it('should generate recurrenceGroupId if not provided', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily',
      3
    );

    const groupId = tasks[0].recurrenceGroupId;
    expect(groupId).toBeTruthy();
    tasks.forEach(task => {
      expect(task.recurrenceGroupId).toBe(groupId);
    });
  });

  it('should return empty array for invalid recurrence', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      null as any
    );

    expect(tasks).toEqual([]);
  });

  it('should return empty array for invalid start date', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '',
      'daily'
    );

    expect(tasks).toEqual([]);
  });

  it('should create weekly recurring tasks', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'weekly',
      4
    );

    expect(tasks).toHaveLength(4);
    expect(tasks[0].dueDate).toBe('2024-01-01');
    expect(tasks[1].dueDate).toBe('2024-01-08');
    expect(tasks[2].dueDate).toBe('2024-01-15');
    expect(tasks[3].dueDate).toBe('2024-01-22');
  });

  it('should create monthly recurring tasks', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-15',
      'monthly',
      3
    );

    expect(tasks).toHaveLength(3);
    expect(tasks[0].dueDate).toBe('2024-01-15');
    expect(tasks[1].dueDate).toBe('2024-02-15');
    expect(tasks[2].dueDate).toBe('2024-03-15');
  });

  it('should handle custom count parameter', () => {
    const tasks = createRecurringTaskInstances(
      baseTaskData,
      '2024-01-01',
      'daily',
      10
    );

    expect(tasks).toHaveLength(10);
  });

  it('should handle custom recurrence with multiplier', () => {
    const tasks = createRecurringTaskInstances(
      {
        ...baseTaskData,
        recurrence: 'custom',
        recurrenceMultiplier: 2,
        customFrequency: 'weekly',
      },
      '2024-01-01',
      'custom',
      3
    );

    expect(tasks).toHaveLength(3);
    expect(tasks[0].recurrenceMultiplier).toBe(2);
    expect(tasks[0].customFrequency).toBe('weekly');
  });
});

describe('findFirstInstance', () => {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Task 1',
      dueDate: '2024-01-05',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
    {
      id: '2',
      title: 'Task 2',
      dueDate: '2024-01-01',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
    {
      id: '3',
      title: 'Task 3',
      dueDate: '2024-01-03',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
  ];

  it('should find the earliest task in a recurrence group', () => {
    const first = findFirstInstance(tasks, 'group1');
    expect(first).toBeTruthy();
    expect(first?.id).toBe('2');
    expect(first?.dueDate).toBe('2024-01-01');
  });

  it('should return null for non-existent group', () => {
    const first = findFirstInstance(tasks, 'nonexistent');
    expect(first).toBeNull();
  });
});

describe('findLastInstance', () => {
  const tasks: Task[] = [
    {
      id: '1',
      title: 'Task 1',
      dueDate: '2024-01-05',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
    {
      id: '2',
      title: 'Task 2',
      dueDate: '2024-01-01',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
    {
      id: '3',
      title: 'Task 3',
      dueDate: '2024-01-03',
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    },
  ];

  it('should find the latest task in a recurrence group', () => {
    const last = findLastInstance(tasks, 'group1');
    expect(last).toBeTruthy();
    expect(last?.id).toBe('1');
    expect(last?.dueDate).toBe('2024-01-05');
  });

  it('should return null for non-existent group', () => {
    const last = findLastInstance(tasks, 'nonexistent');
    expect(last).toBeNull();
  });
});

describe('getTasksToRemoveForRegeneration', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const createTask = (id: string, dueDate: string, completed: boolean, recurrenceGroupId: string): Task => ({
    id,
    title: 'Test Task',
    dueDate,
    completed,
    subtasks: [],
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: 'daily',
    recurrenceGroupId,
  });

  it('should remove all future instances (including today)', () => {
    const tasks: Task[] = [
      createTask('1', yesterdayStr, false, 'group1'), // Incomplete overdue - should be removed
      createTask('2', todayStr, false, 'group1'),     // Today - should be removed
      createTask('3', tomorrowStr, false, 'group1'), // Tomorrow - should be removed
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    // Function removes: future instances (>= today) AND incomplete overdue instances
    expect(toRemove).toHaveLength(3);
    expect(toRemove.map(t => t.id)).toContain('1'); // Yesterday incomplete - removed
    expect(toRemove.map(t => t.id)).toContain('2'); // Today - removed
    expect(toRemove.map(t => t.id)).toContain('3'); // Tomorrow - removed
  });

  it('should remove incomplete overdue instances', () => {
    const tasks: Task[] = [
      createTask('1', yesterdayStr, false, 'group1'),
      createTask('2', yesterdayStr, true, 'group1'), // Completed overdue - should keep
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    expect(toRemove).toHaveLength(1);
    expect(toRemove[0].id).toBe('1');
    expect(toRemove[0].completed).toBe(false);
  });

  it('should keep completed past instances', () => {
    const tasks: Task[] = [
      createTask('1', yesterdayStr, true, 'group1'),
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    expect(toRemove).toHaveLength(0);
  });

  it('should remove future instances even if completed', () => {
    const tasks: Task[] = [
      createTask('1', todayStr, true, 'group1'),   // Today - should be removed
      createTask('2', tomorrowStr, true, 'group1'), // Tomorrow - should be removed
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    expect(toRemove).toHaveLength(2);
    expect(toRemove.map(t => t.id)).toContain('1'); // Today
    expect(toRemove.map(t => t.id)).toContain('2'); // Tomorrow
  });

  it('should only remove tasks from the specified recurrence group', () => {
    const tasks: Task[] = [
      createTask('1', todayStr, false, 'group1'),
      createTask('2', todayStr, false, 'group2'),
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    expect(toRemove).toHaveLength(1);
    expect(toRemove[0].id).toBe('1');
  });

  it('should handle tasks without due dates', () => {
    const task: Task = {
      id: '1',
      title: 'Test Task',
      dueDate: null,
      completed: false,
      subtasks: [],
      tags: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: 'daily',
      recurrenceGroupId: 'group1',
    };

    const toRemove = getTasksToRemoveForRegeneration([task], 'group1');
    expect(toRemove).toHaveLength(0);
  });

  it('should handle empty task array', () => {
    const toRemove = getTasksToRemoveForRegeneration([], 'group1');
    expect(toRemove).toHaveLength(0);
  });

  it('should handle mixed scenarios correctly', () => {
    const tasks: Task[] = [
      createTask('1', yesterdayStr, false, 'group1'), // Remove - incomplete overdue
      createTask('2', yesterdayStr, true, 'group1'),  // Keep - completed past
      createTask('3', todayStr, false, 'group1'),     // Remove - today
      createTask('4', todayStr, true, 'group1'),      // Remove - today (even if completed)
      createTask('5', tomorrowStr, false, 'group1'),  // Remove - future
    ];

    const toRemove = getTasksToRemoveForRegeneration(tasks, 'group1');
    // Should remove: incomplete overdue (1), today (3, 4), future (5) = 4 tasks
    expect(toRemove).toHaveLength(4);
    expect(toRemove.map(t => t.id)).toContain('1'); // Incomplete overdue
    expect(toRemove.map(t => t.id)).toContain('3'); // Today incomplete
    expect(toRemove.map(t => t.id)).toContain('4'); // Today completed
    expect(toRemove.map(t => t.id)).toContain('5'); // Future
    expect(toRemove.map(t => t.id)).not.toContain('2'); // Completed past - keep
  });
});

describe('extendRecurringTaskInstances', () => {
  const baseTask: Task = {
    id: '1',
    title: 'Test Task',
    dueDate: '2024-01-01',
    completed: false,
    subtasks: [],
    tags: ['work'],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: 'daily',
    recurrenceGroupId: 'group1',
  };

  it('should create next batch of instances starting after last instance', () => {
    const existingTasks: Task[] = [
      { ...baseTask, id: '1', dueDate: '2024-01-01' },
      { ...baseTask, id: '2', dueDate: '2024-01-02' },
      { ...baseTask, id: '3', dueDate: '2024-01-03', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(baseTask, existingTasks);
    
    expect(newInstances.length).toBe(50);
    expect(newInstances[0].dueDate).toBe('2024-01-04'); // Day after last instance
    expect(newInstances[0].recurrenceGroupId).toBe('group1');
    expect(newInstances[0].recurrence).toBe('daily');
  });

  it('should preserve task properties in new instances', () => {
    const existingTasks: Task[] = [
      { ...baseTask, id: '1', dueDate: '2024-01-01', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(baseTask, existingTasks);
    
    expect(newInstances[0].title).toBe(baseTask.title);
    expect(newInstances[0].tags).toEqual(baseTask.tags);
    expect(newInstances[0].recurrenceGroupId).toBe(baseTask.recurrenceGroupId);
    expect(newInstances[0].recurrence).toBe(baseTask.recurrence);
  });

  it('should handle weekly recurrence correctly', () => {
    const weeklyTask: Task = {
      ...baseTask,
      recurrence: 'weekly',
    };
    const existingTasks: Task[] = [
      { ...weeklyTask, id: '1', dueDate: '2024-01-01', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(weeklyTask, existingTasks);
    
    expect(newInstances.length).toBe(50);
    expect(newInstances[0].dueDate).toBe('2024-01-02'); // Day after last
    expect(newInstances[1].dueDate).toBe('2024-01-09'); // One week later
  });

  it('should handle monthly recurrence correctly', () => {
    const monthlyTask: Task = {
      ...baseTask,
      recurrence: 'monthly',
    };
    const existingTasks: Task[] = [
      { ...monthlyTask, id: '1', dueDate: '2024-01-15', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(monthlyTask, existingTasks);
    
    expect(newInstances.length).toBe(50);
    expect(newInstances[0].dueDate).toBe('2024-01-16'); // Day after last
  });

  it('should return empty array if task has no recurrence', () => {
    const nonRecurringTask: Task = {
      ...baseTask,
      recurrence: null,
    };

    const newInstances = extendRecurringTaskInstances(nonRecurringTask, []);
    expect(newInstances).toEqual([]);
  });

  it('should return empty array if task has no due date', () => {
    const taskWithoutDate: Task = {
      ...baseTask,
      dueDate: null,
    };

    const newInstances = extendRecurringTaskInstances(taskWithoutDate, []);
    expect(newInstances).toEqual([]);
  });

  it('should return empty array if task has no recurrenceGroupId', () => {
    const taskWithoutGroup: Task = {
      ...baseTask,
      recurrenceGroupId: null,
    };

    const newInstances = extendRecurringTaskInstances(taskWithoutGroup, []);
    expect(newInstances).toEqual([]);
  });

  it('should return empty array if last instance not found', () => {
    const newInstances = extendRecurringTaskInstances(baseTask, []);
    expect(newInstances).toEqual([]);
  });

  it('should return empty array if last instance has no due date', () => {
    const existingTasks: Task[] = [
      { ...baseTask, id: '1', dueDate: null },
    ];

    const newInstances = extendRecurringTaskInstances(baseTask, existingTasks);
    expect(newInstances).toEqual([]);
  });

  it('should handle custom recurrence with multiplier', () => {
    const customTask: Task = {
      ...baseTask,
      recurrence: 'custom',
      recurrenceMultiplier: 2,
      customFrequency: 'weekly',
    };
    const existingTasks: Task[] = [
      { ...customTask, id: '1', dueDate: '2024-01-01', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(customTask, existingTasks);
    
    expect(newInstances.length).toBe(50);
    expect(newInstances[0].recurrenceMultiplier).toBe(2);
    expect(newInstances[0].customFrequency).toBe('weekly');
  });

  it('should mark the last instance correctly in new batch', () => {
    const existingTasks: Task[] = [
      { ...baseTask, id: '1', dueDate: '2024-01-01', isLastInstance: true },
    ];

    const newInstances = extendRecurringTaskInstances(baseTask, existingTasks);
    
    expect(newInstances[newInstances.length - 1].isLastInstance).toBe(true);
    expect(newInstances.slice(0, -1).every(t => !t.isLastInstance)).toBe(true);
  });
});
