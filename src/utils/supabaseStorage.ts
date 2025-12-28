import { Task } from '../types';
import { supabase } from './supabase';

// Database task type (snake_case for Supabase)
interface DatabaseTask {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  subtasks: any; // JSONB
  tags: string[];
  created_at: string;
  last_modified: string;
  recurrence: string | null;
  recurrence_group_id: string | null;
  recurrence_multiplier: number | null;
  custom_frequency: string | null;
  is_last_instance: boolean;
  auto_renew: boolean;
}

// Convert database task to app task format
const dbTaskToTask = (dbTask: DatabaseTask): Task => {
  return {
    id: dbTask.id,
    title: dbTask.title,
    dueDate: dbTask.due_date,
    completed: dbTask.completed,
    subtasks: dbTask.subtasks || [],
    tags: dbTask.tags || [],
    createdAt: dbTask.created_at,
    lastModified: dbTask.last_modified,
    recurrence: dbTask.recurrence as Task['recurrence'],
    recurrenceGroupId: dbTask.recurrence_group_id,
    recurrenceMultiplier: dbTask.recurrence_multiplier || undefined,
    customFrequency: dbTask.custom_frequency as Task['customFrequency'],
    isLastInstance: dbTask.is_last_instance || false,
    autoRenew: dbTask.auto_renew || false,
  };
};

// Helper function to generate a UUID
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: create a UUID-like string
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Helper function to check if a string is a valid UUID
const isUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// Helper function to convert string ID to UUID format using a mapping
// If it's already a UUID, return as-is. Otherwise, use the mapping or generate a new UUID.
const toUUID = (id: string | null | undefined, idMap?: Map<string, string>): string | null => {
  if (!id) return null;
  // Check if it's already a valid UUID format
  if (isUUID(id)) {
    return id;
  }
  // Use mapping if provided
  if (idMap && idMap.has(id)) {
    return idMap.get(id)!;
  }
  // Generate a new UUID for non-UUID IDs (shouldn't happen if mapping is used)
  return generateUUID();
};

// Helper function to convert ISO datetime string to DATE format (YYYY-MM-DD)
const toDateOnly = (dateString: string | null | undefined): string | null => {
  if (!dateString) return null;
  // Extract just the date part (YYYY-MM-DD) from ISO string
  return dateString.split('T')[0];
};

// Convert app task to database format
const taskToDbTask = (task: Task, userId: string, idMap?: Map<string, string>): Omit<DatabaseTask, 'created_at' | 'last_modified'> => {
  return {
    id: toUUID(task.id, idMap)!,
    user_id: userId,
    title: task.title,
    due_date: toDateOnly(task.dueDate),
    completed: task.completed,
    subtasks: task.subtasks || [],
    tags: task.tags || [],
    recurrence: task.recurrence,
    recurrence_group_id: toUUID(task.recurrenceGroupId, idMap),
    recurrence_multiplier: task.recurrenceMultiplier || null,
    custom_frequency: task.customFrequency || null,
    is_last_instance: task.isLastInstance || false,
    auto_renew: task.autoRenew || false,
  };
};

