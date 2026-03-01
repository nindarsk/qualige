
-- Add column to track welcome banner dismissal
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS welcome_banner_dismissed boolean NOT NULL DEFAULT false;

-- Enable realtime for employees table so HR admin gets live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
