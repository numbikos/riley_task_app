# Supabase Database Migration Instructions

## Apply Database Constraints

To add the new validation constraints to your existing Supabase database, follow these steps:

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard: https://supabase.com/dashboard
2. Select your project (vrllahirhzfsvtujvdgu)
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the contents of `supabase-migration-add-constraints.sql`
6. Paste into the SQL editor
7. Click **Run** to execute the migration

### Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref vrllahirhzfsvtujvdgu

# Run the migration
supabase db push --file supabase-migration-add-constraints.sql
```

## What These Constraints Do

The migration adds the following database-level validations:

1. **`check_recurrence_multiplier`**: Ensures recurrence_multiplier is between 1 and 50
2. **`check_title_not_empty`**: Prevents empty task titles
3. **`check_tag_not_empty`**: Prevents empty tag names in the tag_colors table (does not require tasks to have tags)
4. **`check_color_not_empty`**: Prevents empty tag colors
5. **`check_recurrence_multiplier_only_with_custom`**: Ensures recurrence_multiplier is only set when recurrence is 'custom'
6. **`check_custom_frequency_only_with_custom`**: Ensures custom_frequency is only set when recurrence is 'custom'

## Verification

After running the migration, verify it was successful:

```sql
-- Check constraints were added
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'tasks'::regclass
  AND contype = 'c';
```

## Rollback (If Needed)

If you need to remove these constraints:

```sql
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_recurrence_multiplier;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_title_not_empty;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_recurrence_multiplier_only_with_custom;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS check_custom_frequency_only_with_custom;
ALTER TABLE tag_colors DROP CONSTRAINT IF EXISTS check_tag_not_empty;
ALTER TABLE tag_colors DROP CONSTRAINT IF EXISTS check_color_not_empty;
```

## Updated Schema

The `supabase-schema.sql` file has been updated to include these constraints for future reference and new installations.
