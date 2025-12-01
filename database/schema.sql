-- Book Express Inventory Management System
-- PostgreSQL Database Schema

-- Create users table for authentication
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'staff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create books table
CREATE TABLE books (
    id SERIAL PRIMARY KEY,
    isbn VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(255),
    publisher VARCHAR(255),
    category VARCHAR(100),
    description TEXT,
    unit_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory table
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    quantity_on_hand INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 10,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create sales table
CREATE TABLE sales (
    id SERIAL PRIMARY KEY,
    book_id INTEGER NOT NULL REFERENCES books(id),
    quantity_sold INTEGER NOT NULL,
    sale_price DECIMAL(10, 2) NOT NULL,
    sale_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create import_logs table for file uploads
CREATE TABLE import_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    import_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    rows_processed INTEGER DEFAULT 0,
    rows_failed INTEGER DEFAULT 0,
    error_message TEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_books_isbn ON books(isbn);
CREATE INDEX idx_books_category ON books(category);
CREATE INDEX idx_inventory_book_id ON inventory(book_id);
CREATE INDEX idx_sales_book_id ON sales(book_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_import_logs_user_id ON import_logs(user_id);
