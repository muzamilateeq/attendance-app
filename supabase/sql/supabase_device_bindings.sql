-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Create the device_bindings table
CREATE TABLE IF NOT EXISTS device_bindings (
    email TEXT PRIMARY KEY,
    device_id TEXT NOT NULL UNIQUE,
    phone_model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow public access (since we are doing RLS manually in app)
ALTER TABLE device_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON device_bindings FOR ALL USING (true) WITH CHECK (true);
