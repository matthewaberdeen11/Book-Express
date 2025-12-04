-- Migration 006: Add indexes to speed up analytics queries
-- Run this in your database to improve performance of analytics queries

ALTER TABLE sales ADD INDEX idx_sales_sale_date (sale_date);
ALTER TABLE sales ADD INDEX idx_sales_book_id (book_id);
ALTER TABLE inventory ADD INDEX idx_inventory_book_id (book_id);
ALTER TABLE inventory_log ADD INDEX idx_inventorylog_book_created (book_id, created_at);
