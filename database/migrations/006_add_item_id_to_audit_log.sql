-- Migration 006: Add Item ID Support to Audit Log
-- Created: 2025-12-03
-- Description: Adds item_id column to catalogue_audit_log to track CSV item adjustments

ALTER TABLE catalogue_audit_log 
ADD COLUMN item_id VARCHAR(50) NULL AFTER book_id;

-- Add index for item_id for better query performance
CREATE INDEX idx_audit_item_id ON catalogue_audit_log(item_id);

-- Allow book_id to be nullable for CSV items
ALTER TABLE catalogue_audit_log 
MODIFY COLUMN book_id INT NULL;
