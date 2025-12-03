-- Migration 004: Add Catalogue Audit Log and Price History
-- Created: 2025-12-02
-- Description: Adds audit logging for catalogue changes and price history tracking

-- Audit log table
CREATE TABLE IF NOT EXISTS catalogue_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    field_changed VARCHAR(50),
    old_value TEXT,
    new_value TEXT,
    quantity_change INT,
    adjustment_reason VARCHAR(50),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

--price history table
CREATE TABLE IF NOT EXISTS price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    old_price DECIMAL(10, 2) NOT NULL,
    new_price DECIMAL(10, 2) NOT NULL,
    changed_by INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

--create indexes for performance
CREATE INDEX idx_audit_book_id ON catalogue_audit_log(book_id);
CREATE INDEX idx_audit_timestamp ON catalogue_audit_log(timestamp);
CREATE INDEX idx_price_history_book_id ON price_history(book_id);
