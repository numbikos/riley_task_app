import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TagManager from '../TagManager';
import { Task } from '../../types';

const { mockLoadTags } = vi.hoisted(() => ({
  mockLoadTags: vi.fn(),
}));

vi.mock('../../utils/supabaseStorage', () => ({
  loadTags: mockLoadTags,
  saveTags: vi.fn().mockResolvedValue(undefined),
  loadTagColors: vi.fn().mockResolvedValue({}),
  saveTagColors: vi.fn().mockResolvedValue(undefined),
  deleteTagColor: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../utils/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const task: Task = {
  id: 'task-1',
  title: 'Task',
  dueDate: '2026-03-02',
  completed: false,
  subtasks: [],
  tags: ['work'],
  createdAt: '2026-01-01T00:00:00.000Z',
  lastModified: '2026-01-01T00:00:00.000Z',
  recurrence: null,
  recurrenceGroupId: null,
};

describe('TagManager', () => {
  beforeEach(() => {
    // The database keeps returning the old tag (the renamed tasks haven't been saved yet)
    mockLoadTags.mockReset();
    mockLoadTags.mockResolvedValue(['work']);
  });

  it('shows only the new name after renaming a tag', async () => {
    const onUpdateTasks = vi.fn();
    render(<TagManager tasks={[task]} onUpdateTasks={onUpdateTasks} onClose={vi.fn()} />);

    fireEvent.click(await screen.findByTitle('Rename "Work" tag'));
    const input = screen.getByDisplayValue('Work');
    fireEvent.change(input, { target: { value: 'Office' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(onUpdateTasks).toHaveBeenCalled());
    expect(onUpdateTasks.mock.calls[0][0][0].tags).toEqual(['office']);
    await waitFor(() => expect(screen.getByText('Office')).toBeInTheDocument());
    expect(screen.queryByText('Work')).not.toBeInTheDocument();
  });
});
