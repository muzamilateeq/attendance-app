-- Enable the uuid-ossp extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the profiles table for employees and device binding
CREATE TABLE public.profiles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  device_id text -- Left blank initially, filled by the app on first login
);

-- Create the attendance table for logging check-ins and check-outs
CREATE TABLE public.attendance (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  email text NOT NULL REFERENCES public.profiles(email) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('CHECKED_IN', 'CHECKED_OUT')),
  latitude float8,
  longitude float8,
  timestamp timestamp with time zone DEFAULT now()
);

-- Optional: Enable Row Level Security (RLS) if you want to restrict data access later
-- ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Insert a test employee so you can test the login right away
INSERT INTO public.profiles (email, device_id)
VALUES ('employee@test.com', NULL);
