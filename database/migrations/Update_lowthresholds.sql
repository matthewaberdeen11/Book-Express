-- ==========================================
-- Low Stock Alerts System - Database Schema
-- ==========================================
-- Run this in phpMyAdmin to create the required tables

-- Create low_stock_alerts table
-- Stores alerts when items fall below their reorder_level threshold
CREATE TABLE IF NOT EXISTS low_stock_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id VARCHAR(255) NOT NULL COMMENT 'Can be book_id or item_id from inventory table',
    status ENUM('pending', 'acknowledged', 'reorder_initiated', 'resolved') DEFAULT 'pending',
    is_critical TINYINT(1) DEFAULT 0 COMMENT '1 if item is out of stock or critically low',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_book_id (book_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create low_stock_history table
-- Tracks all status changes and updates to alerts
CREATE TABLE IF NOT EXISTS low_stock_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_id INT NOT NULL,
    status VARCHAR(50) NOT NULL COMMENT 'Status that was set (pending, acknowledged, reorder_initiated, resolved)',
    notes TEXT COMMENT 'Optional notes about the status change',
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES low_stock_alerts(id) ON DELETE CASCADE,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_alert_id (alert_id),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==========================================
-- Verify Tables Created Successfully
-- ==========================================

-- Show the structure of the created tables
SHOW CREATE TABLE low_stock_alerts;
SHOW CREATE TABLE low_stock_history;

-- Count existing records (should be 0 initially)
SELECT 'low_stock_alerts' as table_name, COUNT(*) as record_count FROM low_stock_alerts
UNION ALL
SELECT 'low_stock_history' as table_name, COUNT(*) as record_count FROM low_stock_history;
