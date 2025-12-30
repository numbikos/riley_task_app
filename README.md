# Riley Task App

A modern, Outlook-inspired task management app with recurring tasks, week view planner, and comprehensive task organization. Built with React, TypeScript, and Supabase for cloud storage and real-time synchronization.

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
  - An undo notification appears after completing a task (5 second timeout)
- **Editing Tasks**:
  - Click "Edit" or click on a task card to modify it
  - For recurring tasks, changes to title, tags, and subtasks can propagate to future instances
  - You'll be prompted when editing subtasks of recurring tasks
- **Deleting Tasks**:
  - Click the delete button (🗑️) to remove a task
  - For recurring tasks, a dialog appears with options:
    - Delete All Future Occurrences (from selected date onwards)
    - Delete All Open Occurrences (all incomplete tasks)
  - An undo notification appears with a 5-second timeout
- **Rescheduling Tasks**:
  - In Week view, drag tasks between days to reschedule them
  - Or edit a task and change its due date

### Recurring Tasks

- **Recurrence Patterns**: Daily, Weekly, Monthly, Quarterly, Yearly, or Custom intervals
- **Custom Recurrence**: Set a multiplier (1-50) and frequency (Days, Weeks, Months, Quarters, Years)
- **Auto-Creation**: Creates 50 instances automatically when a recurring task is created
- **Auto-Renewal**: When the last instance of a recurring task with auto-renewal enabled is completed, automatically creates the next 50 instances
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

- **Undo Delete**: 5-second timeout to restore deleted tasks
- **Undo Completion**: 5-second timeout to uncomplete tasks
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

- **Supabase Integration**: All tasks are saved to Supabase (PostgreSQL database)
- **User Authentication**: Sign up/sign in to access your tasks across devices
- **Data Migration**: Automatically migrates existing localStorage data to Supabase on first login
  - Shows migration notification when data is migrated
- **Real-time Sync**: Changes sync automatically across devices using Supabase Realtime
- **Row Level Security (RLS)**: Secure data access with user-based permissions
- **Demo Tasks**: App initializes with demo tasks if no tasks exist

### Notifications

- **Auto-Renewal Notification**: Shows when recurring tasks are automatically extended
- **Migration Notification**: Shows when localStorage data is migrated to Supabase
- **Undo Notifications**: For both task deletion and completion

## Getting Started

### Prerequisites

