-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Create the reported_issues table
CREATE TABLE IF NOT EXISTS reported_issues (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL,
    issue_type TEXT NOT NULL,
    details TEXT,
    admin_reply TEXT,
    is_read BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'OPEN', -- Can be 'OPEN' or 'RESOLVED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Allow public access (since we are doing RLS manually in app)
ALTER TABLE reported_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all access" ON reported_issues FOR ALL USING (true) WITH CHECK (true);
