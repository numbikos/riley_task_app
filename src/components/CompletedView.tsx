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
  // Progressive loading props
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  loadedCount?: number;
  totalCount?: number | null;
  loadError?: string | null;
}

export default function CompletedView({
  tasks,
  tagColors,
  onToggleComplete,
  onEdit,
  onDelete,
  onUpdateTask,
  hasMore,
  isLoadingMore,
  onLoadMore,
  loadedCount,
  totalCount,
  loadError,
}: CompletedViewProps) {
  // Sort by most recently completed (lastModified) - most recent first
  // Secondary sort by id (descending) for stable sorting matching database query
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aTime = new Date(a.lastModified).getTime();
      const bTime = new Date(b.lastModified).getTime();

      if (aTime !== bTime) {
        return bTime - aTime; // Descending order - most recent first
      }
      // If lastModified is the same, sort by id (descending) to match database stable sort
      return b.id.localeCompare(a.id);
    });
  }, [tasks]);

  const hasKnownTotal = totalCount != null;
  const effectiveLoadedCount = loadedCount ?? sortedTasks.length;
  const showFinalEmptyState = sortedTasks.length === 0
    && !hasMore
    && !isLoadingMore
    && (!hasKnownTotal || totalCount === 0);
  const showLoadMoreSection = Boolean(
    hasMore || isLoadingMore || (hasKnownTotal && totalCount > 0)
  );

  if (showFinalEmptyState) {
    return (
      <div className="empty-state">
        <h2>No completed tasks</h2>
        <p>Tasks you complete will appear here.</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {sortedTasks.length === 0 ? (
        // Empty state when search has no matches but more tasks can be loaded
        <div className="empty-state" style={{ marginBottom: '1rem' }}>
          <h2>No matching completed tasks</h2>
          <p>Try clearing search or load more completed tasks.</p>
        </div>
      ) : (
        sortedTasks.map(task => (
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
        ))
      )}

      {/* Load More section */}
      {showLoadMoreSection && (
        <div className="load-more-section">
          {/* Progress indicator */}
          {hasKnownTotal && (
            <span className="load-more-progress">
              Loaded {effectiveLoadedCount} of {totalCount} completed tasks
            </span>
          )}

          {/* Load More button */}
          {hasMore && !isLoadingMore && onLoadMore && (
            <button onClick={onLoadMore} className="load-more-button">
              Load More
            </button>
          )}

          {/* Loading spinner */}
          {isLoadingMore && (
            <div className="loading-indicator">
              <span className="loading-spinner" />
              Loading more...
            </div>
          )}

          {/* Error message */}
          {loadError && (
            <div className="load-error-message">
              {loadError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
