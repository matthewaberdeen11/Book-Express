-- Add item_id, item_name, rate, and quantity columns to inventory table for CSV imports
ALTER TABLE inventory ADD COLUMN item_id VARCHAR(50) UNIQUE AFTER book_id;
ALTER TABLE inventory ADD COLUMN item_name VARCHAR(255) AFTER item_id;
ALTER TABLE inventory ADD COLUMN rate VARCHAR(50) AFTER item_name;
ALTER TABLE inventory ADD COLUMN quantity INT DEFAULT 0 AFTER rate;
