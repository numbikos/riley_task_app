import { useMemo } from 'react';
import { Task, getTagColor } from '../types';
import { calculateTaskStats, getCompletionHistory } from '../utils/statsUtils';
import { formatFullDate } from '../utils/dateUtils';

interface StatsViewProps {
  tasks: Task[];
  tagColors: Record<string, string>;
}

export default function StatsView({ tasks, tagColors }: StatsViewProps) {
  const stats = useMemo(() => calculateTaskStats(tasks), [tasks]);
  const completionHistory = useMemo(() => getCompletionHistory(tasks, 7), [tasks]);
  const maxHistoryCount = useMemo(
    () => Math.max(...completionHistory.map(h => h.count), 1),
    [completionHistory]
  );

  // Format day label for chart (e.g., "Mon")
  const formatDayLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  };

  return (
    <div className="stats-view">
      <h2 className="stats-title">Task Statistics</h2>

      {/* Summary Cards */}
      <div className="stats-cards">
        <div className="stats-card">
          <div className="stats-card-value">{stats.completedToday}</div>
          <div className="stats-card-label">Completed Today</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats.completedThisWeek}</div>
          <div className="stats-card-label">This Week</div>
        </div>
        <div className="stats-card">
          <div className="stats-card-value">{stats.completedThisMonth}</div>
          <div className="stats-card-label">This Month</div>
        </div>
        <div className="stats-card stats-card-warning">
          <div className="stats-card-value">{stats.overdueCount}</div>
          <div className="stats-card-label">Overdue</div>
        </div>
      </div>

      {/* Completion Rate */}
      <div className="stats-section">
        <h3 className="stats-section-title">Completion Rate</h3>
        <div className="stats-completion-rate">
          <div className="stats-progress-bar">
            <div
              className="stats-progress-fill"
              style={{ width: `${stats.completionRate}%` }}
            />
          </div>
          <div className="stats-completion-info">
            <span className="stats-completion-percentage">
              {stats.completionRate.toFixed(1)}%
            </span>
            <span className="stats-completion-counts">
              {stats.totalCompleted} completed / {stats.totalActive + stats.totalCompleted} total
            </span>
          </div>
        </div>
      </div>

      {/* 7-Day Activity Chart */}
      <div className="stats-section">
        <h3 className="stats-section-title">Last 7 Days</h3>
        <div className="stats-chart">
          {completionHistory.map((day, index) => (
            <div key={index} className="stats-chart-bar-container">
              <div
                className="stats-chart-bar"
                style={{ height: `${(day.count / maxHistoryCount) * 100}%` }}
                title={`${formatFullDate(day.date)}: ${day.count} tasks`}
              >
                {day.count > 0 && (
                  <span className="stats-chart-bar-value">{day.count}</span>
                )}
              </div>
              <div className="stats-chart-label">{formatDayLabel(day.date)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tag Distribution */}
      <div className="stats-section">
        <h3 className="stats-section-title">Tag Distribution</h3>
        {stats.tagDistribution.length === 0 ? (
          <div className="stats-empty-message">No tags used yet</div>
        ) : (
          <div className="stats-tag-distribution">
            {stats.tagDistribution.slice(0, 10).map((tagData, index) => (
              <div key={index} className="stats-tag-row">
                <div className="stats-tag-info">
                  <span
                    className="stats-tag-color"
                    style={{ backgroundColor: getTagColor(tagData.tag, tagColors) }}
                  />
                  <span className="stats-tag-name">{tagData.tag}</span>
                </div>
                <div className="stats-tag-bar-container">
                  <div
                    className="stats-tag-bar"
                    style={{
                      width: `${tagData.percentage}%`,
                      backgroundColor: getTagColor(tagData.tag, tagColors),
                    }}
                  />
                </div>
                <div className="stats-tag-count">
                  {tagData.count} ({tagData.percentage.toFixed(0)}%)
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
