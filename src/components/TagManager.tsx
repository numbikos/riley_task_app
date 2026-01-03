import { useState, useEffect } from 'react';
import { Task, getTagColor, DEFAULT_TAG_COLORS } from '../types';
import { loadTags, saveTags, loadTagColors, saveTagColors, deleteTagColor } from '../utils/supabaseStorage';
import { logger } from '../utils/logger';

interface TagManagerProps {
  tasks: Task[];
  onUpdateTasks: (updatedTasks: Task[]) => void;
  onTagColorsChange?: (colors: Record<string, string>) => void;
  onClose: () => void;
}

export default function TagManager({ tasks, onUpdateTasks, onTagColorsChange, onClose }: TagManagerProps) {
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagColors, setTagColors] = useState<Record<string, string>>({});
  const [editingColorForTag, setEditingColorForTag] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [editingTagInput, setEditingTagInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [showAddTagForm, setShowAddTagForm] = useState(false);

  useEffect(() => {
    loadTags()
      .then(tags => {
        // Sort tags alphabetically
        setAvailableTags(tags.sort());
      })
      .catch(error => {
        logger.error('[TagManager] Failed to load tags:', error);
        setAvailableTags([]);
      });
    // Load stored tag colors
    loadTagColors()
      .then(setTagColors)
      .catch(error => {
        logger.error('[TagManager] Failed to load tag colors:', error);
        setTagColors({});
      });
  }, []);

  const handleDeleteTag = async (tagToDelete: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the tag "${tagToDelete}"? This will remove it from all tasks.`
    );

    if (!confirmed) return;

    // Remove tag from all tasks
    const updatedTasks = tasks.map(task => ({
      ...task,
      tags: task.tags.filter((tag: string) => tag.toLowerCase() !== tagToDelete.toLowerCase())
    }));

    // Delete tag color from database
    await deleteTagColor(tagToDelete).catch((error) => logger.error('[TagManager] Failed to delete tag color:', error));

    // Update available tags
    const updatedTags = availableTags.filter(tag => tag.toLowerCase() !== tagToDelete.toLowerCase());
    setAvailableTags(updatedTags);
    saveTags(updatedTags).catch((error) => logger.error('[TagManager] Failed to save tags:', error));

    // Update tag colors state
    const normalizedTag = tagToDelete.toLowerCase();
    const updatedColors = { ...tagColors };
    delete updatedColors[normalizedTag];
    setTagColors(updatedColors);
    // Notify parent component to update tag colors immediately
    if (onTagColorsChange) {
      onTagColorsChange(updatedColors);
    }

    // Update tasks
    onUpdateTasks(updatedTasks);
  };

  const getTagDisplayName = (tag: string) => {
    return tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase();
  };

  const getTagColorValue = (tag: string) => {
    return getTagColor(tag, tagColors);
  };

  const handleColorChange = async (tag: string, color: string) => {
    const normalizedTag = tag.toLowerCase();
    const updatedColors = { ...tagColors, [normalizedTag]: color };
    setTagColors(updatedColors);
    await saveTagColors(updatedColors);
    // Notify parent component to update tag colors immediately
    if (onTagColorsChange) {
      onTagColorsChange(updatedColors);
    }
    setEditingColorForTag(null);
  };

  const predefinedColors = [
    '#6366F1', // Indigo
    '#10B981', // Emerald
    '#FB7185', // Rose
    '#F59E0B', // Amber
    '#0EA5E9', // Sky
    '#8B5CF6', // Violet
    '#D946EF', // Fuchsia
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#64748B', // Slate
  ];

  const getTagUsageCount = (tag: string) => {
    return tasks.filter(task => 
      task.tags.some((t: string) => t.toLowerCase() === tag.toLowerCase())
    ).length;
  };

  const handleAddTag = async () => {
    const trimmedTag = newTagInput.trim();
    if (!trimmedTag) return;

    const normalizedTag = trimmedTag.toLowerCase();
    
    // Check if tag already exists
    if (availableTags.some(tag => tag.toLowerCase() === normalizedTag)) {
      alert(`Tag "${trimmedTag}" already exists!`);
      setNewTagInput('');
      setShowAddTagForm(false);
      return;
    }

    try {
      // Get default color for the tag
      const defaultColor = DEFAULT_TAG_COLORS[normalizedTag] || DEFAULT_TAG_COLORS.default;
      
      // Add tag color to database (this will persist the tag even if not used by any tasks)
      const updatedColors = { ...tagColors, [normalizedTag]: defaultColor };
      setTagColors(updatedColors);
      await saveTagColors(updatedColors);
      // Notify parent component to update tag colors immediately
      if (onTagColorsChange) {
        onTagColorsChange(updatedColors);
      }

      // Reload tags from database to ensure consistency
      const reloadedTags = await loadTags();
      setAvailableTags(reloadedTags.sort());
      
      // Clear input and close form
      setNewTagInput('');
      setShowAddTagForm(false);
    } catch (error) {
      logger.error('[TagManager] Failed to add tag:', error);
      alert(`Failed to add tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleAddTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    } else if (e.key === 'Escape') {
      setNewTagInput('');
      setShowAddTagForm(false);
    }
  };

  const handleStartEditingTag = (tag: string) => {
    setEditingTagName(tag);
    setEditingTagInput(getTagDisplayName(tag));
    setEditingColorForTag(null); // Close color picker if open
  };

  const handleCancelEditingTag = () => {
    setEditingTagName(null);
    setEditingTagInput('');
  };

  const handleRenameTag = async (oldTag: string) => {
    const trimmedNewName = editingTagInput.trim();
    if (!trimmedNewName) {
      handleCancelEditingTag();
      return;
    }

    const normalizedNewTag = trimmedNewName.toLowerCase();
    const normalizedOldTag = oldTag.toLowerCase();

    // If name hasn't changed, just cancel
    if (normalizedNewTag === normalizedOldTag) {
      handleCancelEditingTag();
      return;
    }

    // Check if new tag name already exists
    if (availableTags.some(tag => tag.toLowerCase() === normalizedNewTag)) {
      alert(`Tag "${trimmedNewName}" already exists!`);
      return;
    }

    try {
      // Update tag in all tasks
      const updatedTasks = tasks.map(task => ({
        ...task,
        tags: task.tags.map((tag: string) =>
          tag.toLowerCase() === normalizedOldTag ? normalizedNewTag : tag
        )
      }));

      // Update tag colors (transfer old color to new tag name)
      const oldColor = tagColors[normalizedOldTag];
      const updatedColors = { ...tagColors };

      // Delete old tag color entry
      delete updatedColors[normalizedOldTag];
      await deleteTagColor(oldTag);

      // Add new tag color entry (preserve the color if it existed)
      if (oldColor) {
        updatedColors[normalizedNewTag] = oldColor;
      } else {
        updatedColors[normalizedNewTag] = DEFAULT_TAG_COLORS[normalizedNewTag] || DEFAULT_TAG_COLORS.default;
      }

      await saveTagColors(updatedColors);
      setTagColors(updatedColors);

      // Notify parent component
      if (onTagColorsChange) {
        onTagColorsChange(updatedColors);
      }

      // Update tasks in database and parent state
      onUpdateTasks(updatedTasks);

      // Reload tags to ensure consistency
      const reloadedTags = await loadTags();
      setAvailableTags(reloadedTags.sort());

      // Clear editing state
      handleCancelEditingTag();
    } catch (error) {
      logger.error('[TagManager] Failed to rename tag:', error);
      alert(`Failed to rename tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEditTagKeyPress = (e: React.KeyboardEvent, tag: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameTag(tag);
    } else if (e.key === 'Escape') {
      handleCancelEditingTag();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content tag-manager-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Tag Manager</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="tag-manager-list">
          {showAddTagForm ? (
            <div className="tag-manager-add-form">
              <input
                type="text"
                className="tag-manager-add-input"
                placeholder="Enter tag name..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddTagKeyPress}
                autoFocus
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleAddTag}
                  disabled={!newTagInput.trim()}
                >
                  Add Tag
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setNewTagInput('');
                    setShowAddTagForm(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowAddTagForm(true)}
                style={{ width: '100%' }}
              >
                + Add New Tag
              </button>
            </div>
          )}
          
          {availableTags.length === 0 ? (
            <div className="empty-state">
              <p>No tags available</p>
            </div>
          ) : (
            availableTags.map(tag => {
              const displayName = getTagDisplayName(tag);
              const tagColor = getTagColorValue(tag);
              const usageCount = getTagUsageCount(tag);
              const isEditingColor = editingColorForTag === tag;
              const isEditingName = editingTagName === tag;

              return (
                <div key={tag} className="tag-manager-item">
                  <div className="tag-manager-item-left">
                    {isEditingName ? (
                      <div className="tag-manager-edit-form">
                        <input
                          type="text"
                          className="tag-manager-edit-input"
                          value={editingTagInput}
                          onChange={(e) => setEditingTagInput(e.target.value)}
                          onKeyDown={(e) => handleEditTagKeyPress(e, tag)}
                          onBlur={() => handleRenameTag(tag)}
                          autoFocus
                          style={{ borderLeftColor: tagColor }}
                        />
                      </div>
                    ) : (
                      <div
                        className="tag-manager-tag-preview"
                        style={{
                          borderLeftColor: tagColor,
                          borderLeftWidth: '4px',
                          borderLeftStyle: 'solid'
                        }}
                      >
                        <span
                          className="tag-manager-tag-name"
                          style={{ color: tagColor }}
                        >
                          {displayName}
                        </span>
                        <span className="tag-manager-usage-count">
                          ({usageCount} {usageCount === 1 ? 'task' : 'tasks'})
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {isEditingColor ? (
                      <div className="tag-color-picker">
                        <div className="tag-color-presets">
                          {predefinedColors.map(color => (
                            <button
                              key={color}
                              type="button"
                              className="tag-color-preset"
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorChange(tag, color)}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="tag-color-custom-row">
                          <label className="tag-color-custom-label">
                            Custom:
                            <input
                              type="color"
                              value={tagColor}
                              onChange={(e) => handleColorChange(tag, e.target.value)}
                              className="tag-color-custom-input"
                            />
                          </label>
                          <button
                            type="button"
                            className="tag-color-close-btn"
                            onClick={() => setEditingColorForTag(null)}
                            title="Close color picker"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="tag-manager-edit-btn"
                          onClick={() => handleStartEditingTag(tag)}
                          title={`Rename "${displayName}" tag`}
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          className="tag-manager-color-btn"
                          onClick={() => setEditingColorForTag(tag)}
                          title={`Change color for "${displayName}" tag`}
                          style={{
                            backgroundColor: tagColor,
                            width: '32px',
                            height: '32px',
                            borderRadius: '4px',
                            border: '2px solid rgba(255, 255, 255, 0.3)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        />
                      </>
                    )}
                    <button
                      className="tag-manager-delete-btn"
                      onClick={() => handleDeleteTag(tag)}
                      title={`Delete "${displayName}" tag`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

