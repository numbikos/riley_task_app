import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatsView from '../StatsView';
import { Task } from '../../types';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: `task-${Math.random().toString(36).substr(2, 9)}`,
  title: 'Test Task',
  dueDate: null,
  completed: false,
  subtasks: [],
  tags: [],
  createdAt: new Date().toISOString(),
  lastModified: new Date().toISOString(),
  recurrence: null,
  recurrenceGroupId: null,
  isLastInstance: false,
  autoRenew: false,
  ...overrides,
});

// Helper to format date as YYYY-MM-DD
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const defaultProps = {
  tasks: [],
  tagColors: {},
};

describe('StatsView', () => {
  it('renders the stats title', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('Task Statistics')).toBeInTheDocument();
  });

  it('renders all section titles', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('Last 7 Days')).toBeInTheDocument();
    expect(screen.getByText('Tag Distribution')).toBeInTheDocument();
  });

  it('shows zero values when no tasks exist', () => {
    render(<StatsView {...defaultProps} />);

    // Check for the stat card values showing 0
    const valueElements = screen.getAllByText('0');
    expect(valueElements.length).toBeGreaterThanOrEqual(4); // At least 4 stat cards
  });

  it('shows empty message when no tags used', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('No tags used yet')).toBeInTheDocument();
  });

  it('displays completion rate as percentage', () => {
    const tasks = [
      createTask({ completed: true }),
      createTask({ completed: false }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    expect(screen.getByText('50.0%')).toBeInTheDocument();
  });

  it('displays completion counts', () => {
    const tasks = [
      createTask({ completed: true }),
      createTask({ completed: true }),
      createTask({ completed: false }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    expect(screen.getByText('2 completed / 3 total')).toBeInTheDocument();
  });

  it('displays overdue count', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const tasks = [
      createTask({ completed: false, dueDate: formatDate(yesterday) }),
      createTask({ completed: false, dueDate: formatDate(yesterday) }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    // Find the overdue card value
    const overdueLabel = screen.getByText('Overdue');
    const overdueCard = overdueLabel.closest('.stats-card');
    expect(overdueCard).toBeInTheDocument();
    expect(overdueCard).toHaveTextContent('2');
  });

  it('displays tag distribution when tags exist', () => {
    const tasks = [
      createTask({ tags: ['work'] }),
      createTask({ tags: ['work'] }),
      createTask({ tags: ['personal'] }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    expect(screen.queryByText('No tags used yet')).not.toBeInTheDocument();
    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('personal')).toBeInTheDocument();
  });

  it('displays tag counts and percentages', () => {
    const tasks = [
      createTask({ tags: ['work'] }),
      createTask({ tags: ['work'] }),
      createTask({ tags: ['personal'] }),
      createTask({ tags: ['personal'] }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    // Each tag has 2 out of 4 total (50%)
    const percentages = screen.getAllByText(/2 \(50%\)/);
    expect(percentages).toHaveLength(2);
  });

  it('displays completed today stat card', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('Completed Today')).toBeInTheDocument();
  });

  it('displays this week stat card', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('This Week')).toBeInTheDocument();
  });

  it('displays this month stat card', () => {
    render(<StatsView {...defaultProps} />);

    expect(screen.getByText('This Month')).toBeInTheDocument();
  });

  it('renders 7-day chart with day labels', () => {
    render(<StatsView {...defaultProps} />);

    // Should have day labels like Mon, Tue, Wed, etc.
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const foundLabels = dayLabels.filter(label => screen.queryByText(label));

    // At least some day labels should be present (depends on current day)
    expect(foundLabels.length).toBeGreaterThan(0);
  });

  it('uses tag colors from props', () => {
    const tasks = [createTask({ tags: ['custom'] })];
    const tagColors = { custom: '#FF5733' };

    render(<StatsView tasks={tasks} tagColors={tagColors} />);

    // The tag name should be visible
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('handles tasks with multiple tags', () => {
    const tasks = [
      createTask({ tags: ['work', 'urgent', 'project'] }),
    ];

    render(<StatsView {...defaultProps} tasks={tasks} />);

    expect(screen.getByText('work')).toBeInTheDocument();
    expect(screen.getByText('urgent')).toBeInTheDocument();
    expect(screen.getByText('project')).toBeInTheDocument();
  });

  it('limits tag distribution to 10 tags', () => {
    // Create tasks with 12 different tags
    const tasks = Array.from({ length: 12 }, (_, i) =>
      createTask({ tags: [`tag${i}`] })
    );

    render(<StatsView {...defaultProps} tasks={tasks} />);

    // Should only show first 10 tags
    expect(screen.getByText('tag0')).toBeInTheDocument();
    expect(screen.getByText('tag9')).toBeInTheDocument();
    expect(screen.queryByText('tag10')).not.toBeInTheDocument();
    expect(screen.queryByText('tag11')).not.toBeInTheDocument();
  });
});
