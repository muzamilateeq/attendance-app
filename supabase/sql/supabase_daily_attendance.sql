-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Create the new clean table
CREATE TABLE IF NOT EXISTS daily_attendance (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL,
    date_str TEXT NOT NULL, -- Format: YYYY-MM-DD
    date_email_key TEXT UNIQUE NOT NULL, -- Used for easy UPSERTs (e.g. 2026-06-29_ali@office.com)
    check_in_time TEXT, -- e.g. 08:00 AM
    check_out_time TEXT, -- e.g. 05:00 PM
    total_hours TEXT, -- e.g. 8h 30m
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow public access (since we are doing RLS manually in app)
ALTER TABLE daily_attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON daily_attendance FOR ALL USING (true) WITH CHECK (true);
