import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TodayView from '../TodayView';
import { Task } from '../../types';

// Mock TaskCard component
vi.mock('../TaskCard', () => ({
  default: ({ task, onToggleComplete, onEdit, onDelete }: any) => (
    <div className="task-card" data-testid={`task-card-${task.id}`}>
      <span>{task.title}</span>
      <button onClick={() => onToggleComplete(task.id)}>Toggle</button>
      <button onClick={() => onEdit(task)}>Edit</button>
      <button onClick={() => onDelete(task.id)}>Delete</button>
    </div>
  ),
}));

// Mock dateUtils
vi.mock('../../utils/dateUtils', () => ({
  formatDate: (date: Date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  formatFullDate: (date: Date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  },
  isDateOverdue: (date: string | null) => {
    if (!date) return false;
    const taskDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    taskDate.setHours(0, 0, 0, 0);
    return taskDate < today;
  },
}));

describe('TodayView', () => {
  const mockHandlers = {
    onToggleComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onUpdateTask: vi.fn(),
    onNavigateDate: vi.fn(),
    onAddTask: vi.fn(),
  };

  const tagColors: Record<string, string> = {
    work: '#FFD700',
    personal: '#FF6B6B',
  };

  const createTask = (id: string, title: string, dueDate: string, completed: boolean = false, tags: string[] = []): Task => ({
    id,
    title,
    dueDate,
    completed,
    subtasks: [],
    tags,
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: null,
    recurrenceGroupId: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render tasks for today', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Task 1', todayStr),
      createTask('2', 'Task 2', todayStr),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Task 1')).toBeInTheDocument();
    expect(screen.getByText('Task 2')).toBeInTheDocument();
  });

  it('should show overdue tasks separately when viewing today', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const tasks: Task[] = [
      createTask('1', 'Overdue Task', yesterdayStr),
      createTask('2', 'Today Task', todayStr),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Overdue Task')).toBeInTheDocument();
    expect(screen.getByText('Today Task')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });

  it('should handle empty state', () => {
    const today = new Date();
    render(
      <TodayView
        tasks={[]}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(/No tasks for today/i)).toBeInTheDocument();
  });

  it('should show add task button when onAddTask is provided', () => {
    const today = new Date();
    render(
      <TodayView
        tasks={[]}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
        onAddTask={mockHandlers.onAddTask}
      />
    );

    const addButton = screen.getByText('Add task');
    expect(addButton).toBeInTheDocument();
    
    fireEvent.click(addButton);
    expect(mockHandlers.onAddTask).toHaveBeenCalledWith(today);
  });

  it('should call onToggleComplete when task is toggled', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Task 1', todayStr),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    const toggleButton = screen.getByText('Toggle');
    fireEvent.click(toggleButton);
    expect(mockHandlers.onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('should call onEdit when task is edited', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const task = createTask('1', 'Task 1', todayStr);
    const tasks: Task[] = [task];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);
    expect(mockHandlers.onEdit).toHaveBeenCalledWith(task);
  });

  it('should call onDelete when task is deleted', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Task 1', todayStr),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    const deleteButton = screen.getByText('Delete');
    fireEvent.click(deleteButton);
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('1');
  });

  it('should group tasks by tags', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Work Task', todayStr, false, ['work']),
      createTask('2', 'Personal Task', todayStr, false, ['personal']),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    // Check that tasks are rendered (grouping logic is tested in taskUtils)
    expect(screen.getByText('Work Task')).toBeInTheDocument();
    expect(screen.getByText('Personal Task')).toBeInTheDocument();
  });

  it('should handle viewing a different date', () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Future Task', futureDateStr),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={futureDate}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Future Task')).toBeInTheDocument();
    // Should not show overdue section when not viewing today
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });

  it('should handle tasks without tags', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Untagged Task', todayStr, false, []),
    ];

    render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Untagged Task')).toBeInTheDocument();
  });

  it('should toggle tag collapse when tag header is clicked', () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const tasks: Task[] = [
      createTask('1', 'Work Task', todayStr, false, ['work']),
    ];

    const { container } = render(
      <TodayView
        tasks={tasks}
        date={today}
        tagColors={tagColors}
        {...mockHandlers}
      />
    );

    // Initially, the task should be visible (tag is not collapsed)
    expect(screen.getByText('Work Task')).toBeInTheDocument();
    
    const tagHeader = container.querySelector('.tag-group-header');
    expect(tagHeader).toBeInTheDocument();
    
    if (tagHeader) {
      // Click to collapse the tag group
      fireEvent.click(tagHeader);
      // After clicking, the task should be hidden (collapsed)
      expect(screen.queryByText('Work Task')).not.toBeInTheDocument();
      
      // Click again to expand
      fireEvent.click(tagHeader);
      // Task should be visible again
      expect(screen.getByText('Work Task')).toBeInTheDocument();
    }
  });
});

