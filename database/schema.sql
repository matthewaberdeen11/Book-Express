-- Book Express Inventory Management System
-- MySQL Database Schema (Corrected: Inventory-focused, no books/sales tables)

-- Create users table for authentication
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create inventory table (primary table for all items - CSV imports and manual)
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) UNIQUE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    grade_level VARCHAR(20),
    rate VARCHAR(50),
    product_type VARCHAR(100),
    status VARCHAR(50),
    quantity_on_hand INT DEFAULT 0,
    quantity INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    is_favourite BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_item_id (item_id),
    INDEX idx_grade_level (grade_level),
    INDEX idx_is_favourite (is_favourite),
    INDEX idx_quantity (quantity_on_hand)
);

-- Create import_logs table for file uploads
CREATE TABLE import_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    import_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    rows_processed INT DEFAULT 0,
    rows_failed INT DEFAULT 0,
    error_message TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create catalogue_audit_log table for tracking inventory changes
CREATE TABLE catalogue_audit_log (
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
CREATE TABLE price_history (
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

-- Create favourites table
CREATE TABLE favourites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL,
    added_by INT NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES inventory(item_id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id),
    UNIQUE KEY unique_favourite_item (item_id),
    INDEX idx_added_at (added_at)
);

-- Create low_stock_alerts table
CREATE TABLE low_stock_alerts (
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
