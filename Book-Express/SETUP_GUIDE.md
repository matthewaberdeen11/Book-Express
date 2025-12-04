# Book Express Inventory Management - Setup & Testing Guide

## System Overview
A PHP/MySQL-based inventory management system for Book Express with CSV import functionality for both initial population and daily sales tracking.

## Database Setup

### 1. Create Database and Run Migrations
```sql
CREATE DATABASE IF NOT EXISTS book_express;
USE book_express;

-- Run the following migration files in order:
-- 1. database/schema.sql - Creates initial tables (users, books, inventory, sales, import_logs)
-- 2. database/migrations/001_create_initial_tables.sql
-- 3. database/migrations/002_add_manager_user.sql
-- 4. database/migrations/003_update_for_imports.sql
```

### 2. Database Configuration
Edit `backend/config/database.php`:
- `DB_HOST`: localhost (default)
- `DB_PORT`: 3306 (default)
- `DB_NAME`: book_express
- `DB_USER`: root
- `DB_PASSWORD`: (empty for XAMPP)

## User Authentication

### Default Manager Account
- **Username**: manager
- **Password**: Manager@2025
- **Role**: Manager

## CSV Import System

### File Locations
- **Import API**: `/backend/api/import.php`
- **Import Frontend**: `/frontend/import.html`
- **Sample Files**: `/assets/Item_sample.csv` and `/assets/Sales_by_Item_sample.csv`

### Import Type 1: Initial Inventory Import
**File Format**: `Item.csv` (or similar)
**Required Columns**:
- `Item ID` - Unique identifier (e.g., BOOK001)
- `Item Name` - Product name
- `Rate` - Unit price (supports formats like "JMD 2390.00")
- `Product Type` - Category (defaults to "goods")
- `Status` - Status (defaults to "Active")

**Processing Logic**:
1. Reads each row from CSV
2. Extracts numeric rate using regex (handles "JMD" prefix, commas, etc.)
3. Checks if item already exists (skips if found)
4. Inserts new items into inventory table with quantity=0

### Import Type 2: Daily Sales Import
**File Format**: `Sales_by_Item.csv` (or similar)
**Required Columns**:
- `item_id` - Must match existing inventory item_id
- `item_name` - Product name
- `quantity_sold` - Number of units sold
- `amount` - Total sales amount
- `average_price` - Per-unit price

**Processing Logic**:
1. Reads each row from CSV
2. Looks up item in inventory by item_id
3. Validates price within 10% of stored rate (flags discrepancies)
4. Deducts quantity_sold from current inventory quantity
5. Quantity never goes below 0

**Price Validation**:
- If average_price differs from stored rate by >10%, row is flagged as discrepancy
- Discrepancies are reported but processing continues

### Database Tables

#### Inventory Table
```sql
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT,
    quantity_on_hand INT DEFAULT 0,
    reorder_level INT DEFAULT 10,
    
    -- New columns added for CSV import
    item_id VARCHAR(30) UNIQUE,
    item_name VARCHAR(255),
    rate VARCHAR(20),
    product_type VARCHAR(30),
    status VARCHAR(20),
    quantity INT DEFAULT 0,
    
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
```

#### Import Logs Table
```sql
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
```

## API Endpoints

### 1. Import Endpoint
**POST** `/backend/api/import.php`

**Request Parameters**:
- `csv` (file) - CSV file to import
- `importType` (string) - "initial" or "daily"

**Response** (JSON):
```json
{
    "processed": 5,
    "successful": 4,
    "unrecognized": [],
    "discrepancies": [],
    "errors": [],
    "total_sales": 14930.00
}
```

### 2. Dashboard Endpoint
**GET** `/backend/api/dashboard.php`

**Response** (JSON):
```json
{
    "totalItems": 5,
    "inStock": 3,
    "outOfStock": 2,
    "lowStockCount": 1,
    "inventoryValue": "11570.00"
}
```

## Frontend Components

### Dashboard (`/frontend/dashboard.html`)
- Displays inventory statistics:
  - Total Items
  - In/Out of Stock
  - Low Stock Alerts (items with quantity < 5)
  - Total Inventory Value
- Left panel: Favourites section (empty by default)
- Right panel: Cards grid with statistics
- Shows Sales Performance chart placeholder

### Import Page (`/frontend/import.html`)
- Toggle between "Initial Inventory Import" and "Daily Sales Import"
- Drag-and-drop CSV upload area
- CSV formatting guidelines (updates based on import type)
- Download template button (provides sample CSV)
- Import summary display:
  - Processed count
  - Successful count
  - Unrecognized items
  - Price discrepancies
  - Errors
- Alert for price mismatches

## Testing Instructions

### Test 1: Initial Inventory Import
1. Log in with manager credentials
2. Navigate to Import Data page
3. Select "Initial Inventory Import"
4. Click "Download Template" to get sample CSV
5. Upload the CSV file
6. Verify summary shows successful insertions
7. Check dashboard - total items should increase

### Test 2: Daily Sales Import
1. Navigate to Import Data page
2. Select "Daily Sales Import"
3. Download template (Sales_by_Item.csv)
4. Upload CSV with sales data
5. Verify summary shows quantity updates
6. Check dashboard - inventory values should update

### Test 3: Error Handling
1. Upload CSV with missing required columns
2. Upload CSV with invalid data
3. Upload non-CSV file
4. Verify appropriate error messages display

## Debugging

### Enable Debug Logging
- PHP errors are logged to error_log (check XAMPP logs)
- Import.php includes debug output via `error_log()` statements
- Check browser console for JavaScript errors

### Common Issues

**Import shows 0 processed/successful**:
- Check CSV column names match expected format
- Verify file is valid CSV (not Excel format)
- Check PHP error logs for database connection issues

**Database connection failed**:
- Verify MySQL is running (XAMPP)
- Check database credentials in `backend/config/database.php`
- Ensure `book_express` database exists

**Dashboard shows $0.00 value**:
- Verify items have quantity > 0
- Check rate field contains numeric values
- Run initial inventory import first

## File Structure Summary
```
Book-Express/
├── backend/
│   ├── api/
│   │   ├── import.php (CSV processing API)
│   │   ├── dashboard.php (Statistics API)
│   │   ├── login.php
│   │   └── logout.php
│   ├── config/
│   │   └── database.php (DB connection)
│   └── auth/
│       ├── Auth.php
│       └── SessionManager.php
├── frontend/
│   ├── dashboard.html
│   ├── import.html
│   ├── login.html
│   ├── js/
│   │   ├── dashboard.js
│   │   ├── import.js
│   │   └── auth.js
│   └── css/
│       ├── dashboard.css
│       ├── import.css
│       └── style.css
├── database/
│   ├── schema.sql
│   └── migrations/
│       ├── 001_create_initial_tables.sql
│       ├── 002_add_manager_user.sql
│       └── 003_update_for_imports.sql
└── assets/
    ├── Item_sample.csv
    └── Sales_by_Item_sample.csv
```

## Next Steps
1. Start XAMPP (Apache & MySQL)
2. Access phpMyAdmin and create the database
3. Run all migration files
4. Navigate to `http://localhost/Book-Express/frontend/login.html`
5. Test CSV import functionality
