import { useState, useEffect, useRef, useMemo, Fragment } from 'react';
import { Task, ViewType } from '../types';
import {
  filterTasksBySearch,
  getTodayTasks,
  getTomorrowTasks,
  getDayTasks,
  getCompletedTasks,
} from '../utils/taskOperations';
import {
  formatDateLong,
  formatDate,
  isDateToday,
  isDateTomorrow,
  isDateOverdue,
  getNext5Days,
} from '../utils/dateUtils';

interface GlobalSearchProps {
  tasks: Task[];
  tagColors: Record<string, string>;
  onSelectTask: (task: Task) => void;
  query: string;
  setQuery: (query: string) => void;
  currentView: ViewType;
  todayViewDate: Date;
  tomorrowViewDate: Date;
  selectedDayDate: Date | null;
  weekViewDate: Date | null;
  hasMoreCompletedTasks?: boolean;
  onLoadMoreCompleted?: () => void;
}

interface SearchResult {
  mainTask: Task;
  otherInstances: Task[];
}

export default function GlobalSearch({
  tasks,
  tagColors,
  onSelectTask,
  query,
  setQuery,
  currentView,
  todayViewDate,
  tomorrowViewDate,
  selectedDayDate,
  weekViewDate,
  hasMoreCompletedTasks,
  onLoadMoreCompleted,
}: GlobalSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get view-scoped tasks based on current view
  const viewScopedTasks = useMemo((): Task[] => {
    switch (currentView) {
      case 'completed':
        return getCompletedTasks(tasks);
      case 'today':
        return getTodayTasks(tasks, todayViewDate, isDateToday, isDateOverdue, formatDate);
      case 'tomorrow':
        return getTomorrowTasks(tasks, tomorrowViewDate, isDateTomorrow, formatDate);
      case 'day':
        return selectedDayDate
          ? getDayTasks(tasks, selectedDayDate, formatDate)
          : [];
      case 'week': {
        // Filter to 5-day window starting from weekViewDate
        const weekStart = weekViewDate || new Date();
        const weekDates = getNext5Days(weekStart);
        const weekDateStrings = weekDates.map(d => formatDate(d));
        return tasks.filter(t => {
          if (t.completed || !t.dueDate) return false;
          const taskDate = t.dueDate.split('T')[0];
          return weekDateStrings.includes(taskDate);
        });
      }
      case 'all':
      default:
        return tasks.filter(t => !t.completed);
    }
  }, [tasks, currentView, todayViewDate, tomorrowViewDate, selectedDayDate, weekViewDate]);

  // Filter and group search results
  const searchResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];

    // 1. Filter view-scoped tasks by search query
    const searchedTasks = filterTasksBySearch(viewScopedTasks, query);

    // 2. Sort by due date (earliest first) for non-completed, by lastModified for completed
    const sortedTasks = [...searchedTasks].sort((a, b) => {
      if (currentView === 'completed') {
        // Sort completed by lastModified (most recent first)
        const aDate = a.lastModified || '';
        const bDate = b.lastModified || '';
        return bDate.localeCompare(aDate);
      }
      // Sort by due date (earliest first)
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

    // 3. Group recurring tasks
    const groups = new Map<string, SearchResult>();
    const standaloneResults: SearchResult[] = [];

    for (const task of sortedTasks) {
      if (task.recurrenceGroupId) {
        if (!groups.has(task.recurrenceGroupId)) {
          const result: SearchResult = { mainTask: task, otherInstances: [] };
          groups.set(task.recurrenceGroupId, result);
          standaloneResults.push(result);
        } else {
          groups.get(task.recurrenceGroupId)!.otherInstances.push(task);
        }
      } else {
        standaloneResults.push({ mainTask: task, otherInstances: [] });
      }
    }

    return standaloneResults.slice(0, 8);
  }, [viewScopedTasks, query, currentView]);

  // Dynamic placeholder text based on current view
  const placeholderText = useMemo(() => {
    switch (currentView) {
      case 'completed': return 'Search completed tasks...';
      case 'today': return "Search today's tasks...";
      case 'tomorrow': return "Search tomorrow's tasks...";
      case 'day': return 'Search day tasks...';
      case 'week': return 'Search visible tasks...';
      case 'all':
      default: return 'Search all tasks...';
    }
  }, [currentView]);

  // Dynamic no-results message based on current view
  const noResultsText = currentView === 'completed'
    ? 'No completed tasks found'
    : 'No tasks found';

  // Flatten results for keyboard navigation (main task + expanded instances)
  const flatResults = useMemo(() => {
    const flat: { task: Task; isChild?: boolean }[] = [];
    searchResults.forEach(result => {
      flat.push({ task: result.mainTask });
      if (expandedGroupId === result.mainTask.recurrenceGroupId && result.mainTask.recurrenceGroupId) {
        result.otherInstances.forEach(other => {
          flat.push({ task: other, isChild: true });
        });
      }
    });
    return flat;
  }, [searchResults, expandedGroupId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (prev < flatResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < flatResults.length) {
        handleSelect(flatResults[activeIndex].task);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handleSelect = (task: Task) => {
    onSelectTask(task);
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    setExpandedGroupId(null);
  };

  const handleClear = () => {
    setQuery('');
    setIsOpen(false);
    setActiveIndex(-1);
    setExpandedGroupId(null);
  };

  return (
    <div className="global-search-container" ref={containerRef}>
      <div className="header-search">
        <input
          type="text"
          className="header-search-input"
          placeholder={placeholderText}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(-1);
            setExpandedGroupId(null);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="header-search-clear"
            onClick={handleClear}
            type="button"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && query.trim() && (
        <div className="search-dropdown">
          {searchResults.length > 0 ? (
            searchResults.map((result) => {
              const { mainTask, otherInstances } = result;
              const isExpanded = expandedGroupId === mainTask.recurrenceGroupId && mainTask.recurrenceGroupId;
              
              return (
                <Fragment key={mainTask.id}>
                  <div
                    className={`search-result-item ${flatResults.findIndex(f => f.task.id === mainTask.id) === activeIndex ? 'active' : ''}`}
                    onClick={() => handleSelect(mainTask)}
                    onMouseEnter={() => setActiveIndex(flatResults.findIndex(f => f.task.id === mainTask.id))}
                  >
                    <div className="search-result-info">
                      <div className="search-result-title-row">
                        {mainTask.recurrence && (
                          <span className="search-result-recurrence-icon">🔄</span>
                        )}
                        <span className="search-result-title">{mainTask.title}</span>
                      </div>
                      <div className="search-result-meta">
                        {mainTask.dueDate && (
                          <span className="search-result-date">
                            {formatDateLong(mainTask.dueDate)}
                          </span>
                        )}
                        {mainTask.tags.map(tag => (
                          <span 
                            key={tag} 
                            className="search-result-tag"
                            style={{ backgroundColor: tagColors[tag] || 'var(--text-muted)' }}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {otherInstances.length > 0 && (
                      <button 
                        className={`search-result-expand-btn ${isExpanded ? 'expanded' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedGroupId(isExpanded ? null : mainTask.recurrenceGroupId);
                        }}
                        title={`${otherInstances.length} more recurrences`}
                      >
                        {otherInstances.length}+
                      </button>
                    )}
                  </div>
                  
                  {isExpanded && otherInstances.map((instance) => (
                    <div
                      key={instance.id}
                      className={`search-result-item child ${flatResults.findIndex(f => f.task.id === instance.id) === activeIndex ? 'active' : ''}`}
                      onClick={() => handleSelect(instance)}
                      onMouseEnter={() => setActiveIndex(flatResults.findIndex(f => f.task.id === instance.id))}
                    >
                      <div className="search-result-info">
                        <div className="search-result-title-row">
                          <span className="search-result-title">{instance.title}</span>
                        </div>
                        <div className="search-result-meta">
                          {instance.dueDate && (
                            <span className="search-result-date">
                              {formatDateLong(instance.dueDate)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </Fragment>
              );
            })
          ) : (
            <div className="search-no-results">{noResultsText}</div>
          )}
          {currentView === 'completed' && hasMoreCompletedTasks && (
            <button
              className="search-load-more-btn"
              onClick={() => onLoadMoreCompleted?.()}
            >
              Load more completed tasks to search
            </button>
          )}
        </div>
      )}
    </div>
  );
}

