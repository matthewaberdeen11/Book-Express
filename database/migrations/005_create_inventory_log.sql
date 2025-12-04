-- Migration 005: Create inventory_log used by fallback analytics
-- Creates a lightweight log table that records inventory imports and adjustments.

CREATE TABLE IF NOT EXISTS inventory_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NULL,
    action VARCHAR(64) NOT NULL,
    qty INT DEFAULT 0,
    note VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_inventory_log_book_id (book_id),
    INDEX idx_inventory_log_created_at (created_at),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
);
