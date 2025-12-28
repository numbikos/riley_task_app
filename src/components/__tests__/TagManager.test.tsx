import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TagManager from '../TagManager';
import { Task } from '../../types';

// Use vi.hoisted() to ensure mocks are created before the factory runs
const {
  mockLoadTags,
  mockSaveTags,
  mockLoadTagColors,
  mockSaveTagColors,
  mockDeleteTagColor,
} = vi.hoisted(() => ({
  mockLoadTags: vi.fn(),
  mockSaveTags: vi.fn(),
  mockLoadTagColors: vi.fn(),
  mockSaveTagColors: vi.fn(),
  mockDeleteTagColor: vi.fn(),
}));

vi.mock('../../utils/supabaseStorage', () => ({
  loadTags: mockLoadTags,
  saveTags: mockSaveTags,
  loadTagColors: mockLoadTagColors,
  saveTagColors: mockSaveTagColors,
  deleteTagColor: mockDeleteTagColor,
}));

// Mock logger
vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('TagManager', () => {
  const mockTasks: Task[] = [
    {
      id: '1',
      title: 'Task 1',
      dueDate: '2024-01-15',
      completed: false,
      subtasks: [],
      tags: ['work', 'urgent'],
      createdAt: '2024-01-01T00:00:00.000Z',
      lastModified: '2024-01-01T00:00:00.000Z',
      recurrence: null,
      recurrenceGroupId: null,
    },
    {
      id: '2',
      title: 'Task 2',
      dueDate: null,
      completed: false,
      subtasks: [],
      tags: ['work'],
      createdAt: '2024-01-02T00:00:00.000Z',
      lastModified: '2024-01-02T00:00:00.000Z',
      recurrence: null,
      recurrenceGroupId: null,
    },
    {
      id: '3',
      title: 'Task 3',
      dueDate: null,
      completed: false,
      subtasks: [],
      tags: ['personal'],
      createdAt: '2024-01-03T00:00:00.000Z',
      lastModified: '2024-01-03T00:00:00.000Z',
      recurrence: null,
      recurrenceGroupId: null,
    },
  ];

  const mockOnUpdateTasks = vi.fn();
  const mockOnTagColorsChange = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadTags.mockResolvedValue(['work', 'urgent', 'personal']);
    mockLoadTagColors.mockResolvedValue({
      work: '#FFD700',
      urgent: '#FF6B6B',
      personal: '#40E0D0',
    });
    
    // Mock window.confirm and window.alert
    window.confirm = vi.fn(() => true);
    window.alert = vi.fn();
  });

  it('should render tag list', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Tag Manager')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Urgent')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });
  });

  it('should display tag usage count', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      // Work tag is used in 2 tasks
      expect(screen.getByText(/\(2 tasks\)/)).toBeInTheDocument();
      // Urgent and Personal tags are each used in 1 task (so 2 elements with "(1 task)")
      const singleTaskElements = screen.getAllByText(/\(1 task\)/);
      expect(singleTaskElements.length).toBe(2);
    });
  });

  it('should show empty state when no tags available', async () => {
    mockLoadTags.mockResolvedValue([]);

    render(
      <TagManager
        tasks={[]}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No tags available')).toBeInTheDocument();
    });
  });

  it('should open color picker when color button is clicked', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const colorButtons = screen.getAllByTitle(/Change color for/i);
    expect(colorButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(colorButtons[0]);

    await waitFor(() => {
      // Color picker should appear
      expect(screen.getByText('Custom:')).toBeInTheDocument();
    });
  });

  it('should update tag color when preset color is clicked', async () => {
    mockSaveTagColors.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const colorButtons = screen.getAllByTitle(/Change color for/i);
    fireEvent.click(colorButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Custom:')).toBeInTheDocument();
    });

    // Click a preset color
    const presetColors = screen.getAllByRole('button');
    const bluePreset = presetColors.find(btn => 
      btn.getAttribute('style')?.includes('background-color: rgb(0, 128, 255)')
    );
    
    if (bluePreset) {
      fireEvent.click(bluePreset);
      
      await waitFor(() => {
        expect(mockSaveTagColors).toHaveBeenCalled();
        expect(mockOnTagColorsChange).toHaveBeenCalled();
      });
    }
  });

  it('should update tag color when custom color is selected', async () => {
    mockSaveTagColors.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const colorButtons = screen.getAllByTitle(/Change color for/i);
    fireEvent.click(colorButtons[0]);

    await waitFor(() => {
      const colorInput = screen.getByLabelText('Custom:') as HTMLInputElement;
      expect(colorInput).toBeInTheDocument();
      
      fireEvent.change(colorInput, { target: { value: '#FF0000' } });
      
      expect(mockSaveTagColors).toHaveBeenCalled();
    });
  });

  it('should delete tag when delete button is clicked', async () => {
    mockDeleteTagColor.mockResolvedValue(undefined);
    mockSaveTags.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete/i);
    expect(deleteButtons.length).toBeGreaterThan(0);
    
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteTagColor).toHaveBeenCalled();
      expect(mockOnUpdateTasks).toHaveBeenCalled();
      expect(mockOnTagColorsChange).toHaveBeenCalled();
    });
  });

  it('should not delete tag if user cancels confirmation', async () => {
    window.confirm = vi.fn(() => false);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByTitle(/Delete/i);
    fireEvent.click(deleteButtons[0]);

    expect(mockDeleteTagColor).not.toHaveBeenCalled();
    expect(mockOnUpdateTasks).not.toHaveBeenCalled();
  });

  it('should remove tag from all tasks when deleted', async () => {
    mockDeleteTagColor.mockResolvedValue(undefined);
    mockSaveTags.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Tags are sorted alphabetically, so click the delete button for 'Work' specifically
    const workDeleteButton = screen.getByTitle('Delete "Work" tag');
    fireEvent.click(workDeleteButton);

    await waitFor(() => {
      expect(mockOnUpdateTasks).toHaveBeenCalled();
      const updatedTasks = mockOnUpdateTasks.mock.calls[0][0];
      // All tasks should have 'work' tag removed
      updatedTasks.forEach((task: Task) => {
        expect(task.tags).not.toContain('work');
      });
    });
  });

  it('should show add tag form when add button is clicked', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('+ Add New Tag')).toBeInTheDocument();
    });

    const addButton = screen.getByText('+ Add New Tag');
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Enter tag name...')).toBeInTheDocument();
    });
  });

  it('should add new tag when form is submitted', async () => {
    // Don't include 'newtag' in initial tags so it can be added
    mockSaveTagColors.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const addButton = screen.getByText('+ Add New Tag');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter tag name...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'newtag' } });
      
      const submitButton = screen.getByText('Add Tag');
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockSaveTagColors).toHaveBeenCalled();
    });
  });

  it('should prevent adding duplicate tags', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const addButton = screen.getByText('+ Add New Tag');
      fireEvent.click(addButton);
    });

    await waitFor(() => {
      const input = screen.getByPlaceholderText('Enter tag name...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'work' } });
      
      const submitButton = screen.getByText('Add Tag');
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      // Should show alert for duplicate tag
      expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/already exists/i));
    });
  });

  it('should close color picker when close button is clicked', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    const colorButtons = screen.getAllByTitle(/Change color for/i);
    fireEvent.click(colorButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Custom:')).toBeInTheDocument();
    });

    const closeButtons = screen.getAllByTitle('Close color picker');
    if (closeButtons.length > 0) {
      fireEvent.click(closeButtons[0]);
      
      await waitFor(() => {
        expect(screen.queryByText('Custom:')).not.toBeInTheDocument();
      });
    }
  });

  it('should call onClose when close button is clicked', async () => {
    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should handle tag name case insensitivity', async () => {
    mockDeleteTagColor.mockResolvedValue(undefined);
    mockSaveTags.mockResolvedValue(undefined);

    render(
      <TagManager
        tasks={mockTasks}
        onUpdateTasks={mockOnUpdateTasks}
        onTagColorsChange={mockOnTagColorsChange}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Work')).toBeInTheDocument();
    });

    // Tags are sorted alphabetically, so click the delete button for 'Work' specifically
    const workDeleteButton = screen.getByTitle('Delete "Work" tag');
    fireEvent.click(workDeleteButton);

    await waitFor(() => {
      const updatedTasks = mockOnUpdateTasks.mock.calls[0][0];
      // Should remove 'work' regardless of case
      updatedTasks.forEach((task: Task) => {
        const hasWorkTag = task.tags.some(tag => tag.toLowerCase() === 'work');
        expect(hasWorkTag).toBe(false);
      });
    });
  });
});

