import { useState, useMemo } from 'react';
import { Task, TaskUpdate, getTagColor } from '../types';
import TaskCard from './TaskCard';
import RecurringTaskGroup from './RecurringTaskGroup';
import { groupTasksByTag } from '../utils/taskUtils';

interface AllTasksViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onDeleteGroup?: (groupId: string) => void;
  onUpdateTask?: (id: string, updates: TaskUpdate) => void;
  onAddTask?: (date: Date) => void;
}

export default function AllTasksView({ tasks, tagColors, onToggleComplete, onEdit, onDelete, onDeleteGroup, onUpdateTask, onAddTask }: AllTasksViewProps) {
  const [collapsedTags, setCollapsedTags] = useState<Set<string>>(new Set());

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

  // Separate recurring and non-recurring tasks - memoized
  const { grouped, recurringByTag, sortedAllTags } = useMemo(() => {
    const recurringTasks: Task[] = [];
    const nonRecurringTasks: Task[] = [];
    const recurringGroups: Map<string, Task[]> = new Map();

    tasks.forEach(task => {
      if (task.recurrenceGroupId) {
        if (!recurringGroups.has(task.recurrenceGroupId)) {
          recurringGroups.set(task.recurrenceGroupId, []);
        }
        recurringGroups.get(task.recurrenceGroupId)!.push(task);
        recurringTasks.push(task);
      } else {
        nonRecurringTasks.push(task);
      }
    });

    // Group non-recurring tasks by tag
    const { grouped, sortedTags } = groupTasksByTag(nonRecurringTasks);
    
    // Group recurring tasks by tag (using the first task in each group as representative)
    const recurringByTag: { [key: string]: Map<string, Task[]> } = {};
    recurringGroups.forEach((groupTasks, groupId) => {
      const representativeTask = groupTasks[0];
      const tag = representativeTask.tags.length > 0 ? representativeTask.tags[0].toLowerCase() : 'untagged';
      if (!recurringByTag[tag]) {
        recurringByTag[tag] = new Map();
      }
      recurringByTag[tag].set(groupId, groupTasks);
    });

    // Get all tags that have either recurring or non-recurring tasks
    const allTags = new Set([...sortedTags, ...Object.keys(recurringByTag)]);
    const sortedAllTags = Array.from(allTags).sort((a, b) => {
      if (a === 'untagged') return 1;
      if (b === 'untagged') return -1;
      return a.localeCompare(b);
    });

    return { grouped, recurringByTag, sortedAllTags };
  }, [tasks]);

  // Early return AFTER all hooks have been called
  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <h2>No outstanding tasks</h2>
        <p>All your tasks are completed! Add a new task to get started.</p>
        {onAddTask && (
          <button
            className="empty-state-add-task-btn"
            onClick={() => onAddTask(new Date())}
          >
            Add task
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="task-list">
      {sortedAllTags.map(tag => {
        const tagColor = tag === 'untagged' 
          ? getTagColor('default', tagColors)
          : getTagColor(tag, tagColors);
        const tagDisplay = tag === 'untagged' ? 'Untagged' : tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
        const isCollapsed = collapsedTags.has(tag);

        const nonRecurringTagTasks = grouped[tag] || [];
        const recurringTagGroups = recurringByTag[tag] || new Map();
        const hasTasks = nonRecurringTagTasks.length > 0 || recurringTagGroups.size > 0;

        if (!hasTasks) return null;

        const totalCount = nonRecurringTagTasks.length + recurringTagGroups.size;

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
              <span className="tag-group-count" style={{ color: tagColor }}>{totalCount}</span>
            </div>
            {!isCollapsed && (
              <div className="tag-group-tasks">
                {/* Show recurring task groups */}
                {Array.from(recurringTagGroups.values()).map(groupTasks => {
                  // Count incomplete tasks
                  const incompleteTasks = groupTasks.filter(task => !task.completed);
                  
                  // If only 1 remaining, show as individual task card
                  if (incompleteTasks.length === 1) {
                    return (
                      <TaskCard
                        key={incompleteTasks[0].id}
                        task={incompleteTasks[0]}
                        tagColors={tagColors}
                        onToggleComplete={onToggleComplete}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onUpdateTask={onUpdateTask}
                        showDate={true}
                        showTags={false}
                      />
                    );
                  }
                  
                  // Otherwise show as grouped
                  return (
                    <RecurringTaskGroup
                      key={groupTasks[0].recurrenceGroupId}
                      tasks={groupTasks}
                      tagColors={tagColors}
                      onToggleComplete={onToggleComplete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onDeleteGroup={onDeleteGroup}
                      onUpdateTask={onUpdateTask}
                      hideActions={true}
                    />
                  );
                })}
                {/* Show non-recurring tasks */}
                {nonRecurringTagTasks.map(task => (
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