1. A Supabase account and project ([sign up here](https://supabase.com))

### Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Set up Supabase:**
   - Create a new Supabase project at https://supabase.com
   - Go to your project's SQL Editor
   - Run the SQL script from `supabase-schema.sql` to create the necessary tables and policies
   - Go to Project Settings > API
   - Copy your Project URL and anon/public key

3. **Configure environment variables:**
   - Create a `.env` file in the root directory
   - Add your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Start the development server:**
```bash
npm run dev
```

5. **Open your browser** to the URL shown (typically http://localhost:5173)

6. **Sign up or sign in** to start using the app. If you have existing localStorage data, it will be automatically migrated to Supabase on first login.

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
     - Creates 50 instances automatically
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
  - An undo notification appears after completing a task (5 second timeout)
- **Editing Tasks**:
  - Click "Edit" or click on a task card to modify it
  - For recurring tasks, changes to title, tags, and subtasks can propagate to future instances
  - You'll be prompted when editing subtasks of recurring tasks
- **Deleting Tasks**:
  - Click the delete button (🗑️) to remove a task
  - For recurring tasks, a dialog appears with options:
    - **Delete All Future Occurrences**: Deletes all incomplete tasks from the selected date onwards (completed and past tasks remain)
    - **Delete All Open Occurrences**: Deletes all incomplete tasks (past, present, and future; completed tasks remain)
  - An undo notification appears with a 5-second timeout
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
- **Auto-Renewal**: When you complete the last instance of a recurring task with auto-renewal enabled, the app automatically creates the next 50 instances
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

### Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **Backend**: Supabase (PostgreSQL) for cloud data persistence
- **Authentication**: Supabase Auth for user authentication
- **Real-time**: Supabase Realtime for automatic data synchronization across devices
- **Date Handling**: date-fns for date manipulation and formatting
- **Testing**: Vitest with React Testing Library for unit and integration tests

### Architecture

- **Component-Based**: Modular React components for maintainability
- **Custom Hooks**: 
  - `useAuth`: Handles authentication state and user management
  - `useTaskManagement`: Core task CRUD operations and undo functionality
  - `useRecurringTasks`: Recurring task logic and auto-renewal
  - `useViewState`: View navigation and date state management
- **Utility Functions**: Separated concerns for date operations, task filtering, storage, and recurring task helpers
- **Type Safety**: Full TypeScript coverage with comprehensive type definitions

### Features

- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Touch Gestures**: Swipe left/right in Week view to navigate between weeks
- **Drag and Drop**: Reschedule tasks by dragging between days in Week view
- **Keyboard Navigation**: Full keyboard support for search and navigation
- **Real-time Sync**: Changes sync automatically across all devices
- **Row Level Security (RLS)**: Secure data access with user-based permissions in Supabase
- **Data Migration**: Automatic migration from localStorage to Supabase on first login
- **Error Handling**: Comprehensive error handling and user feedback

### Testing

The app includes comprehensive test coverage:

- **Unit Tests**: Individual component and utility function tests
- **Integration Tests**: Component interaction and workflow tests
- **Test Runner**: Vitest with React Testing Library
- **Coverage Reports**: Generate coverage reports with `npm run test:coverage`
- **Test UI**: Interactive test UI available with `npm run test:ui`

Run tests with:
```bash
npm test              # Run tests in watch mode
npm run test:ui       # Open interactive test UI
npm run test:coverage # Generate coverage report
```

## Project Structure

```
src/
├── components/          # React components
│   ├── __tests__/      # Component tests
│   ├── AllTasksView.tsx
│   ├── Auth.tsx        # Authentication component
│   ├── CompletedView.tsx
│   ├── CompletionUndoNotification.tsx
│   ├── DayView.tsx
│   ├── DeleteRecurringDialog.tsx
│   ├── GlobalSearch.tsx
│   ├── GroupedTaskList.tsx
│   ├── NavigationHeader.tsx
│   ├── RecurringTaskGroup.tsx
│   ├── TagManager.tsx
│   ├── TaskCard.tsx
│   ├── TaskForm.tsx
│   ├── TodayView.tsx
│   ├── TomorrowView.tsx
│   ├── UndoNotification.tsx
│   └── WeekView.tsx
├── hooks/              # Custom React hooks
│   ├── __tests__/     # Hook tests
│   ├── useAuth.ts
│   ├── useRecurringTasks.ts
│   ├── useTaskManagement.ts
│   └── useViewState.ts
├── utils/              # Utility functions
│   ├── __tests__/     # Utility tests
│   ├── dateUtils.ts
│   ├── logger.ts
│   ├── recurringTaskHelpers.ts
│   ├── storage.ts
│   ├── supabase.ts
│   ├── supabaseStorage.ts
│   ├── taskOperations.ts
│   └── taskUtils.ts
├── test/               # Test setup
│   └── setup.ts
├── App.tsx             # Main app component
├── App.css             # Global styles
├── main.tsx            # App entry point
└── types.ts            # TypeScript type definitions

supabase-schema.sql     # Database schema for Supabase
```

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Deploying to GitHub Pages

This app can be deployed to GitHub Pages using GitHub Actions. Follow these steps:

### 1. Enable GitHub Pages
1. Go to your repository on GitHub
2. Navigate to **Settings** → **Pages**
3. Under **Source**, select **GitHub Actions**

### 2. Add GitHub Secrets
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add these two secrets:
   - Name: `VITE_SUPABASE_URL` → Value: Your Supabase project URL
   - Name: `VITE_SUPABASE_ANON_KEY` → Value: Your Supabase anon key

### 3. Push to Main Branch
The GitHub Actions workflow will automatically:
- Build your app with the environment variables
- Deploy it to GitHub Pages
- Your app will be available at: `https://yourusername.github.io/riley_task_app/`

### Note on Base Path
If your repository name is different from `riley_task_app`, update the `base` path in `vite.config.ts` to match your repository name.

### Manual Deployment (Alternative)
If you prefer to deploy manually:
1. Build the app: `npm run build`
2. Go to repository **Settings** → **Pages**
3. Select **Deploy from a branch**
4. Choose the `main` branch and `/dist` folder
5. Note: You'll need to inject environment variables into the built files manually, or use a service like Netlify/Vercel that supports environment variables.
