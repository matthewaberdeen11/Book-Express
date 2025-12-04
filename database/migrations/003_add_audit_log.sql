--migration 003: add audit log for catalogue changes
CREATE TABLE catalogue_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    user_id INT NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    field_changed VARCHAR(100),
    old_value TEXT,
    new_value TEXT,
    quantity_change INT DEFAULT NULL,
    adjustment_reason VARCHAR(50),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_book_id (book_id),
    INDEX idx_user_id (user_id),
    INDEX idx_timestamp (timestamp)
);

--add price history table
CREATE TABLE price_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    old_price DECIMAL(10, 2) NOT NULL,
    new_price DECIMAL(10, 2) NOT NULL,
    changed_by INT NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id),
    FOREIGN KEY (changed_by) REFERENCES users(id),
    INDEX idx_book_id (book_id)
);
