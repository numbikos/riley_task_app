CREATE TABLE tasks (
  id uuid PRIMARY KEY,
  title text NOT NULL,
  due_date date,
  completed boolean NOT NULL DEFAULT false,
  subtasks jsonb NOT NULL DEFAULT '[]',
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL,
  last_modified timestamptz NOT NULL,
  recurrence text,
  recurrence_group_id uuid,
  recurrence_multiplier integer,
  custom_frequency text,
  is_last_instance boolean NOT NULL DEFAULT false,
  auto_renew boolean NOT NULL DEFAULT false
);
CREATE INDEX tasks_incomplete_order ON tasks (created_at DESC, id) WHERE completed = false;
CREATE INDEX tasks_completed_order ON tasks (last_modified DESC, id) WHERE completed = true;
CREATE TABLE tag_colors (tag text PRIMARY KEY, color text NOT NULL);
CREATE TABLE app_sessions (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp(6) NOT NULL);
CREATE INDEX app_sessions_expire ON app_sessions (expire);
