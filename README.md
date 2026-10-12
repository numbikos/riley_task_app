# Riley Task App

A modern, Outlook-inspired task management app with recurring tasks, week view planner, and comprehensive task organization. Built with React, TypeScript, and a PostgreSQL API hosted on Railway.

## Features

### Views & Navigation

- **Today View**: Quick access to tasks due today and any overdue tasks, grouped by tags
  - Date navigation to view tasks for other dates
  - Overdue tasks appear in a separate section at the bottom
- **Tomorrow View**: Shows tasks due tomorrow, grouped by tags
  - Date navigation to view tasks for other dates
- **Next 5 View**: Planner-style week view showing the current week
  - Drag tasks between days to reschedule them
  - Click day headers to view detailed Day view
  - Navigate between weeks with Previous/Next buttons or swipe gestures
  - "Today" button to jump to current week
- **Day View**: Detailed view of tasks for a specific day
  - Accessible by clicking a day header in Week view
  - Navigate between days with Previous/Next buttons
  - "Back to Week" button to return to Week view
- **All Tasks View**: See all outstanding tasks grouped by tags
  - Collapsible tag groups
  - Delete entire recurring task groups
- **Completed View**: View all completed tasks sorted by most recently completed

### Task Management

- **Task Carryover**: Tasks that aren't completed automatically carry over to the next day (they appear in Today view if overdue)
- **Creating Tasks**: 
  - Title (required)
  - Due Date (optional - tasks without due dates won't appear in Today/Upcoming/Week views)
  - Recurrence patterns (optional - requires a due date)
  - Tags (one tag per task)
  - Subtasks (checklist items)
- **Completing Tasks**:
  - Check the checkbox to mark a task as complete
  - If a task has incomplete subtasks, you'll be prompted to confirm completion
  - An undo notification appears after completing a task (3 second timeout)
- **Editing Tasks**:
  - Click "Edit" or click on a task card to modify it
  - For recurring tasks, changes to title, tags, and subtasks can propagate to future instances
  - You'll be prompted when editing subtasks of recurring tasks
- **Deleting Tasks**:
  - Click the delete button (🗑️) to remove a task
  - For recurring tasks, a dialog appears with options:
    - Delete All Future Occurrences (from selected date onwards)
    - Delete All Open Occurrences (all incomplete tasks)
  - An undo notification appears with a 3-second timeout
- **Rescheduling Tasks**:
  - In Week view, drag tasks between days to reschedule them
  - Or edit a task and change its due date

### Recurring Tasks

- **Recurrence Patterns**: Daily, Weekly, Monthly, Quarterly, Yearly, or Custom intervals
- **Custom Recurrence**: Set a multiplier (1-50) and frequency (Days, Weeks, Months, Quarters, Years)
- **Auto-Creation**: Creates 10 instances automatically when a recurring task is created
- **Auto-Renewal**: When the last instance of a recurring task with auto-renewal enabled is completed, automatically creates the next 10 instances
  - Shows a notification when auto-renewal occurs
- **Editing Recurring Tasks**:
  - Changes to title, tags, and subtasks can propagate to all future instances
  - Changing recurrence settings regenerates all future instances
  - Changing the due date of the first instance regenerates all future instances
- **Deleting Recurring Tasks**: 
  - Options to delete future occurrences or all open occurrences
  - Past completed instances remain
- **Last Instance Warning**: Tasks marked as the last instance show a "⚠️ PLEASE RENEW" warning
- **Extend Recurring Tasks**: Manually extend a recurring task series to create more instances

### Subtasks

- Add checklists as subtasks to break down larger tasks
- Inline editing of subtask text
- Auto-save when toggling subtasks
- Confirmation prompt when completing a task with incomplete subtasks
- Subtasks can be propagated to future instances when editing recurring tasks

### Tags

- One tag per task
- Color-coded tags (customizable via Tag Manager)
- Tasks grouped by tags in Today and All Tasks views
- Collapsible tag groups
- Tags are stored in lowercase but displayed with proper capitalization
- Tag suggestions appear while typing in task form

### Tag Manager

- Accessible from the user menu (click user avatar in header)
- View all tags with usage counts
- Customize tag colors:
  - Choose from predefined colors
  - Use custom color picker for any color
- Delete tags (removes from all tasks)

### Global Search

- Search bar available in the header (all views except Week view)
- Real-time search results dropdown with keyboard navigation:
  - Arrow keys to navigate results
  - Enter to select
  - Escape to close
- Search matches:
  - Task titles
  - Tags (exact match or substring)
  - Subtask text
- Search is case-insensitive
- Shows up to 8 results, sorted by due date (earliest first)
- Groups recurring task instances (expandable to see all instances)
- Only shows incomplete tasks in search results

### Undo Functionality

- **Undo Delete**: 3-second timeout to restore deleted tasks
- **Undo Completion**: 3-second timeout to uncomplete tasks
- Notifications appear at the bottom of the screen

### User Interface

- **User Menu**: Click user avatar in header to access:
  - User email display
  - Tag Manager access
  - Sign Out option
  - App version display
- **Mobile Bottom Navigation**: On mobile devices (< 768px), bottom navigation bar for quick access to:
  - Today
  - Upcoming
  - Next 5
  - Done (Completed)
  - All
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Touch Gestures**: Swipe left/right in Week view to navigate between weeks
- **Drag and Drop**: Reschedule tasks by dragging between days in Week view

### Cloud Storage & Authentication

- Tasks and tag colors persist in PostgreSQL on Railway.
- One shared username and password protects all task APIs. There is no public signup.
- Sessions use HttpOnly cookies and PostgreSQL, and survive application restarts.
- Devices synchronize every 15 seconds while visible and refresh on tab focus.
- Existing Supabase data can be exported and imported with verified migration tools.

## Getting Started

Use Node.js 22.12+ and a PostgreSQL database.

```bash
npm ci
cp .env.example .env
# Set your database URL, shared login, and random session secret in .env.
npm run dev
```

Open http://localhost:5181. Vite proxies API requests to the backend on port 3000.
The backend initializes the schema on startup. Use Riley's previous email as
`AUTH_USERNAME` to retain her daily messages. The shared password must be at
least 8 characters, and `SESSION_SECRET` at least 32 random characters.

Production setup, data export/import, and cutover instructions are in
[the Railway migration guide](docs/railway-migration.md).

## Usage

The app provides several ways to navigate:

- **Header Navigation**: Main navigation tabs at the top (Today, Upcoming, Next 5, All Tasks, Completed)
- **Mobile Bottom Navigation**: On mobile devices, a bottom navigation bar provides quick access to main views
- **Date Navigation**: 
  - Navigate to different dates in Today/Upcoming views using Previous/Next buttons
  - Navigate between weeks in Week view with Previous/Next buttons or swipe gestures
  - Navigate between days in Day view with Previous/Next buttons
  - "Today" button in Week view to jump to current week
- **Global Search**: Type in the search bar to quickly find and navigate to tasks
- **Click Navigation**: Click on day headers in Week view to open Day view, click task cards to edit

### Creating Tasks

1. Click the "+ New Task" button in the header
2. Fill in the task details:
   - **Title** (required)
   - **Due Date** (optional - tasks without due dates won't appear in Today/Upcoming/Week views)
   - **Recurrence** (optional - requires a due date):
     - Select from Daily, Weekly, Monthly, Quarterly, Annually, or Custom
     - Custom recurrence: Set a number (1-50) and frequency (Days, Weeks, Months, Quarters, Years)
     - Creates 10 instances automatically
     - Auto-renewal is enabled by default for recurring tasks
   - **Tags** (optional - one tag per task):
     - Type tag name and press Enter to add
     - See available tags as suggestions while typing
     - Tags are stored in lowercase but displayed with proper capitalization
   - **Subtasks** (optional - add checklist items):
     - Type subtask text and press Enter or click "Add"
     - Click subtask text to edit inline
     - Check/uncheck subtasks to track progress
3. Click "Save" to create the task

### Managing Tasks

- **Completing Tasks**: 
  - Check the checkbox to mark a task as complete
  - If a task has incomplete subtasks, you'll be prompted to confirm completion
  - An undo notification appears after completing a task (3 second timeout)
- **Editing Tasks**:
  - Click "Edit" or click on a task card to modify it
  - For recurring tasks, changes to title, tags, and subtasks can propagate to future instances
  - You'll be prompted when editing subtasks of recurring tasks
- **Deleting Tasks**:
  - Click the delete button (🗑️) to remove a task
  - For recurring tasks, a dialog appears with options:
    - **Delete All Future Occurrences**: Deletes all incomplete tasks from the selected date onwards (completed and past tasks remain)
    - **Delete All Open Occurrences**: Deletes all incomplete tasks (past, present, and future; completed tasks remain)
  - An undo notification appears with a 3-second timeout
- **Rescheduling Tasks**:
  - In Week view, drag tasks between days to reschedule them
  - Or edit a task and change its due date

### Tag Management

1. Click the user avatar in the header to open the user menu
2. Click "Manage Tags" to open the Tag Manager
3. **View Tags**: See all available tags with usage counts
4. **Change Colors**: Click the color square next to a tag to customize its color
   - Choose from predefined colors or use the color picker
5. **Delete Tags**: Click the delete button to remove a tag from all tasks

### Global Search

1. Click in the search bar in the header (available in all views except Week view)
2. Start typing to see real-time search results
3. **Keyboard Navigation**:
   - Use Arrow Up/Down to navigate results
   - Press Enter to select a task (opens edit form)
   - Press Escape to close the dropdown
4. **Search Features**:
   - Searches task titles, tags, and subtask text
   - Case-insensitive
   - Shows up to 8 results, sorted by due date
   - Groups recurring task instances (click the "+N" button to expand)
   - Only shows incomplete tasks
5. Click the × button or clear the search to close

### Recurring Tasks

- **Creating Recurring Tasks**: Set a due date and select a recurrence pattern
- **Auto-Renewal**: When you complete the last instance of a recurring task with auto-renewal enabled, the app automatically creates the next 10 instances
  - A notification appears showing how many instances were created
- **Editing Recurring Tasks**:
  - Changes to title, tags, and subtasks can propagate to all future instances
  - Changing recurrence settings regenerates all future instances
  - Changing the due date of the first instance regenerates all future instances
- **Extending Recurring Tasks**: Use the "Extend Recurring Task" button in the task form to manually create more instances
- **Deleting Recurring Tasks**: 
  - Options to delete future occurrences or all open occurrences
  - Past completed instances remain
- **Last Instance Warning**: Tasks marked as the last instance show a "⚠️ PLEASE RENEW" warning

## Technical Details

The existing React/Vite interface talks to an Express API on the same origin.
PostgreSQL stores tasks, tag colors, and login sessions. The API validates input,
uses parameterized SQL and transactional writes, and checks the shared session
on every data endpoint. Login attempts are rate limited and state-changing
requests require the configured origin and an application header.

Recurrence generation, optimistic editing, undo, completed-task pagination,
search, statistics, and local view preferences retain the existing frontend
behavior. A failed refresh throws instead of appearing as an empty database.

The server lives in `server/`, the browser API and storage adapters in
`src/utils/api.ts` and `src/utils/taskStorage.ts`, and migration tools in
`scripts/`. `server/schema.sql` is the initial tracked database migration.

## Testing

```bash
npm test -- --run
npm run build
# Point TEST_DATABASE_URL at an isolated, disposable PostgreSQL database:
npm run test:api
```

The API tests cover protected routes, credentials, session persistence and
revocation, origin protection, task round trips, pagination, tags, and verified
snapshot import. They truncate the test tables. CI provides PostgreSQL 18.

## Production

```bash
npm run build
NODE_ENV=production npm start
```

Configure all server variables from `.env.example`, including an HTTPS
`APP_ORIGIN` without a trailing slash. Railway uses the checked-in Dockerfile
and `railway.json`; the app listens on `PORT` (default 3000) and `/health` verifies
a database connection. The browser needs no database credentials or Supabase keys.

See [the migration guide](docs/railway-migration.md) for the complete deployment
and data cutover process.
