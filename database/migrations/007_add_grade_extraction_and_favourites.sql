-- Migration 007: Create favourites and low_stock_alerts tables
-- Created: 2025-12-03
-- Description: Adds favourites and low stock alert tracking with grade level support

-- Create favourites table (remove book_id, use item_id only)
CREATE TABLE IF NOT EXISTS favourites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    added_by INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id),
    UNIQUE KEY unique_favourite_item (item_id),
    INDEX idx_added_at (added_at)
);

-- Create low_stock_alerts table with grade_level for filtering
CREATE TABLE IF NOT EXISTS low_stock_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    grade_level VARCHAR(20),
    threshold INT NOT NULL,
    current_quantity INT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    acknowledged_by INT,
    acknowledged_at TIMESTAMP NULL,
    alert_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    alert_cleared_at TIMESTAMP NULL,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE,
    FOREIGN KEY (acknowledged_by) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_alert_created_at (alert_created_at),
    INDEX idx_grade_level (grade_level)
);

-- Ensure inventory table has grade_level column for filtering
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_inventory_grade_level ON inventory(grade_level);
