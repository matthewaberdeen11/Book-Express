# Database

This directory contains all database-related files for the Book Express Inventory Management system.

## Structure

- **schema.sql** - Initial MySQL database schema
- **migrations/** - Database migration scripts for schema changes

## Setup with XAMPP MySQL

1. Ensure MySQL is installed and running via XAMPP
2. Create a new database: `CREATE DATABASE book_express;`
3. Run the schema file using command line:
   ```bash
   mysql -u root book_express < database/schema.sql
   ```
4. Add the manager user:
   ```bash
   mysql -u root book_express < database/migrations/002_add_manager_user.sql
   ```

## Alternative Setup via phpMyAdmin

1. Open phpMyAdmin (http://localhost/phpmyadmin)
2. Create new database called `book_express`
3. Select the database
4. Click "Import"
5. Choose `database/schema.sql` and click Import
6. Repeat for `database/migrations/002_add_manager_user.sql`

## Database Tables

### users
Stores user authentication and profile information.
- `id` - Primary key
- `username` - Unique username for login
- `email` - User email address
- `password_hash` - Hashed password
- `role` - User role (admin, staff, etc.)
- `is_active` - Account status

### books
Catalog of all books in the system.
- `id` - Primary key
- `isbn` - International Standard Book Number (unique)
- `title` - Book title
- `author` - Author name
- `publisher` - Publisher name
- `category` - Book category for organization
- `unit_price` - Cost of the book

### inventory
Tracks current stock levels for each book.
- `id` - Primary key
- `book_id` - Foreign key to books table
- `quantity_on_hand` - Current stock level
- `reorder_level` - Minimum stock threshold

### sales
Records all sales transactions.
- `id` - Primary key
- `book_id` - Foreign key to books table
- `quantity_sold` - Number of units sold
- `sale_price` - Price at time of sale
- `sale_date` - Date of transaction

### import_logs
Tracks file uploads and import operations.
- `id` - Primary key
- `user_id` - Foreign key to users table
- `file_name` - Name of uploaded file
- `import_type` - Type of import (inventory, sales)
- `status` - Import status (pending, completed, failed)
- `rows_processed` - Number of successful rows
- `rows_failed` - Number of failed rows

## Naming Conventions

- Table names: snake_case (e.g., `users`, `books`)
- Column names: snake_case
- Primary keys: `id` (auto increment)
- Foreign keys: `table_name_id`

