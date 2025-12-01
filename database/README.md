# Database

This directory contains all database-related files for the Book Express Inventory Management system.

## Structure

- **schema.sql** - Initial PostgreSQL database schema
- **migrations/** - Database migration scripts for schema changes

## Setup

1. Ensure PostgreSQL is installed and running via XAMPP
2. Create a new database: `CREATE DATABASE book_express;`
3. Run the schema file: `psql -U postgres -d book_express -f database/schema.sql`
4. Use migrations/ folder for any future schema changes

## Naming Conventions

- Table names: snake_case (e.g., `users`, `book_inventory`)
- Column names: snake_case
- Primary keys: `id` (serial/bigserial)
- Foreign keys: `table_name_id`
