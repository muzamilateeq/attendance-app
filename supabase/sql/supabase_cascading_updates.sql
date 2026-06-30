-- RUN THIS IN YOUR SUPABASE SQL EDITOR

-- 1. Connect Device Bindings
ALTER TABLE device_bindings 
  ADD CONSTRAINT fk_device_bindings_email 
  FOREIGN KEY (email) REFERENCES employee_profiles(email) 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 2. Connect Daily Attendance
ALTER TABLE daily_attendance 
  ADD CONSTRAINT fk_daily_attendance_email 
  FOREIGN KEY (email) REFERENCES employee_profiles(email) 
  ON UPDATE CASCADE ON DELETE CASCADE;

-- 3. Connect Legacy Attendance (Optional, if it exists)
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'attendance') THEN
    ALTER TABLE attendance 
      ADD CONSTRAINT fk_attendance_email 
      FOREIGN KEY (email) REFERENCES employee_profiles(email) 
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Connect Reported Issues
ALTER TABLE reported_issues 
  ADD CONSTRAINT fk_reported_issues_email 
  FOREIGN KEY (email) REFERENCES employee_profiles(email) 
  ON UPDATE CASCADE ON DELETE CASCADE;
