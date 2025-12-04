-- Migration 008: Create catalogue_audit_log and price_history tables
-- Created: 2025-12-03
-- Description: Creates tables for tracking inventory and price changes

-- Create catalogue_audit_log table for tracking inventory adjustments
CREATE TABLE IF NOT EXISTS catalogue_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    old_value INT,
    new_value INT,
    quantity_change INT,
    adjustment_reason VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_item_id (item_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Create price_history table for tracking price changes
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    old_price DECIMAL(10, 2) NOT NULL,
    new_price DECIMAL(10, 2) NOT NULL,
    changed_by INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id),
    INDEX idx_item_id (item_id),
    INDEX idx_changed_at (changed_at)
);
