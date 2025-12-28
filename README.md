# Riley Task App

A modern, Outlook-inspired task management app with recurring tasks, week view planner, and comprehensive task organization.

## Features

- **Today & Tomorrow Views**: Quick access to tasks due today or tomorrow with date navigation
- **Week View**: Planner-style week view where you can see and drag tasks between days, navigate between weeks, and click day headers to view detailed day view
- **Day View**: Detailed view of tasks for a specific day, accessible from Week view
- **All Tasks View**: See all outstanding tasks grouped by tags
- **Completed View**: View all completed tasks sorted by most recently completed
- **Task Carryover**: Tasks that aren't completed automatically carry over to the next day (they appear in Today view if overdue)
- **Recurring Tasks**: Create tasks that repeat automatically:
  - Daily, Weekly, Monthly, Quarterly, Yearly, or Custom intervals
  - Custom recurrence with multiplier (1-50) and frequency selection
  - Auto-renewal: When the last instance of a recurring task is completed, automatically creates the next 50 instances
  - Creates 50 instances at a time
  - Editing recurring tasks can propagate changes to future instances
- **Subtasks**: Add checklists as subtasks to break down larger tasks:
  - Inline editing of subtask text
  - Auto-save when toggling subtasks
  - Confirmation prompt when completing a task with incomplete subtasks
- **Tags**: Organize tasks with tags:
  - One tag per task
  - Color-coded tags (customizable via Tag Manager)
  - Tasks grouped by tags in Today and All Tasks views
  - Collapsible tag groups
- **Tag Manager**: Dedicated interface to manage tags:
  - View all tags with usage counts
  - Customize tag colors (predefined colors or custom color picker)
  - Delete tags (removes from all tasks)
- **Search**: Search functionality across all views (except Week view):
  - Search in task titles
  - Search in tags (exact and substring match)
  - Search in subtask text
- **Undo Functionality**:
  - Undo delete (5 second timeout)
  - Undo completion
- **Date Navigation**:
  - Navigate to different dates in Today/Tomorrow views
  - Navigate between weeks in Week view
  - Navigate between days in Day view
  - "Today" button in Week view to jump to current week
- **Touch Gestures**: Swipe left/right in Week view to navigate between weeks
- **Cloud Storage**: All tasks are saved to Supabase (PostgreSQL database)
- **User Authentication**: Sign up/sign in to access your tasks across devices
- **Data Migration**: Automatically migrates existing localStorage data to Supabase on first login
- **Real-time Sync**: Changes sync automatically across devices
- **Demo Tasks**: App initializes with demo tasks if no tasks exist

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

### Creating Tasks
- Click the "+ Add Task" button
- Fill in the task details:
  - **Title** (required)
  - **Due Date** (optional - tasks without due dates won't appear in Today/Tomorrow/Week views)
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

### Views
- **Today**: Shows tasks due today and any overdue tasks, grouped by tags
  - Use date navigation to view tasks for other dates
  - Overdue tasks appear in a separate section at the bottom
- **Tomorrow**: Shows tasks due tomorrow, grouped by tags
  - Use date navigation to view tasks for other dates
- **Week**: Planner view showing the current week
  - Drag tasks between days to reschedule them
  - Click day headers to view detailed Day view
  - Navigate between weeks with Previous/Next buttons or swipe gestures
  - Click "Today" button to jump to current week
- **Day**: Detailed view of tasks for a specific day
  - Accessible by clicking a day header in Week view
  - Navigate between days with Previous/Next buttons
  - Click "Back to Week" to return to Week view
- **All Tasks**: Shows all incomplete tasks grouped by tags
- **Completed**: Shows all completed tasks sorted by most recently completed

### Task Management
- **Completing Tasks**:
  - Check the checkbox to mark a task as complete
  - If a task has incomplete subtasks, you'll be prompted to confirm completion
  - An undo notification appears after completing a task
- **Editing Tasks**:
  - Click "Edit" or click on a task card to modify it
  - For recurring tasks, changes to title, tags, and subtasks can propagate to future instances
  - You'll be prompted when editing subtasks of recurring tasks
- **Deleting Tasks**:
  - Click the delete button (🗑️) to remove a task
  - For recurring tasks, all future instances are deleted
  - An undo notification appears with a 5-second timeout
- **Rescheduling Tasks**:
  - In Week view, drag tasks between days to reschedule them
  - Or edit a task and change its due date

### Tag Management
- Click the tag manager button (🏷️) in the header
- **View Tags**: See all available tags with usage counts
- **Change Colors**: Click the color square next to a tag to customize its color
  - Choose from predefined colors or use the color picker
- **Delete Tags**: Click the delete button to remove a tag from all tasks

### Search
- Use the search bar (available in all views except Week view)
- Search matches:
  - Task titles
  - Tags (exact match or substring)
  - Subtask text
- Search is case-insensitive

### Recurring Tasks
- **Creating Recurring Tasks**: Set a due date and select a recurrence pattern
- **Auto-Renewal**: When you complete the last instance of a recurring task with auto-renewal enabled, the app automatically creates the next 50 instances
- **Editing Recurring Tasks**:
  - Changes to title, tags, and subtasks can propagate to all future instances
  - Changing recurrence settings regenerates all future instances
  - Changing the due date of the first instance regenerates all future instances
- **Deleting Recurring Tasks**: Deletes all future instances (past completed instances remain)
- **Last Instance Warning**: Tasks marked as the last instance show a "⚠️ PLEASE RENEW" warning

## Technical Details

- Built with React + TypeScript
- Uses Vite for fast development
- Supabase (PostgreSQL) for cloud data persistence with Row Level Security (RLS)
- User authentication via Supabase Auth
- Real-time data synchronization via Supabase Realtime
- date-fns for date handling and manipulation
- Responsive design that works on desktop and mobile
- Touch/swipe gestures for mobile navigation in Week view
- Drag and drop functionality for rescheduling tasks in Week view

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