export const loadTasks = async (): Promise<Task[]> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      console.error('[loadTasks] Auth error:', authError);
      return [];
    }
    if (!user) {
      console.log('[loadTasks] No user authenticated');
      return [];
    }

    console.log(`[loadTasks] Fetching tasks for user: ${user.id}`);
    console.log(`[loadTasks] User email: ${user.email}`);
    
    // Check session to verify auth context
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('[loadTasks] Session error:', sessionError);
    } else {
      console.log(`[loadTasks] Session exists: ${!!session}`);
      console.log(`[loadTasks] Session user ID: ${session?.user?.id}`);
      if (session?.user?.id !== user.id) {
        console.warn('[loadTasks] WARNING: Session user ID does not match getUser() user ID!');
      }
    }
    
    // First, let's check if there are ANY tasks in the table (for debugging)
    // Note: This will still be filtered by RLS, so we'll only see tasks we have access to
    const { data: allTasksData, error: allTasksError } = await supabase
      .from('tasks')
      .select('id, title, user_id, completed, due_date')
      .limit(10);
    
    if (allTasksError) {
      console.warn('[loadTasks] Could not check all tasks:', allTasksError);
      console.warn('[loadTasks] Error details:', {
        message: allTasksError.message,
        details: allTasksError.details,
        hint: allTasksError.hint,
        code: allTasksError.code,
      });
    } else {
      console.log(`[loadTasks] Total tasks visible to current user (RLS filtered): ${allTasksData?.length || 0}`);
      if (allTasksData && allTasksData.length > 0) {
        console.log('[loadTasks] Sample tasks from database:', allTasksData.map((t: any) => ({
          id: t.id,
          title: t.title,
          user_id: t.user_id,
          completed: t.completed,
          due_date: t.due_date,
          matches_current_user: t.user_id === user.id,
        })));
      } else {
        console.warn('[loadTasks] No tasks visible through RLS. This suggests:');
        console.warn('  - Either no tasks exist for this user');
        console.warn('  - Or RLS policies are blocking access');
        console.warn('  - Check Supabase dashboard: Authentication > Policies to verify RLS is set up correctly');
      }
    }
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[loadTasks] Failed to load tasks:', error);
      console.error('[loadTasks] Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      
      // Check if it's an RLS policy error
      if (error.code === '42501' || error.message.includes('permission') || error.message.includes('policy')) {
        console.error('[loadTasks] RLS POLICY ERROR: Row Level Security is blocking access!');
        console.error('[loadTasks] Please check your Supabase RLS policies in the dashboard.');
      }
      
      return [];
    }

    if (!data) {
      console.log('[loadTasks] No data returned from query');
      return [];
    }

    console.log(`[loadTasks] Retrieved ${data.length} tasks from database for user ${user.id}`);
    
    // Log task details for debugging
    if (data.length > 0) {
      console.log('[loadTasks] Sample tasks:', data.slice(0, 3).map((t: DatabaseTask) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        due_date: t.due_date,
        user_id: t.user_id,
      })));
    } else {
      console.warn(`[loadTasks] No tasks found for user ${user.id}. This could mean:`);
      console.warn('  1. Tasks exist but belong to a different user_id');
      console.warn('  2. RLS policies are blocking access');
      console.warn('  3. The tasks table is empty');
      console.warn(`[loadTasks] To debug: Check Supabase dashboard > Table Editor > tasks table`);
      console.warn(`[loadTasks] Look for tasks with user_id = ${user.id}`);
    }

    // Migrate old tasks that don't have all fields
    const convertedTasks = data.map((task: DatabaseTask) => {
      const converted = dbTaskToTask(task);
      return {
        ...converted,
        recurrence: converted.recurrence || null,
        recurrenceGroupId: converted.recurrenceGroupId || null,
        recurrenceMultiplier: converted.recurrenceMultiplier,
        customFrequency: converted.customFrequency,
        isLastInstance: converted.isLastInstance || false,
        autoRenew: converted.autoRenew || false,
      };
    });

    console.log(`[loadTasks] Converted ${convertedTasks.length} tasks`);
    return convertedTasks;
  } catch (error) {
    console.error('[loadTasks] Exception loading tasks:', error);
    return [];
  }
};

export const saveTasks = async (tasks: Task[]): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[saveTasks] Cannot save tasks: user not authenticated');
      return;
    }

    console.log(`[saveTasks] Saving ${tasks.length} tasks for user ${user.id}`);
    
    // DON'T delete all tasks when array is empty - this is too aggressive
    // Empty array might mean:
    // 1. Initial load hasn't happened yet
    // 2. User actually deleted all tasks (which should be done explicitly)
    // 3. Race condition during reload
    // Instead, only save/upsert the tasks that exist
    if (tasks.length === 0) {
      console.log('[saveTasks] Tasks array is empty - skipping save (not deleting existing tasks)');
      return;
    }

    // Create ID mapping for non-UUID IDs to ensure consistency
    // This is important for migration from localStorage where IDs might not be UUIDs
    // Only create mapping if we have non-UUID IDs (for migration scenarios)
    const idMap = new Map<string, string>();
    const hasNonUUIDIds = tasks.some(task => 
      (task.id && !isUUID(task.id)) || 
      (task.recurrenceGroupId && !isUUID(task.recurrenceGroupId))
    );
    
    if (hasNonUUIDIds) {
      tasks.forEach(task => {
        if (task.id && !isUUID(task.id)) {
          if (!idMap.has(task.id)) {
            idMap.set(task.id, generateUUID());
          }
        }
        // Also map recurrence_group_id if it's not a UUID
        if (task.recurrenceGroupId && !isUUID(task.recurrenceGroupId)) {
          if (!idMap.has(task.recurrenceGroupId)) {
            idMap.set(task.recurrenceGroupId, generateUUID());
          }
        }
      });
    }

    // Convert tasks to database format using the ID mapping (if needed)
    const dbTasks = tasks.map(task => taskToDbTask(task, user.id, hasNonUUIDIds ? idMap : undefined));

    // Use upsert to handle both inserts and updates
    // Supabase will update if id exists, insert if not
    const { error } = await supabase
      .from('tasks')
      .upsert(dbTasks, {
        onConflict: 'id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Failed to save tasks:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      throw error;
    }

    // Extract all unique tags from tasks and save tag colors if needed
    // (Tag colors are managed separately, but we ensure tags exist)
  } catch (error) {
    console.error('Failed to save tasks:', error);
    throw error;
  }
};

