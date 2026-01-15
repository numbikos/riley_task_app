# Riley Task App - Development Guide

## Things to Remember

Before writing any code:
1. State how you will verify this change works (test, browser check, console output, etc.)
2. Write the test or verification step first
3. Then implement the code
4. Run verification and iterate until it passes

After adding a new feature:
5. Check if the README needs to be updated to document the new functionality

---

## Common Bash/CLI Commands

### Development Server
```bash
# Start development server (port 5181)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing
```bash
# Run tests in watch mode
npm test

# Open interactive test dashboard
npm run test:ui

# Generate coverage reports (output to /coverage)
npm run test:coverage
```

### Git Workflow
```bash
# Check current branch and status
git status
git branch

# Create feature branch
git checkout -b feature/your-feature-name

# Stage and commit
git add .
git commit -m "feat: description of changes"

# Push to remote
git push origin feature/your-feature-name
```

---

## Code Style Conventions

### Naming Conventions
- **Components**: PascalCase files and function names (e.g., `TaskCard.tsx`, `TodayView.tsx`)
- **Hooks**: `use` prefix, camelCase (e.g., `useAuth.ts`, `useTaskManagement.ts`)
- **Utilities**: camelCase files (e.g., `dateUtils.ts`, `taskOperations.ts`)
- **Functions**: camelCase (e.g., `getTodayTasks()`, `formatDate()`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `RELOAD_DEBOUNCE_MS`, `AUTH_DELAY_MS`)
- **Types/Interfaces**: PascalCase (e.g., `Task`, `TaskUpdate`, `RecurrenceType`)
- **Props Interfaces**: ComponentName + `Props` (e.g., `TaskCardProps`, `TodayViewProps`)

### TypeScript Practices
- Strict mode enabled - no implicit `any`
- Define interfaces for all component props
- Use union types for discriminated options (e.g., `RecurrenceType = 'daily' | 'weekly' | ...`)
- Prefer `interface` for object shapes, `type` for unions and primitives

### Component Structure
```typescript
import { useState, useEffect } from 'react';
import { Task, TaskUpdate } from '../types';
import { someUtil } from '../utils/someUtil';

interface ComponentNameProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export default function ComponentName({ task, onEdit, onDelete }: ComponentNameProps) {
  // State declarations
  const [localState, setLocalState] = useState<string>('');

  // Event handlers (prefix with 'handle')
  const handleCardClick = (e: React.MouseEvent) => {
    // Implementation
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(task.id);
  };

  return (
    <div onClick={handleCardClick}>
      {/* JSX */}
    </div>
  );
}
```

### Hook Structure
```typescript
import { useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

const SOME_CONSTANT_MS = 3000;

export const useHookName = (dependency: SomeType) => {
  const [state, setState] = useState<StateType>(initialValue);
  const someRef = useRef<RefType>(null);

  useEffect(() => {
    // Effect logic with proper cleanup
    return () => {
      // Cleanup
    };
  }, [dependency]);

  const someFunction = (param: ParamType) => {
    logger.debug('[useHookName] Doing something');
    // Implementation
  };

  return {
    state,
    someFunction,
  };
};
```

### Code Organization
- **src/components/**: React components (Views, Forms, Dialogs, Utilities)
- **src/hooks/**: Custom React hooks (`useAuth`, `useTaskManagement`, etc.)
- **src/utils/**: Utility functions and helpers
- **src/types.ts**: Shared TypeScript type definitions
- **src/App.tsx**: Main application component and state orchestration

---

## Logging

### Logger Usage
Use the `logger` utility from `utils/logger.ts` for all logging:

```typescript
import { logger } from '../utils/logger';

// Debug level (dev only by default)
logger.debug('[ModuleName] Processing task:', taskId);

// Info level
logger.info('[ModuleName] Operation completed successfully');

// Warning level
logger.warn('[ModuleName] Unexpected state detected');

// Error level
logger.error('[ModuleName] Failed to save:', error);
```

### Logging Pattern
**IMPORTANT: Always prefix log messages with `[ModuleName]` to identify the source.**

```typescript
// GOOD - includes module prefix
logger.debug('[useTaskManagement] Loading tasks from Supabase...');
logger.error('[loadTasks] Failed to load tasks:', error);

// BAD - no module prefix
logger.debug('Loading tasks from Supabase...');
logger.error('Failed to load tasks:', error);
```

### Log Levels
- **debug**: Detailed debugging info (only shown in dev with `VITE_LOG_LEVEL=debug`)
- **info**: General operational info
- **warn**: Warnings that don't prevent operation (default in dev)
- **error**: Errors that need attention (default in prod)

Set log level via environment: `VITE_LOG_LEVEL=debug|info|warn|error|silent`

---

## State Management

### Architecture: Lifted State with Custom Hooks

The app uses a hook-based state management pattern (no Redux/Context):

```
App.tsx (Main orchestrator)
├── useAuth() → user, loading, signOut
├── useViewState() → currentView, view dates, searchQuery (dropdown only)
├── useTaskManagement() → tasks, add, update, delete, undo
└── useRecurringTasks() → recurring task operations
```

### Data Flow
1. **Source of Truth**: Supabase PostgreSQL database
2. **Working State**: React state in hooks
3. **Sync Direction**:
   - Load: Supabase → React state (on auth, visibility change, real-time events)
   - Save: React state → Supabase (on state change, debounced)
   - Real-time: Supabase Realtime → React state (cross-device sync)

### Key Patterns
- **Optimistic updates**: Update local state immediately, sync to database async
- **Race condition prevention**: Use `recentlyUpdatedTasksRef` to track local changes
- **Debouncing**: Save and reload operations are debounced to prevent thrashing

---

## Database / Supabase Patterns

### Database Schema
- **tasks table**: Main task storage with RLS (Row Level Security)
- **tag_colors table**: User-specific tag color customizations

### Field Naming Convention
- **App (TypeScript)**: camelCase (e.g., `dueDate`, `recurrenceGroupId`)
- **Database (PostgreSQL)**: snake_case (e.g., `due_date`, `recurrence_group_id`)
- **Conversion**: Use `dbTaskToTask()` and `taskToDbTask()` in `supabaseStorage.ts`

### Supabase Operations Pattern
```typescript
import { supabase } from './supabase';
import { logger } from './logger';

export const loadSomething = async (): Promise<SomeType[]> => {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
      logger.error('[loadSomething] Auth error:', authError);
      return [];
    }
    if (!user) {
      logger.debug('[loadSomething] No user authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('table_name')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      logger.error('[loadSomething] Failed to load:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    logger.error('[loadSomething] Exception:', error);
    return [];
  }
};
```

### RLS (Row Level Security)
- All tables use RLS policies to ensure users can only access their own data
- Queries automatically filter by `user_id` due to RLS
- Check Supabase Dashboard > Authentication > Policies for policy configuration

---

## Error Handling

### Try-Catch Pattern
```typescript
const someOperation = async () => {
  try {
    // Validate prerequisites
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      logger.error('[someOperation] User not authenticated');
      return;
    }

    // Perform operation
    const result = await doWork();

    logger.debug('[someOperation] Success:', result);
    return result;

  } catch (error) {
    logger.error('[someOperation] Failed:', error);
    // Handle gracefully - don't crash the app
    throw error; // Re-throw if caller needs to handle
  }
};
```

### User-Facing Errors
- Show user-friendly messages, not raw stack traces
- Provide actionable guidance when possible
- Use toast notifications for quick feedback

---

## Testing

### Framework: Vitest + React Testing Library

### Running Tests
```bash
npm test              # Watch mode
npm run test:ui       # Interactive dashboard
npm run test:coverage # Coverage reports
```

### Test File Location
- Place test files in `src/test/` or alongside components as `*.test.tsx`

### Coverage Thresholds
- Lines: 50%
- Functions: 50%
- Branches: 50%
- Statements: 50%

---

## Build & Deployment

### Environment Variables
```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
VITE_LOG_LEVEL=debug|info|warn|error|silent  # Optional
```

### GitHub Actions
- **Deploy to GitHub Pages**: Triggers on push to main
- **Auto Version Bump**: Patches version on each commit to main

### Version Management
- Current version in `package.json`
- Auto-bumped on commits (patch level)
- Displayed in app via `import.meta.env.VITE_APP_VERSION`

---

## UI Patterns

### Date Formatting
**Use date-fns wrappers from `dateUtils.ts` for all date operations.**

**Display format: MM/DD/YY** (e.g., "01/14/25")

```typescript
import { formatDate, formatFullDate, isDateToday, isDateOverdue, getDateDisplay } from '../utils/dateUtils';

