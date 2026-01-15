import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CompletedView from '../CompletedView';
import { Task } from '../../types';

// Mock TaskCard to simplify tests
vi.mock('../TaskCard', () => ({
  default: ({ task }: { task: Task }) => (
    <div data-testid={`task-${task.id}`}>{task.title}</div>
  ),
}));

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Test Task',
  dueDate: '2024-01-01',
  completed: true,
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

const defaultProps = {
  tasks: [],
  tagColors: {},
  onToggleComplete: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onUpdateTask: vi.fn(),
};

describe('CompletedView', () => {
  it('renders task list without Load More when hasMore is false', () => {
    const tasks = [createTask({ id: 'task-1' }), createTask({ id: 'task-2' })];
    render(<CompletedView {...defaultProps} tasks={tasks} hasMore={false} />);

    expect(screen.getByTestId('task-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('task-task-2')).toBeInTheDocument();
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('renders Load More button when hasMore is true', () => {
    const tasks = [createTask({ id: 'task-1' })];
    const onLoadMore = vi.fn();
    render(
      <CompletedView
        {...defaultProps}
        tasks={tasks}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    expect(screen.getByText('Load More')).toBeInTheDocument();
  });

  it('calls onLoadMore when Load More button clicked', () => {
    const tasks = [createTask({ id: 'task-1' })];
    const onLoadMore = vi.fn();
    render(
      <CompletedView
        {...defaultProps}
        tasks={tasks}
        hasMore={true}
        onLoadMore={onLoadMore}
      />
    );

    fireEvent.click(screen.getByText('Load More'));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('shows loading state when isLoadingMore is true', () => {
    const tasks = [createTask({ id: 'task-1' })];
    render(
      <CompletedView
        {...defaultProps}
        tasks={tasks}
        hasMore={true}
        isLoadingMore={true}
        onLoadMore={vi.fn()}
      />
    );

    expect(screen.getByText('Loading more...')).toBeInTheDocument();
    expect(screen.queryByText('Load More')).not.toBeInTheDocument();
  });

  it('displays progress indicator with loaded/total counts', () => {
    const tasks = [createTask({ id: 'task-1' })];
    render(
      <CompletedView
        {...defaultProps}
        tasks={tasks}
        loadedCount={25}
        totalCount={100}
      />
    );

    expect(screen.getByText('Loaded 25 of 100 completed tasks')).toBeInTheDocument();
  });

  it('handles empty completed tasks list', () => {
    render(<CompletedView {...defaultProps} tasks={[]} />);

    expect(screen.getByText('No completed tasks')).toBeInTheDocument();
    expect(screen.getByText('Tasks you complete will appear here.')).toBeInTheDocument();
  });

  it('sorts tasks by lastModified descending, then id descending', () => {
    const tasks = [
      createTask({ id: 'aaa', title: 'Task A', lastModified: '2024-01-01T00:00:00.000Z' }),
      createTask({ id: 'bbb', title: 'Task B', lastModified: '2024-01-02T00:00:00.000Z' }),
      createTask({ id: 'ccc', title: 'Task C', lastModified: '2024-01-01T00:00:00.000Z' }),
    ];
    render(<CompletedView {...defaultProps} tasks={tasks} />);

    const taskElements = screen.getAllByTestId(/task-/);
    // Task B should be first (most recent lastModified)
    // Then Task C (same lastModified as A, but 'ccc' > 'aaa')
    // Then Task A
    expect(taskElements[0]).toHaveAttribute('data-testid', 'task-bbb');
    expect(taskElements[1]).toHaveAttribute('data-testid', 'task-ccc');
    expect(taskElements[2]).toHaveAttribute('data-testid', 'task-aaa');
  });
});
