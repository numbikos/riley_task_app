import { useMemo } from 'react';
import { Task, TaskUpdate } from '../types';
import TaskCard from './TaskCard';

interface CompletedViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
}

export default function CompletedView({ tasks, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask }: CompletedViewProps) {
  // Sort by most recently completed (lastModified) - most recent first
  // Secondary sort by createdAt (most recent first) for stable sorting when lastModified is identical
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = new Date(a.lastModified).getTime();
      const bTime = new Date(b.lastModified).getTime();
      
      if (aTime !== bTime) {
        return bTime - aTime; // Descending order - most recent first
      }
      // If lastModified is the same, sort by createdAt (most recent first) as tiebreaker
      const aCreatedTime = new Date(a.createdAt).getTime();
      const bCreatedTime = new Date(b.createdAt).getTime();
      return bCreatedTime - aCreatedTime; // Descending order - most recent first
    });
  }, [tasks]);

  if (sortedTasks.length === 0) {
    return (
      <div className="empty-state">
        <h2>No completed tasks</h2>
        <p>Tasks you complete will appear here.</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {sortedTasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          tagColors={tagColors}
          onToggleComplete={onToggleComplete}
          onEdit={onEdit}
          onDelete={onDelete}
          onUpdateTask={onUpdateTask}
          showDate={true}
        />
      ))}
    </div>
  );
}

