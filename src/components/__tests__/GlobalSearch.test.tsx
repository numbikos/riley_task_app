import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import GlobalSearch from '../GlobalSearch';
import { Task } from '../../types';

// Set fixed system time for all tests
const FIXED_DATE = new Date('2024-01-15T12:00:00');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_DATE);
});

afterEach(() => {
  vi.useRealTimers();
});

// Mock dateUtils to control date behavior in tests
vi.mock('../../utils/dateUtils', () => ({
  formatDateLong: (date: string) => date,
  formatDate: (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  isDateToday: (date: string | null) => {
    if (!date) return false;
    return date.startsWith('2024-01-15');
  },
  isDateTomorrow: (date: string | null) => {
    if (!date) return false;
    return date.startsWith('2024-01-16');
  },
  isDateOverdue: (date: string | null) => {
    if (!date) return false;
    return date < '2024-01-15';
  },
  getNext5Days: (date: Date) => {
    const dates: Date[] = [];
    for (let i = 0; i < 5; i++) {
      const nextDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + i, 12, 0, 0);
      dates.push(nextDate);
    }
    return dates;
  },
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test Task',
  dueDate: '2024-01-15',
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  lastModified: '2024-01-01T00:00:00.000Z',
  recurrence: null,
  recurrenceGroupId: null,
  isLastInstance: false,
  autoRenew: false,
  ...overrides,
});

// Helper to create local dates without timezone issues
const createLocalDate = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12, 0, 0);

const defaultProps = {
  tasks: [],
  tagColors: {},
  onSelectTask: vi.fn(),
  query: '',
  setQuery: vi.fn(),
  currentView: 'all' as const,
  todayViewDate: createLocalDate(2024, 1, 15),
  tomorrowViewDate: createLocalDate(2024, 1, 16),
  selectedDayDate: null,
  weekViewDate: null,
};

