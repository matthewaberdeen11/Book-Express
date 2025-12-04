-- Migration 003: Prepare inventory table for CSV imports
-- Created: 2025-12-01
-- Description: Ensures inventory table has all necessary columns for CSV imports (already created in schema, but documented here for reference)

-- Ensure inventory table has all required columns for CSV and manual imports
-- (These columns are created in schema.sql, so this is a safety check if running migrations separately)

ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_id VARCHAR(50) UNIQUE;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_name VARCHAR(255);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rate VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_item_id ON inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_grade_level ON inventory(grade_level);
CREATE INDEX IF NOT EXISTS idx_is_favourite ON inventory(is_favourite);
CREATE INDEX IF NOT EXISTS idx_quantity ON inventory(quantity);