// Storage format (YYYY-MM-DD) - for database and internal use
const isoDate = formatDate(new Date()); // "2025-01-14"

// Display format (MM/DD/YY) - for user-facing dates
const display = formatFullDate(task.dueDate); // "01/14/25"

// Smart display - returns "Today", "Tomorrow", or MM/DD/YY
const smartDisplay = getDateDisplay(task.dueDate); // "Today", "Tomorrow", or "01/14/25"

// Date checks
if (isDateToday(task.dueDate)) { /* ... */ }
if (isDateOverdue(task.dueDate)) { /* ... */ }
```

### ID Generation
**Always use `generateId()` from `supabaseStorage.ts` for new task IDs.**

```typescript
import { generateId } from '../utils/supabaseStorage';

const newTask: Task = {
  id: generateId(), // Returns UUID-compliant format
  // ...
};
```

### Callback Naming
- **Props (from parent)**: `on` prefix (e.g., `onEdit`, `onDelete`, `onToggleComplete`)
- **Handlers (internal)**: `handle` prefix (e.g., `handleCardClick`, `handleDeleteClick`)

### Search Behavior
The GlobalSearch component provides a **dropdown-only** search experience:
- Typing shows a dropdown with matching tasks scoped to the **current view**
- Clicking a result opens the task for editing
- The view content is **not filtered** by search (dropdown only)
- Each view has its own placeholder text (e.g., "Search today's tasks...")

---

## Pull Request Template

```markdown
## Description
Brief description of what this PR does and why it's needed.

## Changes Made
- [ ] Change 1
- [ ] Change 2
- [ ] Change 3

## Verification Steps
1. How to test this change
2. What to verify
3. Expected outcome

## Testing
- [ ] Manual testing completed
- [ ] No console errors
- [ ] Works on mobile viewport

## Checklist
- [ ] Code follows style conventions (naming, structure)
- [ ] Error handling implemented (try/catch, logging)
- [ ] Logging includes `[ModuleName]` prefix
- [ ] TypeScript types are complete (no `any`)
- [ ] No hardcoded credentials or sensitive data
```

---

## Additional Notes

### Performance Considerations
- Use `useMemo` for expensive computations (task filtering)
- Use `useCallback` for event handlers passed to children
- Debounce save operations to prevent excessive API calls
- Use real-time subscriptions efficiently (don't reload on own changes)

### Mobile Considerations
- Breakpoint: 768px for mobile detection
- Test touch interactions
- Reload tasks on visibility change (handles mobile backgrounding)

### Security
- Never log credentials or API keys
- Store sensitive data in environment variables
- RLS policies ensure user data isolation
- Anon key is publishable (safe for client-side)