describe('GlobalSearch', () => {
  describe('view-scoped placeholder text', () => {
    it('shows "Search all tasks..." for all view', () => {
      render(<GlobalSearch {...defaultProps} currentView="all" />);
      expect(screen.getByPlaceholderText('Search all tasks...')).toBeInTheDocument();
    });

    it('shows "Search today\'s tasks..." for today view', () => {
      render(<GlobalSearch {...defaultProps} currentView="today" />);
      expect(screen.getByPlaceholderText("Search today's tasks...")).toBeInTheDocument();
    });

    it('shows "Search tomorrow\'s tasks..." for tomorrow view', () => {
      render(<GlobalSearch {...defaultProps} currentView="tomorrow" />);
      expect(screen.getByPlaceholderText("Search tomorrow's tasks...")).toBeInTheDocument();
    });

    it('shows "Search day tasks..." for day view', () => {
      render(<GlobalSearch {...defaultProps} currentView="day" />);
      expect(screen.getByPlaceholderText('Search day tasks...')).toBeInTheDocument();
    });

    it('shows "Search visible tasks..." for week view', () => {
      render(<GlobalSearch {...defaultProps} currentView="week" />);
      expect(screen.getByPlaceholderText('Search visible tasks...')).toBeInTheDocument();
    });

    it('shows "Search completed tasks..." for completed view', () => {
      render(<GlobalSearch {...defaultProps} currentView="completed" />);
      expect(screen.getByPlaceholderText('Search completed tasks...')).toBeInTheDocument();
    });
  });

  describe('today view filtering', () => {
    it('only shows tasks due today when searching in today view', () => {
      const tasks = [
        createTask({ id: '1', title: 'Today Task', dueDate: '2024-01-15' }),
        createTask({ id: '2', title: 'Tomorrow Task', dueDate: '2024-01-16' }),
        createTask({ id: '3', title: 'Future Task', dueDate: '2024-01-20' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="today"
          query="Task"
        />
      );

      // Focus input to open dropdown
      fireEvent.focus(screen.getByPlaceholderText("Search today's tasks..."));

      expect(screen.getByText('Today Task')).toBeInTheDocument();
      expect(screen.queryByText('Tomorrow Task')).not.toBeInTheDocument();
      expect(screen.queryByText('Future Task')).not.toBeInTheDocument();
    });

    it('includes overdue tasks in today view search', () => {
      const tasks = [
        createTask({ id: '1', title: 'Today Task', dueDate: '2024-01-15' }),
        createTask({ id: '2', title: 'Overdue Task', dueDate: '2024-01-10' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="today"
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText("Search today's tasks..."));

      expect(screen.getByText('Today Task')).toBeInTheDocument();
      expect(screen.getByText('Overdue Task')).toBeInTheDocument();
    });
  });

  describe('tomorrow view filtering', () => {
    it('only shows tasks due tomorrow when searching in tomorrow view', () => {
      const tasks = [
        createTask({ id: '1', title: 'Today Task', dueDate: '2024-01-15' }),
        createTask({ id: '2', title: 'Tomorrow Task', dueDate: '2024-01-16' }),
        createTask({ id: '3', title: 'Future Task', dueDate: '2024-01-20' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="tomorrow"
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText("Search tomorrow's tasks..."));

      expect(screen.queryByText('Today Task')).not.toBeInTheDocument();
      expect(screen.getByText('Tomorrow Task')).toBeInTheDocument();
      expect(screen.queryByText('Future Task')).not.toBeInTheDocument();
    });
  });

  describe('day view filtering', () => {
    it('only shows tasks for the selected day', () => {
      const tasks = [
        createTask({ id: '1', title: 'Jan 20 Task', dueDate: '2024-01-20' }),
        createTask({ id: '2', title: 'Jan 21 Task', dueDate: '2024-01-21' }),
        createTask({ id: '3', title: 'Jan 15 Task', dueDate: '2024-01-15' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="day"
          selectedDayDate={createLocalDate(2024, 1, 20)}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search day tasks...'));

      expect(screen.getByText('Jan 20 Task')).toBeInTheDocument();
      expect(screen.queryByText('Jan 21 Task')).not.toBeInTheDocument();
      expect(screen.queryByText('Jan 15 Task')).not.toBeInTheDocument();
    });

    it('returns no tasks when selectedDayDate is null', () => {
      const tasks = [
        createTask({ id: '1', title: 'Test Task', dueDate: '2024-01-20' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="day"
          selectedDayDate={null}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search day tasks...'));

      expect(screen.getByText('No tasks found')).toBeInTheDocument();
    });
  });

  describe('week view filtering (5-day window)', () => {
    it('only shows tasks within the 5-day window starting from weekViewDate', () => {
      const tasks = [
        createTask({ id: '1', title: 'Day 1 Task', dueDate: '2024-01-20' }),
        createTask({ id: '2', title: 'Day 3 Task', dueDate: '2024-01-22' }),
        createTask({ id: '3', title: 'Day 5 Task', dueDate: '2024-01-24' }),
        createTask({ id: '4', title: 'Outside Task', dueDate: '2024-01-25' }), // Day 6 - outside window
        createTask({ id: '5', title: 'Before Task', dueDate: '2024-01-19' }), // Before window
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="week"
          weekViewDate={createLocalDate(2024, 1, 20)}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search visible tasks...'));

      // Tasks within 5-day window (Jan 20-24)
      expect(screen.getByText('Day 1 Task')).toBeInTheDocument();
      expect(screen.getByText('Day 3 Task')).toBeInTheDocument();
      expect(screen.getByText('Day 5 Task')).toBeInTheDocument();

      // Tasks outside the window
      expect(screen.queryByText('Outside Task')).not.toBeInTheDocument();
      expect(screen.queryByText('Before Task')).not.toBeInTheDocument();
    });

    it('excludes completed tasks from week view search', () => {
      const tasks = [
        createTask({ id: '1', title: 'Active Task', dueDate: '2024-01-20', completed: false }),
        createTask({ id: '2', title: 'Completed Task', dueDate: '2024-01-20', completed: true }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="week"
          weekViewDate={createLocalDate(2024, 1, 20)}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search visible tasks...'));

      expect(screen.getByText('Active Task')).toBeInTheDocument();
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
    });

    it('excludes tasks without due dates from week view search', () => {
      const tasks = [
        createTask({ id: '1', title: 'Dated Task', dueDate: '2024-01-20' }),
        createTask({ id: '2', title: 'No Date Task', dueDate: null }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="week"
          weekViewDate={createLocalDate(2024, 1, 20)}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search visible tasks...'));

      expect(screen.getByText('Dated Task')).toBeInTheDocument();
      expect(screen.queryByText('No Date Task')).not.toBeInTheDocument();
    });

    it('uses current date when weekViewDate is null', () => {
      // System time is already set to Jan 15 in beforeEach
      const tasks = [
        createTask({ id: '1', title: 'Jan 15 Task', dueDate: '2024-01-15' }),
        createTask({ id: '2', title: 'Jan 19 Task', dueDate: '2024-01-19' }),
        createTask({ id: '3', title: 'Jan 25 Task', dueDate: '2024-01-25' }), // Outside 5-day window
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="week"
          weekViewDate={null}
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search visible tasks...'));

      expect(screen.getByText('Jan 15 Task')).toBeInTheDocument();
      expect(screen.getByText('Jan 19 Task')).toBeInTheDocument();
      expect(screen.queryByText('Jan 25 Task')).not.toBeInTheDocument();
    });
  });

  describe('all view filtering', () => {
    it('shows all incomplete tasks regardless of due date', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A', dueDate: '2024-01-15' }),
        createTask({ id: '2', title: 'Task B', dueDate: '2024-02-01' }),
        createTask({ id: '3', title: 'Task C', dueDate: null }),
        createTask({ id: '4', title: 'Completed Task', dueDate: '2024-01-15', completed: true }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.getByText('Task B')).toBeInTheDocument();
      expect(screen.getByText('Task C')).toBeInTheDocument();
      expect(screen.queryByText('Completed Task')).not.toBeInTheDocument();
    });
  });

  describe('completed view filtering', () => {
    it('only shows completed tasks', () => {
      const tasks = [
        createTask({ id: '1', title: 'Active Task', completed: false }),
        createTask({ id: '2', title: 'Completed Task', completed: true }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="completed"
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search completed tasks...'));

      expect(screen.queryByText('Active Task')).not.toBeInTheDocument();
      expect(screen.getByText('Completed Task')).toBeInTheDocument();
    });

    it('shows "No completed tasks found" when no results in completed view', () => {
      const tasks = [
        createTask({ id: '1', title: 'Active Task', completed: false }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="completed"
          query="Task"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search completed tasks...'));

      expect(screen.getByText('No completed tasks found')).toBeInTheDocument();
    });

    it('shows load more button when hasMoreCompletedTasks is true', () => {
      const tasks = [
        createTask({ id: '1', title: 'Completed Task', completed: true }),
      ];
      const onLoadMoreCompleted = vi.fn();

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="completed"
          query="Task"
          hasMoreCompletedTasks={true}
          onLoadMoreCompleted={onLoadMoreCompleted}
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search completed tasks...'));

      const loadMoreBtn = screen.getByText('Load more completed tasks to search');
      expect(loadMoreBtn).toBeInTheDocument();

      fireEvent.click(loadMoreBtn);
      expect(onLoadMoreCompleted).toHaveBeenCalledTimes(1);
    });
  });

  describe('search functionality', () => {
    it('filters by task title', () => {
      const tasks = [
        createTask({ id: '1', title: 'Buy groceries' }),
        createTask({ id: '2', title: 'Call dentist' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="groceries"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      expect(screen.getByText('Buy groceries')).toBeInTheDocument();
      expect(screen.queryByText('Call dentist')).not.toBeInTheDocument();
    });

    it('filters by tag', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A', tags: ['work'] }),
        createTask({ id: '2', title: 'Task B', tags: ['personal'] }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="work"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      expect(screen.getByText('Task A')).toBeInTheDocument();
      expect(screen.queryByText('Task B')).not.toBeInTheDocument();
    });

    it('shows no results message when query matches nothing', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="nonexistent"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      expect(screen.getByText('No tasks found')).toBeInTheDocument();
    });

    it('does not show dropdown when query is empty', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query=""
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      expect(screen.queryByText('Task A')).not.toBeInTheDocument();
    });
  });

  describe('recurring task grouping', () => {
    it('groups recurring tasks by recurrenceGroupId', () => {
      const tasks = [
        createTask({
          id: '1',
          title: 'Weekly Meeting',
          dueDate: '2024-01-15',
          recurrence: 'weekly',
          recurrenceGroupId: 'group-1',
        }),
        createTask({
          id: '2',
          title: 'Weekly Meeting',
          dueDate: '2024-01-22',
          recurrence: 'weekly',
          recurrenceGroupId: 'group-1',
        }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="Meeting"
        />
      );

      fireEvent.focus(screen.getByPlaceholderText('Search all tasks...'));

      // Should show main task and an expand button for other instances
      const results = screen.getAllByText('Weekly Meeting');
      expect(results).toHaveLength(1); // Only main task shown initially

      // Should show expand button with count
      expect(screen.getByText('1+')).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('closes dropdown on Escape', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A' }),
      ];

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="Task"
        />
      );

      const input = screen.getByPlaceholderText('Search all tasks...');
      fireEvent.focus(input);

      expect(screen.getByText('Task A')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByText('Task A')).not.toBeInTheDocument();
    });

    it('selects task on Enter after arrow navigation', () => {
      const tasks = [
        createTask({ id: '1', title: 'Task A' }),
        createTask({ id: '2', title: 'Task B' }),
      ];
      const onSelectTask = vi.fn();

      render(
        <GlobalSearch
          {...defaultProps}
          tasks={tasks}
          currentView="all"
          query="Task"
          onSelectTask={onSelectTask}
        />
      );

      const input = screen.getByPlaceholderText('Search all tasks...');
      fireEvent.focus(input);
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSelectTask).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });
  });

  describe('clear button', () => {
    it('shows clear button when query is not empty', () => {
      render(
        <GlobalSearch
          {...defaultProps}
          query="test"
        />
      );

      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('does not show clear button when query is empty', () => {
      render(
        <GlobalSearch
          {...defaultProps}
          query=""
        />
      );

      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });

    it('calls setQuery with empty string when clear is clicked', () => {
      const setQuery = vi.fn();

      render(
        <GlobalSearch
          {...defaultProps}
          query="test"
          setQuery={setQuery}
        />
      );

      fireEvent.click(screen.getByLabelText('Clear search'));

      expect(setQuery).toHaveBeenCalledWith('');
    });
  });
});
