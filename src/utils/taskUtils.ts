import { Task } from '../types';

/**
 * Groups tasks by their first tag (or 'untagged' if no tags)
 * Returns grouped tasks and sorted tag names
 */
export const groupTasksByTag = (tasks: Task[]): { grouped: { [key: string]: Task[] }; sortedTags: string[] } => {
  const grouped: { [key: string]: Task[] } = {};
  
  tasks.forEach(task => {
    const tag = task.tags.length > 0 ? task.tags[0].toLowerCase() : 'untagged';
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(task);
  });

  // Sort tags: untagged last, others alphabetically
  const sortedTags = Object.keys(grouped).sort((a, b) => {
    if (a === 'untagged') return 1;
    if (b === 'untagged') return -1;
    return a.localeCompare(b);
  });

  return { grouped, sortedTags };
};

