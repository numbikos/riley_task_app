-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  subtasks JSONB DEFAULT '[]'::jsonb,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  last_modified TIMESTAMPTZ DEFAULT now(),
  recurrence TEXT CHECK (recurrence IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom')),
  recurrence_group_id UUID,
  recurrence_multiplier INTEGER,
  custom_frequency TEXT CHECK (custom_frequency IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  is_last_instance BOOLEAN DEFAULT false,
  auto_renew BOOLEAN DEFAULT false
);

-- Create tag_colors table
CREATE TABLE IF NOT EXISTS tag_colors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  color TEXT NOT NULL,
  UNIQUE(user_id, tag)
);

-- Enable Row Level Security
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_colors ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks table
CREATE POLICY "Users can view their own tasks"
  ON tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks"
  ON tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks"
  ON tasks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks"
  ON tasks FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for tag_colors table
CREATE POLICY "Users can view their own tag colors"
  ON tag_colors FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tag colors"
  ON tag_colors FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tag colors"
  ON tag_colors FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tag colors"
  ON tag_colors FOR DELETE
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_recurrence_group_id ON tasks(recurrence_group_id);
CREATE INDEX IF NOT EXISTS idx_tag_colors_user_id ON tag_colors(user_id);

-- Function to automatically update last_modified timestamp
CREATE OR REPLACE FUNCTION update_last_modified()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_modified = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update last_modified on task updates
CREATE TRIGGER update_tasks_last_modified
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_last_modified();

