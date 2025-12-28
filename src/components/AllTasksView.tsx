import { useState } from 'react';
import { Task, getTagColor } from '../types';
import TaskCard from './TaskCard';
import { groupTasksByTag } from '../utils/taskUtils';

interface AllTasksViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

export default function AllTasksView({ tasks, tagColors, onToggleComplete, onEdit, onDelete, onUpdateTask }: AllTasksViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <h2>No outstanding tasks</h2>
        <p>All your tasks are completed! Add a new task to get started.</p>
      </div>
    );
  }

  const toggleTagCollapse = (tag: string) => {
    setCollapsedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tag)) {
        newSet.delete(tag);
      } else {
        newSet.add(tag);
      }
      return newSet;
    });
  };

  const { grouped, sortedTags } = groupTasksByTag(tasks);

  return (
    <div className="task-list">
      {sortedTags.map(tag => {
        const tagTasks = grouped[tag];
        const tagColor = tag === 'untagged' 
          ? getTagColor('default', tagColors)
          : getTagColor(tag, tagColors);
        const tagDisplay = tag === 'untagged' ? 'Untagged' : tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
        const isCollapsed = collapsedTags.has(tag);

        return (
          <div key={tag} className="tag-group">
            <div 
              className="tag-group-header" 
              style={{ borderLeftColor: tagColor }}
              onClick={() => toggleTagCollapse(tag)}
            >
              <span className="tag-group-collapse-icon">
                {isCollapsed ? '▶' : '▼'}
              </span>
              <span className="tag-group-name" style={{ color: tagColor }}>
                {tagDisplay}
              </span>
              <span className="tag-group-count" style={{ color: tagColor }}>{tagTasks.length}</span>
            </div>
            {!isCollapsed && (
              <div className="tag-group-tasks">
                {tagTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    tagColors={tagColors}
                    onToggleComplete={onToggleComplete}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onUpdateTask={onUpdateTask}
                    showDate={true}
                    showTags={false}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
