import { Task, TaskUpdate, getTagColor } from '../types';
import TaskCard from './TaskCard';
import { groupTasksByTag } from '../utils/taskUtils';

interface GroupedTaskListProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  collapsedTags: Set<string>;
  onToggleTagCollapse: (tag: string) => void;
  showDate?: boolean;
}

export default function GroupedTaskList({
  tasks,
  tagColors,
  onToggleComplete,
  onEdit,
  onDelete,
  onUpdateTask,
  collapsedTags,
  onToggleTagCollapse,
  showDate = false
}: GroupedTaskListProps) {
  const { grouped, sortedTags } = groupTasksByTag(tasks);

  return (
    <>
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
              onClick={() => onToggleTagCollapse(tag)}
            >
              <span className="tag-group-collapse-icon" style={{ color: tagColor }}>
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
                    showTags={false}
                    showDate={showDate}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

