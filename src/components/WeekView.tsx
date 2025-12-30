import { useState, useEffect } from 'react';
import { Task, TaskUpdate, getTagColor as getTagColorUtil } from '../types';
import NavigationHeader from './NavigationHeader';
import { getNext5Days, formatDate, isSameDate, getDateDisplay, addDays, subDays, formatFullDate } from '../utils/dateUtils';
import { startOfDay } from 'date-fns';

interface WeekViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onToggleComplete: (id: string) => void;
  onEdit: (task: Task) => void;
  onUpdateTask: (id: string, updates: TaskUpdate) => void;
  onNavigateToDay?: (date: Date, weekDate: Date) => void;
  initialWeekDate?: Date | null;
  onAddTask?: (date: Date) => void;
}

export default function WeekView({ tasks, tagColors, onToggleComplete, onEdit, onUpdateTask, onNavigateToDay, initialWeekDate, onAddTask }: WeekViewProps) {
  const [currentWeekDate, setCurrentWeekDate] = useState(() => {
    // Use initialWeekDate if provided, otherwise use today
    if (initialWeekDate) {
      return startOfDay(initialWeekDate);
    }
    // Use local timezone - normalize to start of day
    return startOfDay(new Date());
  });

  // Update week date when initialWeekDate changes (e.g., when navigating back from day view)
  useEffect(() => {
    if (initialWeekDate) {
      setCurrentWeekDate(startOfDay(initialWeekDate));
    }
  }, [initialWeekDate]);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const weekDates = getNext5Days(currentWeekDate);
  const today = startOfDay(new Date());

  const minSwipeDistance = 50;

  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't start swipe detection if we're dragging or touching a task item
    const target = e.target as HTMLElement;
    const isTaskItem = target.closest('.week-task-item') !== null;
    const isTaskButton = target.closest('.week-add-task-btn') !== null;
    
    if (isDragging || isTaskItem || isTaskButton) {
      return;
    }
    
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Don't track swipe if we're dragging
    if (isDragging) {
      return;
    }
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    // Don't process swipe if we're dragging
    if (isDragging || !touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentWeekDate(addDays(currentWeekDate, 5));
    } else if (isRightSwipe) {
      setCurrentWeekDate(subDays(currentWeekDate, 5));
    }
    
    // Reset touch state
    setTouchStart(null);
    setTouchEnd(null);
  };

  const goToPreviousWeek = () => {
    setCurrentWeekDate(subDays(currentWeekDate, 5));
  };

  const goToNextWeek = () => {
    setCurrentWeekDate(addDays(currentWeekDate, 5));
  };

  const goToToday = () => {
    // Use local timezone - normalize to start of day
    setCurrentWeekDate(startOfDay(new Date()));
  };

  const getTasksForDate = (date: Date) => {
    // Use local timezone to match device timezone
    const dateStr = formatDate(date);
    
    const filteredTasks = tasks.filter(task => {
      if (task.completed || !task.dueDate) return false;
      // Handle both 'yyyy-MM-dd' format and ISO strings
      const taskDateStr = task.dueDate.split('T')[0]; // Get just the date part if it's an ISO string
      return taskDateStr === dateStr;
    });
    
    // Sort tasks by tag: untagged last, others alphabetically
    return filteredTasks.sort((a, b) => {
      const tagA = a.tags.length > 0 ? a.tags[0].toLowerCase() : 'untagged';
      const tagB = b.tags.length > 0 ? b.tags[0].toLowerCase() : 'untagged';
      
      if (tagA === 'untagged' && tagB !== 'untagged') return 1;
      if (tagB === 'untagged' && tagA !== 'untagged') return -1;
      return tagA.localeCompare(tagB);
    });
  };

  const getTagColor = (task: Task) => {
    const tag = task.tags.length > 0 ? task.tags[0].toLowerCase() : 'untagged';
    return tag === 'untagged' 
      ? getTagColorUtil('default', tagColors)
      : getTagColorUtil(tag, tagColors);
  };

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setIsDragging(true);
    e.dataTransfer.setData('taskId', task.id);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setIsDragging(false);
    const taskId = e.dataTransfer.getData('taskId');
    const targetDateStr = formatDate(targetDate);
    // Use a flag to indicate this is a drag-and-drop operation
    // This tells updateTask to only update this instance, not regenerate the recurrence group
    onUpdateTask(taskId, { dueDate: targetDateStr, _dragDrop: true });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <NavigationHeader
        title={`${formatFullDate(weekDates[0])} - ${formatFullDate(weekDates[weekDates.length - 1])}`}
        onPrev={goToPreviousWeek}
        onNext={goToNextWeek}
        onToday={goToToday}
        className="week-view-header"
        titleClassName="week-title"
      />
      <div className="week-view">
        {weekDates.map((date, index) => {
          const dayTasks = getTasksForDate(date);
          const isToday = isSameDate(date, today);
          const dateDisplay = getDateDisplay(date);
          const isClickable = !!onNavigateToDay;
          
          const handleDayHeaderClick = () => {
            if (isClickable && onNavigateToDay) {
              onNavigateToDay(date, currentWeekDate);
            }
          };
          
          return (
            <div
              key={index}
              className="week-day"
              onDrop={(e) => handleDrop(e, date)}
              onDragOver={handleDragOver}
            >
              <div 
                className="week-day-header" 
                style={{ 
                  color: isToday ? 'var(--secondary)' : 'var(--text-secondary)',
                  cursor: isClickable ? 'pointer' : 'default',
                  textDecoration: isClickable ? 'underline' : 'none'
                }}
                onClick={handleDayHeaderClick}
                title={isClickable ? `Click to view tasks for ${dateDisplay.toLowerCase()}` : undefined}
              >
                {dateDisplay}
              </div>
              <div className="week-day-tasks">
                {dayTasks.length === 0 ? (
                  onAddTask ? (
                    <button
                      className="week-add-task-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddTask(date);
                      }}
                    >
                      Add task
                    </button>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic', padding: '0.5rem' }}>
                      No tasks
                    </div>
                  )
                ) : (
                  dayTasks.map(task => {
                    const tagColor = getTagColor(task);
                    return (
                      <div
                        key={task.id}
                        className={`week-task-item ${task.completed ? 'completed' : ''}`}
                        draggable={!task.completed}
                        onDragStart={(e) => !task.completed && handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          // Don't open edit if clicking on checkbox
                          const target = e.target as HTMLElement;
                          if (target.tagName !== 'INPUT' || (target as HTMLInputElement).type !== 'checkbox') {
                            onEdit(task);
                          }
                        }}
                        style={{ borderLeftColor: tagColor }}
                      >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={(e) => {
                          e.stopPropagation();
                          onToggleComplete(task.id);
                        }}
                        className="week-task-checkbox"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="week-task-title" style={{ textDecoration: task.completed ? 'line-through' : 'none', opacity: task.completed ? 0.6 : 1 }}>
                        {task.title}
                      </div>
                    </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
