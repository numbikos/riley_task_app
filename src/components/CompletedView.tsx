import { Task } from '../types';
import TaskCard from './TaskCard';

interface CompletedViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

export default function CompletedView({ tasks, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask }: CompletedViewProps) {
  // Sort by most recently completed (lastModified) - most recent first
  const sortedTasks = [...tasks].sort((a, b) => {
    const aTime = new Date(a.lastModified).getTime();
    const bTime = new Date(b.lastModified).getTime();
    return bTime - aTime; // Descending order - most recent first
  });

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

