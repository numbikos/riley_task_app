import { useState, useEffect } from 'react';
import { Task, Subtask, getTagColor, RecurrenceType } from '../types';
import { generateId, loadTags, loadTagColors } from '../utils/supabaseStorage';
import { formatDate } from '../utils/dateUtils';

interface TaskFormProps {
  task: Task | null;
  onSave: (taskData: Partial<Task>) => void;
  onCancel: () => void;
  initialDueDate?: string | null;
}

export default function TaskForm({ task, onSave, onCancel, initialDueDate }: TaskFormProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [completed, setCompleted] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskText, setEditingSubtaskText] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>(null);
  const [recurrenceMultiplier, setRecurrenceMultiplier] = useState<number>(1);
  const [customFrequency, setCustomFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'>('weekly');
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [isDateInputFocused, setIsDateInputFocused] = useState(false);

  useEffect(() => {
    // Load available tags - they're stored lowercase, display with proper case
    loadTags().then(setAvailableTags);
    // Load tag colors
    loadTagColors().then(setTagColors);
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDueDate(task.dueDate ? formatDate(task.dueDate) : '');
      setCompleted(task.completed);
      setTags([...task.tags]);
      setSubtasks([...task.subtasks]);
      setRecurrence(task.recurrence || null);
      setRecurrenceMultiplier(task.recurrenceMultiplier || 1);
      setCustomFrequency(task.customFrequency || 'weekly');
    } else {
      // Reset form when creating new task
      setTitle('');
      setDueDate(initialDueDate || '');
      setCompleted(false);
      setTags([]);
      setSubtasks([]);
      setTagInput('');
      setSubtaskInput('');
      setRecurrence(null);
      setRecurrenceMultiplier(1);
      setCustomFrequency('weekly');
    }
    // Reset editing state when task changes
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  }, [task, initialDueDate]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed) {
      // Normalize to lowercase for storage, but display with proper case
      const normalized = trimmed.toLowerCase();
      // Only allow one tag - replace existing tag
      setTags([normalized]);
      setTagInput('');
    }
  };

  const handleRemoveTag = () => {
    // Since we only allow one tag, removing it clears all tags
    setTags([]);
  };

  const handleAddSubtask = () => {
    const trimmed = subtaskInput.trim();
    if (trimmed) {
      setSubtasks([...subtasks, { id: generateId(), text: trimmed, completed: false }]);
      setSubtaskInput('');
    }
  };

  const handleRemoveSubtask = (id: string) => {
    setSubtasks(subtasks.filter(st => st.id !== id));
  };

  const handleToggleSubtask = (id: string) => {
    const updatedSubtasks = subtasks.map(st =>
      st.id === id ? { ...st, completed: !st.completed } : st
    );
    setSubtasks(updatedSubtasks);
    
    // Auto-save when subtask is toggled for existing tasks
    if (task && title.trim()) {
      const taskData: Partial<Task> = {
        title: title.trim(),
        dueDate: dueDate || task.dueDate,
        completed,
        tags,
        subtasks: updatedSubtasks,
      };
      onSave(taskData);
    }
  };

  const handleStartEditingSubtask = (subtask: Subtask) => {
    setEditingSubtaskId(subtask.id);
    setEditingSubtaskText(subtask.text);
  };

  const handleSaveSubtaskEdit = (id: string) => {
    if (editingSubtaskText.trim()) {
      const updatedSubtasks = subtasks.map(st =>
        st.id === id ? { ...st, text: editingSubtaskText.trim() } : st
      );
      setSubtasks(updatedSubtasks);
      
      // Auto-save when subtask is edited for existing tasks
      if (task && title.trim()) {
        const taskData: Partial<Task> = {
          title: title.trim(),
          dueDate: dueDate || task.dueDate,
          completed,
          tags,
          subtasks: updatedSubtasks,
        };
        onSave(taskData);
      }
    }
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  };

  const handleCancelSubtaskEdit = () => {
    setEditingSubtaskId(null);
    setEditingSubtaskText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Early return if title or dueDate is empty - prevent any blocking operations
    if (!title.trim() || !dueDate.trim()) {
      return;
    }

    // Check if there's unsaved tag text
    if (tagInput.trim()) {
      const trimmed = tagInput.trim();
      const confirmed = window.confirm(
        `You've entered a new tag: "${trimmed}".\nWould you like to save it before continuing?`
      );
      
      if (confirmed) {
        // Add the tag and let user review before submitting
        const normalized = trimmed.toLowerCase();
        setTags([normalized]);
        setTagInput('');
        // Return early so user can review and submit again
        return;
      } else {
        // User chose to proceed without adding the tag - clear the input
        setTagInput('');
      }
    }

    // Check if there's unsaved subtask text
    if (subtaskInput.trim()) {
      const trimmed = subtaskInput.trim();
      const confirmed = window.confirm(
        `You've entered a new subtask: "${trimmed}".\nWould you like to save it before continuing?`
      );
      
      if (confirmed) {
        // Add the subtask and let user review before submitting
        setSubtasks([...subtasks, { id: generateId(), text: trimmed, completed: false }]);
        setSubtaskInput('');
        // Return early so user can review and submit again
        return;
      } else {
        // User chose to proceed without adding the subtask - clear the input
        setSubtaskInput('');
      }
    }

    // Check if we're editing a recurring task and subtasks have changed
    if (task && task.recurrenceGroupId) {
      const subtasksChanged = JSON.stringify(subtasks) !== JSON.stringify(task.subtasks);
      
      if (subtasksChanged) {
        const confirmed = window.confirm(
          `Update subtasks for all future instances of "${task.title}"?`
        );
        
        if (!confirmed) {
          // User chose not to propagate - update current task only, don't propagate subtasks
          // We'll update the task directly without going through propagation logic
          const taskData: Partial<Task> & { _skipSubtaskPropagation?: boolean } = {
            title: title.trim(),
            dueDate: dueDate || task.dueDate || null,
            completed,
            tags,
            subtasks,
            recurrence: task.recurrence,
            recurrenceMultiplier: task.recurrenceMultiplier,
            customFrequency: task.customFrequency,
            autoRenew: task.autoRenew,
            _skipSubtaskPropagation: true, // Flag to skip subtask propagation
          };
          onSave(taskData);
          return;
        }
      }
    }

    const taskData: Partial<Task> = {
      title: title.trim(),
      dueDate: dueDate || null,
      completed,
      tags,
      subtasks,
      recurrence: dueDate ? recurrence : null,
      recurrenceMultiplier: recurrence === 'custom' ? recurrenceMultiplier : undefined,
      customFrequency: recurrence === 'custom' ? customFrequency : undefined,
      autoRenew: recurrence ? true : undefined, // Always auto-renew for recurring tasks
    };

    onSave(taskData);
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCompletedState = e.target.checked;
    setCompleted(newCompletedState);
    
    // If completing the task and there are incomplete subtasks, prompt for confirmation
    if (newCompletedState && subtasks.length > 0) {
      const incompleteSubtasks = subtasks.filter(st => !st.completed);
      if (incompleteSubtasks.length > 0) {
        const confirmed = window.confirm(
          `This task has ${incompleteSubtasks.length} incomplete subtask${incompleteSubtasks.length > 1 ? 's' : ''}. ` +
          `Do you want to complete the task and mark all subtasks as complete?`
        );
        
        if (!confirmed) {
          // User cancelled, revert checkbox state
          setCompleted(false);
          return;
        }
        
        // Complete all subtasks
        const completedSubtasks = subtasks.map(st => ({ ...st, completed: true }));
        setSubtasks(completedSubtasks);
        
        // Auto-save when checkbox is toggled for existing tasks
        if (task && title.trim()) {
          const taskData: Partial<Task> = {
            title: title.trim(),
            dueDate: dueDate || task.dueDate,
            completed: true,
            tags,
            subtasks: completedSubtasks,
          };
          onSave(taskData);
        }
        return;
      }
    }
    
    // Normal toggle (no incomplete subtasks or uncompleting)
    // Auto-save when checkbox is toggled for existing tasks
    if (task && title.trim()) {
      const taskData: Partial<Task> = {
        title: title.trim(),
        dueDate: dueDate || task.dueDate,
        completed: newCompletedState,
        tags,
        subtasks,
      };
      onSave(taskData);
    }
  };

  const handleOverlayClick = (e: React.MouseEvent | React.TouchEvent) => {
    // Only close if clicking directly on the overlay, not on a child element
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    }
  };

  const handleCancelClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onCancel();
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
      onTouchStart={handleOverlayClick}
    >
      {isDateInputFocused && (
        <div className="date-picker-backdrop" />
      )}
      <div className="modal-content" onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <input
              type="checkbox"
              className="modal-completion-checkbox"
              checked={completed}
              onChange={handleCheckboxChange}
              disabled={!task}
              title={task ? (completed ? 'Mark as incomplete' : 'Mark as complete') : 'Complete task after creating it'}
            />
            <input
              type="text"
              className="modal-title-input"
              value={title}
              onChange={handleTitleChange}
              placeholder={task ? 'Task title' : 'New Task'}
              required
              autoFocus
              minLength={1}
            />
          </div>
          <button className="modal-close" onClick={handleCancelClick} onTouchStart={handleCancelClick}>×</button>
        </div>

        <form onSubmit={handleSubmit}>

          <div className="form-group">
            <label>Due Date <span style={{ color: '#FF6B6B' }}>*</span></label>
            <input
              type="date"
              value={dueDate}
              required
              onFocus={() => setIsDateInputFocused(true)}
              onBlur={() => setIsDateInputFocused(false)}
              onChange={(e) => {
                setDueDate(e.target.value);
                // Clear recurrence if due date is removed
                if (!e.target.value) {
                  setRecurrence(null);
                }
              }}
            />
          </div>

          <div className="form-group">
            <label>Recurrence</label>
            {!dueDate && (
              <div style={{ padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                Set a due date to enable recurrence options
              </div>
            )}
            <div className="recurrence-selector" style={{ opacity: dueDate ? 1 : 0.5, pointerEvents: dueDate ? 'auto' : 'none' }}>
              <div className="recurrence-options">
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'daily' ? 'active' : ''}`}
                  onClick={() => setRecurrence('daily')}
                  disabled={!dueDate}
                >
                  Daily
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'weekly' ? 'active' : ''}`}
                  onClick={() => setRecurrence('weekly')}
                  disabled={!dueDate}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'monthly' ? 'active' : ''}`}
                  onClick={() => setRecurrence('monthly')}
                  disabled={!dueDate}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'quarterly' ? 'active' : ''}`}
                  onClick={() => setRecurrence('quarterly')}
                  disabled={!dueDate}
                >
                  Quarterly
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'yearly' ? 'active' : ''}`}
                  onClick={() => setRecurrence('yearly')}
                  disabled={!dueDate}
                >
                  Annually
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === 'custom' ? 'active' : ''}`}
                  onClick={() => setRecurrence('custom')}
                  disabled={!dueDate}
                >
                  Custom
                </button>
                <button
                  type="button"
                  className={`recurrence-option ${recurrence === null ? 'active' : ''}`}
                  onClick={() => setRecurrence(null)}
                  disabled={!dueDate}
                >
                  None
                </button>
              </div>
              {recurrence === 'custom' && dueDate && (
                <div className="custom-recurrence-options" style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '0 0 auto' }}>
                      <label style={{ fontSize: '0.85rem', color: '#B0B0B0', fontWeight: 500 }}>Number</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={recurrenceMultiplier}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (val >= 1 && val <= 50) {
                            setRecurrenceMultiplier(val);
                          } else if (e.target.value === '') {
                            setRecurrenceMultiplier(1);
                          }
                        }}
                        style={{
                          width: '80px',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          boxSizing: 'border-box',
                          outline: 'none',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#40E0D0';
                          e.target.style.boxShadow = '0 0 0 3px rgba(64, 224, 208, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          e.target.style.boxShadow = 'none';
                          if (!recurrenceMultiplier || recurrenceMultiplier < 1) {
                            setRecurrenceMultiplier(1);
                          }
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1 1 auto' }}>
                      <label style={{ fontSize: '0.85rem', color: '#B0B0B0', fontWeight: 500 }}>Frequency</label>
                      <select
                        value={customFrequency}
                        onChange={(e) => setCustomFrequency(e.target.value as typeof customFrequency)}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          background: 'rgba(255, 255, 255, 0.1)',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          cursor: 'pointer',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          height: '44px'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#40E0D0';
                          e.target.style.boxShadow = '0 0 0 3px rgba(64, 224, 208, 0.2)';
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                          e.target.style.boxShadow = 'none';
                        }}
                      >
                        <option value="daily">Days</option>
                        <option value="weekly">Weeks</option>
                        <option value="monthly">Months</option>
                        <option value="quarterly">Quarters</option>
                        <option value="yearly">Years</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem', fontSize: '0.85rem', opacity: 0.8 }}>
                    Will create 50 instances: Every {recurrenceMultiplier} {customFrequency === 'quarterly' ? 'quarters' : customFrequency === 'yearly' ? 'years' : customFrequency + 's'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Tags</label>
            <div className="tag-input">
              {tags.map(tag => {
                const displayName = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
                return (
                  <span key={tag} className="tag-chip">
                    {displayName}
                    <button type="button" onClick={handleRemoveTag}>×</button>
                  </span>
                );
              })}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="Add tag..."
              />
            </div>
            {availableTags.length > 0 && (
              <div className="tag-suggestions">
                <div className="tag-suggestions-label">Available tags:</div>
                <div className="tag-suggestions-list">
                  {availableTags
                    .filter(tag => tag.toLowerCase().includes(tagInput.toLowerCase()))
                    .map(tag => {
                      const tagColor = getTagColor(tag, tagColors);
                      const displayName = tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
                      return (
                        <button
                          key={tag}
                          type="button"
                          className="tag-suggestion-btn"
                          style={{
                            borderColor: tagColor,
                            color: tagColor
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = tagColor;
                            e.currentTarget.style.color = '#0A0A0A';
                            e.currentTarget.style.borderColor = 'transparent';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = tagColor;
                            e.currentTarget.style.borderColor = tagColor;
                          }}
                          onClick={() => {
                            // Replace existing tag with selected one (store lowercase)
                            setTags([tag.toLowerCase()]);
                            setTagInput('');
                          }}
                        >
                          {displayName}
                        </button>
                      );
                    })}
                  {tagInput && !availableTags.some(t => t.toLowerCase() === tagInput.toLowerCase()) && (
                    <button
                      type="button"
                      className="tag-suggestion-btn tag-suggestion-btn-new"
                      onClick={() => {
                        // handleAddTag already has the confirmation logic for new tags
                        handleAddTag();
                      }}
                    >
                      + Create "{tagInput}"
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Subtasks</label>
            <div className="subtask-input-group">
              <input
                type="text"
                value={subtaskInput}
                onChange={(e) => setSubtaskInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="Add subtask..."
              />
              <button type="button" className="btn btn-secondary btn-small" onClick={handleAddSubtask}>
                Add
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className="subtask-list">
                {subtasks.map(subtask => (
                  <div key={subtask.id} className={`subtask-item ${subtask.completed ? 'completed' : ''}`}>
                    <input
                      type="checkbox"
                      className="subtask-checkbox"
                      checked={subtask.completed}
                      onChange={() => handleToggleSubtask(subtask.id)}
                    />
                    {editingSubtaskId === subtask.id ? (
                      <input
                        type="text"
                        className="subtask-edit-input"
                        value={editingSubtaskText}
                        onChange={(e) => setEditingSubtaskText(e.target.value)}
                        onBlur={() => handleSaveSubtaskEdit(subtask.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveSubtaskEdit(subtask.id);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancelSubtaskEdit();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="subtask-text" 
                        onClick={() => handleStartEditingSubtask(subtask)}
                        style={{ cursor: 'pointer', flex: 1 }}
                      >
                        {subtask.text}
                      </span>
                    )}
                    <button
                      type="button"
                      className="task-action-btn delete"
                      onClick={() => handleRemoveSubtask(subtask.id)}
                      style={{ marginLeft: 'auto' }}
                      title="Delete subtask"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handleCancelClick}
              onTouchStart={handleCancelClick}
              onMouseDown={(e) => e.stopPropagation()}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={!title.trim() || !dueDate.trim()}
              onTouchStart={(e) => {
                e.stopPropagation();
                // Prevent touch events when disabled
                if (!title.trim() || !dueDate.trim()) {
                  e.preventDefault();
                }
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                // Prevent mouse events when disabled
                if (!title.trim() || !dueDate.trim()) {
                  e.preventDefault();
                }
              }}
              onClick={(e) => {
                // Double-check on click as well
                if (!title.trim() || !dueDate.trim()) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }}
            >
              {task ? 'Update' : 'Create'} Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
