-- Migration 003: Restructure inventory table for CSV imports
-- Problem: Current schema has book_id as NOT NULL foreign key, blocking CSV imports
-- Solution: Make book_id optional, add CSV-specific columns as primary tracking mechanism

-- Step 1: Add new CSV-specific columns
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_id VARCHAR(50) UNIQUE NOT NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS item_name VARCHAR(255) NOT NULL;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS rate VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS product_type VARCHAR(100);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS status VARCHAR(50);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;

-- Step 2: Modify book_id to be nullable (allow CSV imports without book_id)
ALTER TABLE inventory MODIFY book_id INT NULL;

-- Step 3: Create index on item_id for fast lookups
ALTER TABLE inventory ADD INDEX IF NOT EXISTS idx_item_id (item_id);

-- Step 4: Create index on quantity for low stock queries
ALTER TABLE inventory ADD INDEX IF NOT EXISTS idx_quantity (quantity);

