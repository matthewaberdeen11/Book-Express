-- Add last_login column to users table to track last sign-in time
ALTER TABLE users ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL;
