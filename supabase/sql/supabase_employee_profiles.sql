-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Create the employee_profiles table
CREATE TABLE IF NOT EXISTS employee_profiles (
    email TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow public access (since we are doing RLS manually in app)
ALTER TABLE employee_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON employee_profiles FOR ALL USING (true) WITH CHECK (true);
