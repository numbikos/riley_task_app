import type { Task } from '../types';
import { apiRequest } from './api';
import { logger } from './logger';

interface LoadOptions { throwOnError?: boolean }
interface TaskPage { tasks: Task[]; total: number }
async function loadPages(completed?: boolean): Promise<Task[]> {
  const tasks: Task[] = [];
  let total = Infinity;
  while (tasks.length < total) {
    const page = await apiRequest<TaskPage>(`/tasks?limit=1000&offset=${tasks.length}${completed === undefined ? '' : `&completed=${completed}`}`);
    total = page.total;
    if (!page.tasks.length && tasks.length < total) throw new Error('Task loading stopped before all tasks were received.');
    tasks.push(...page.tasks);
  }
  return tasks;
}
export async function loadIncompleteTasks(options: LoadOptions = { throwOnError: true }): Promise<Task[]> {
  try { return await loadPages(false); }
  catch (error) { if (options.throwOnError !== false) throw error; logger.error('[loadIncompleteTasks] Failed:', error); return []; }
}
export async function loadTasks(): Promise<Task[]> { return loadPages(); }
export async function loadCompletedTasks(limit = 25, offset = 0): Promise<TaskPage> {
  return apiRequest(`/tasks?completed=true&limit=${limit}&offset=${offset}`);
}
export async function loadTasksByIds(ids: string[], options: LoadOptions = { throwOnError: true }): Promise<Task[]> {
  try {
    const tasks: Task[] = [];
    for (let start = 0; start < ids.length; start += 1000) {
      tasks.push(...await apiRequest<Task[]>('/tasks/by-ids', { method: 'POST', body: JSON.stringify({ ids: ids.slice(start, start + 1000) }) }));
    }
    return tasks;
  } catch (error) { if (options.throwOnError !== false) throw error; logger.error('[loadTasksByIds] Failed:', error); return []; }
}
export async function saveTasks(tasks: Task[]): Promise<void> {
  for (let start = 0; start < tasks.length; start += 1000) {
    await apiRequest('/tasks', { method: 'PUT', body: JSON.stringify({ tasks: tasks.slice(start, start + 1000) }) });
  }
}
export async function deleteTasks(ids: string[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 1000) {
    await apiRequest('/tasks', { method: 'DELETE', body: JSON.stringify({ ids: ids.slice(start, start + 1000) }) });
  }
}
export async function deleteTask(id: string): Promise<void> { await deleteTasks([id]); }
export async function loadTags(): Promise<string[]> { return apiRequest('/tags'); }
export async function saveTags(_tags: string[]): Promise<void> { /* Tags are derived from tasks and colors. */ }
export async function loadTagColors(): Promise<Record<string, string>> {
  try { return await apiRequest('/tag-colors'); }
  catch (error) { logger.error('[loadTagColors] Failed:', error); return {}; }
}
export async function saveTagColors(colors: Record<string, string>): Promise<void> {
  if (Object.keys(colors).length) await apiRequest('/tag-colors', { method: 'PUT', body: JSON.stringify({ colors }) });
}
export async function deleteTagColor(tag: string): Promise<void> {
  await apiRequest(`/tag-colors/${encodeURIComponent(tag)}`, { method: 'DELETE' });
}
export function generateId(): string { return crypto.randomUUID(); }
