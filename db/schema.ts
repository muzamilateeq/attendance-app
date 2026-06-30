import { pgTable, text, timestamp, boolean, doublePrecision, uuid } from 'drizzle-orm/pg-core';

export const employeeProfiles = pgTable('employee_profiles', {
  email: text('email').primaryKey(),
  full_name: text('full_name').notNull(),
  phone_number: text('phone_number').notNull(),
  avatar_url: text('avatar_url'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const deviceBindings = pgTable('device_bindings', {
  email: text('email').primaryKey().references(() => employeeProfiles.email, { onDelete: 'cascade', onUpdate: 'cascade' }),
  device_id: text('device_id').notNull().unique(),
  phone_model: text('phone_model'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dailyAttendance = pgTable('daily_attendance', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().references(() => employeeProfiles.email, { onDelete: 'cascade', onUpdate: 'cascade' }),
  date_str: text('date_str').notNull(),
  date_email_key: text('date_email_key').notNull().unique(),
  check_in_time: text('check_in_time'),
  check_out_time: text('check_out_time'),
  total_hours: text('total_hours'),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const reportedIssues = pgTable('reported_issues', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().references(() => employeeProfiles.email, { onDelete: 'cascade', onUpdate: 'cascade' }),
  issue_type: text('issue_type').notNull(),
  details: text('details'),
  admin_reply: text('admin_reply'),
  is_read: boolean('is_read').default(false),
  status: text('status').default('OPEN'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