export const loadTags = async (): Promise<string[]> => {
  try {
    const tasks = await loadTasks();
    const allTags = new Set<string>();
    
    // Add tags from tasks
    tasks.forEach(task => {
      task.tags.forEach(tag => allTags.add(tag.toLowerCase()));
    });
    
    // Also include tags from tag_colors table (even if not used by any tasks)
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: tagColorsData, error: tagColorsError } = await supabase
        .from('tag_colors')
        .select('tag')
        .eq('user_id', user.id);
      
      if (tagColorsError) {
        console.error('[loadTags] Failed to load tags from tag_colors:', tagColorsError);
      } else if (tagColorsData) {
        tagColorsData.forEach((item: { tag: string }) => {
          allTags.add(item.tag.toLowerCase());
        });
      }
    }
    
    return Array.from(allTags);
  } catch (error) {
    console.error('[loadTags] Exception loading tags:', error);
    return [];
  }
};

export const saveTags = async (tags: string[]): Promise<void> => {
  // Tags are managed via tasks, so this is a no-op for Supabase
  // But we keep it for API compatibility
};

export const generateId = (): string => {
  // Generate a UUID-like string that's compatible with Supabase
  // Using crypto.randomUUID() if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const loadTagColors = async (): Promise<Record<string, string>> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {};
    }

    const { data, error } = await supabase
      .from('tag_colors')
      .select('tag, color')
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to load tag colors:', error);
      return {};
    }

    if (!data) return {};

    const colors: Record<string, string> = {};
    data.forEach((item: { tag: string; color: string }) => {
      colors[item.tag.toLowerCase()] = item.color;
    });

    return colors;
  } catch (error) {
    console.error('Failed to load tag colors:', error);
    return {};
  }
};

export const saveTagColors = async (colors: Record<string, string>): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Cannot save tag colors: user not authenticated');
      return;
    }

    // Convert colors object to array of {tag, color} objects
    const tagColorEntries = Object.entries(colors).map(([tag, color]) => ({
      user_id: user.id,
      tag: tag.toLowerCase(),
      color,
    }));

    if (tagColorEntries.length === 0) {
      return;
    }

    // Upsert tag colors
    const { error } = await supabase
      .from('tag_colors')
      .upsert(tagColorEntries, {
        onConflict: 'user_id,tag',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Failed to save tag colors:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to save tag colors:', error);
    throw error;
  }
};

export const deleteTagColor = async (tag: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Cannot delete tag color: user not authenticated');
      return;
    }

    const normalizedTag = tag.toLowerCase();
    const { error } = await supabase
      .from('tag_colors')
      .delete()
      .eq('user_id', user.id)
      .eq('tag', normalizedTag);

    if (error) {
      console.error('Failed to delete tag color:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete tag color:', error);
    throw error;
  }
};

// Helper function to delete a task
export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Cannot delete task: user not authenticated');
      return;
    }

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete task:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete task:', error);
    throw error;
  }
};

// Helper function to delete multiple tasks
export const deleteTasks = async (taskIds: string[]): Promise<void> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('Cannot delete tasks: user not authenticated');
      return;
    }

    if (taskIds.length === 0) return;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('user_id', user.id)
      .in('id', taskIds);

    if (error) {
      console.error('Failed to delete tasks:', error);
      throw error;
    }
  } catch (error) {
    console.error('Failed to delete tasks:', error);
    throw error;
  }
};

