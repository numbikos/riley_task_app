import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from '../TaskCard';
import { Task } from '../../types';

describe('TaskCard', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    dueDate: '2024-01-15',
    completed: false,
    subtasks: [],
    tags: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    lastModified: '2024-01-01T00:00:00.000Z',
    recurrence: null,
    recurrenceGroupId: null,
  };

  const mockHandlers = {
    onToggleComplete: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onUpdateTask: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render task title', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render completed checkbox', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('should show checked checkbox for completed task', () => {
    const completedTask = { ...mockTask, completed: true };
    render(<TaskCard task={completedTask} {...mockHandlers} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeChecked();
  });

  it('should call onToggleComplete when checkbox is clicked', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockHandlers.onToggleComplete).toHaveBeenCalledWith('1');
  });

  it('should call onEdit when card is clicked', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const card = screen.getByText('Test Task').closest('.task-card');
    fireEvent.click(card!);
    expect(mockHandlers.onEdit).toHaveBeenCalledWith(mockTask);
  });

  it('should not call onEdit when checkbox is clicked', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(mockHandlers.onToggleComplete).toHaveBeenCalled();
    expect(mockHandlers.onEdit).not.toHaveBeenCalled();
  });

  it('should call onDelete when delete button is clicked', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const deleteButton = screen.getByTitle('Delete task');
    fireEvent.click(deleteButton);
    expect(mockHandlers.onDelete).toHaveBeenCalledWith('1');
  });

  it('should not call onEdit when delete button is clicked', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} />);
    const deleteButton = screen.getByTitle('Delete task');
    fireEvent.click(deleteButton);
    expect(mockHandlers.onDelete).toHaveBeenCalled();
    expect(mockHandlers.onEdit).not.toHaveBeenCalled();
  });

  it('should render tags when showTags is true', () => {
    const taskWithTags = { ...mockTask, tags: ['work', 'urgent'] };
    render(<TaskCard task={taskWithTags} {...mockHandlers} showTags={true} />);
    expect(screen.getByText('Work')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
  });

  it('should not render tags when showTags is false', () => {
    const taskWithTags = { ...mockTask, tags: ['work'] };
    render(<TaskCard task={taskWithTags} {...mockHandlers} showTags={false} />);
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });

  it('should render date when showDate is true', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} showDate={true} />);
    expect(screen.getByText(/Due:/)).toBeInTheDocument();
  });

  it('should not render date when showDate is false', () => {
    render(<TaskCard task={mockTask} {...mockHandlers} showDate={false} />);
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
  });

  it('should render subtasks', () => {
    const taskWithSubtasks = {
      ...mockTask,
      subtasks: [
        { id: 's1', text: 'Subtask 1', completed: false },
        { id: 's2', text: 'Subtask 2', completed: true },
      ],
    };
    render(<TaskCard task={taskWithSubtasks} {...mockHandlers} />);
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();
    expect(screen.getByText('Subtask 2')).toBeInTheDocument();
  });

  it('should render subtask progress', () => {
    const taskWithSubtasks = {
      ...mockTask,
      subtasks: [
        { id: 's1', text: 'Subtask 1', completed: false },
        { id: 's2', text: 'Subtask 2', completed: true },
      ],
    };
    render(<TaskCard task={taskWithSubtasks} {...mockHandlers} />);
    expect(screen.getByText('1 of 2 completed')).toBeInTheDocument();
  });

  it('should call onUpdateTask when subtask checkbox is clicked', () => {
    const taskWithSubtasks = {
      ...mockTask,
      subtasks: [{ id: 's1', text: 'Subtask 1', completed: false }],
    };
    render(<TaskCard task={taskWithSubtasks} {...mockHandlers} />);
    const subtaskCheckboxes = screen.getAllByRole('checkbox');
    // Second checkbox is the subtask checkbox
    fireEvent.click(subtaskCheckboxes[1]);
    expect(mockHandlers.onUpdateTask).toHaveBeenCalled();
  });

  it('should render recurrence display when task has recurrence', () => {
    const recurringTask = { ...mockTask, recurrence: 'daily' as const };
    render(<TaskCard task={recurringTask} {...mockHandlers} />);
    expect(screen.getByText(/Repeats/)).toBeInTheDocument();
  });

  it('should render "PLEASE RENEW" warning for last instance', () => {
    const lastInstanceTask = { ...mockTask, isLastInstance: true };
    render(<TaskCard task={lastInstanceTask} {...mockHandlers} />);
    expect(screen.getByText(/PLEASE RENEW/)).toBeInTheDocument();
  });

  it('should apply completed class when task is completed', () => {
    const completedTask = { ...mockTask, completed: true };
    const { container } = render(<TaskCard task={completedTask} {...mockHandlers} />);
    const card = container.querySelector('.task-card');
    expect(card).toHaveClass('completed');
  });
});

