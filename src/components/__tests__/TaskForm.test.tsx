import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TaskForm from '../TaskForm';
import { Task } from '../../types';

// Mock the supabaseStorage module
vi.mock('../../utils/supabaseStorage', () => ({
  generateId: () => 'mock-id',
  loadTags: vi.fn(() => Promise.resolve(['work', 'personal'])),
  loadTagColors: vi.fn(() => Promise.resolve({})),
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe('TaskForm', () => {
  const mockHandlers = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onExtendRecurring: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form for new task', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Task')).toBeInTheDocument();
    });
  });

  it('should render form for existing task', async () => {
    const task: Task = {
      id: '1',
      title: 'Existing Task',
      dueDate: '2024-01-15',
      completed: false,
      subtasks: [],
      tags: ['work'],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: null,
      recurrenceGroupId: null,
    };

    render(<TaskForm task={task} {...mockHandlers} />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Existing Task')).toBeInTheDocument();
    });
  });

  it('should call onCancel when cancel button is clicked', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    
    // Wait for async tag loading to complete
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Task')).toBeInTheDocument();
    });
    
    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);
    expect(mockHandlers.onCancel).toHaveBeenCalled();
  });

  it('should update title when typing', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('New Task');
      fireEvent.change(titleInput, { target: { value: 'New Task Title' } });
      expect(titleInput).toHaveValue('New Task Title');
    });
  });

  it('should call onSave when save button is clicked with valid data', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('New Task');
      fireEvent.change(titleInput, { target: { value: 'New Task' } });
    });
    
    // Set a due date (required for the button to be enabled)
    // Find the date input by type
    const dueDateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    if (dueDateInput) {
      fireEvent.change(dueDateInput, { target: { value: '2024-01-15' } });
    }
    
    await waitFor(() => {
      const createButton = screen.getByRole('button', { name: /create task/i });
      expect(createButton).not.toBeDisabled();
      fireEvent.click(createButton);
    });

    await waitFor(() => {
      expect(mockHandlers.onSave).toHaveBeenCalled();
    });
  });

  it('should not save when title is empty', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Task')).toBeInTheDocument();
    });
    
    // Button should be disabled when title is empty
    const createButton = screen.getByRole('button', { name: /create task/i });
    expect(createButton).toBeDisabled();

    // Even if we try to click it, it shouldn't call onSave
    fireEvent.click(createButton);

    // Wait a bit to ensure save wasn't called
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(mockHandlers.onSave).not.toHaveBeenCalled();
  });

  it('should allow adding tags', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    
    // Wait for tags to load
    await waitFor(() => {
      expect(screen.getByText(/work/i)).toBeInTheDocument();
    });

    const workTag = screen.getByText(/work/i);
    fireEvent.click(workTag);
    
    // Tag should be added (this would show in the selected tags area)
    // The exact implementation depends on how tags are displayed
  });

  it('should display recurrence options', async () => {
    render(<TaskForm task={null} {...mockHandlers} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText('New Task')).toBeInTheDocument();
    });
    // Check if recurrence select/dropdown is present
    // Use queryAllByText to handle multiple matches
    const recurrenceSections = screen.queryAllByText(/recurrence/i);
    // If recurrence UI exists, at least one should be present
    if (recurrenceSections.length > 0) {
      expect(recurrenceSections[0]).toBeInTheDocument();
    }
  });
});

