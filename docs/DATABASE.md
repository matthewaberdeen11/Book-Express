# Database Schema Documentation

## Overview

The Book Express database is built on PostgreSQL and consists of 5 main tables designed to manage users, books, inventory, sales, and import operations.

## Entity Relationship Diagram

```
users (1) -----(N) import_logs
books (1) -----(N) inventory
books (1) -----(N) sales
```

## Table Details

### users
User authentication and profile management.

```sql
users {
    int id PK
    varchar username UK
    varchar email UK
    varchar password_hash
    varchar first_name
    varchar last_name
    varchar role
    boolean is_active
    timestamp created_at
    timestamp updated_at
}
```

Role values: admin, staff, manager

### books
Book catalog and product information.

```sql
books {
    int id PK
    varchar isbn UK
    varchar title
    varchar author
    varchar publisher
    varchar category
    text description
    decimal unit_price
    timestamp created_at
    timestamp updated_at
}
```

### inventory
Stock level tracking per book.

```sql
inventory {
    int id PK
    int book_id FK
    int quantity_on_hand
    int reorder_level
    timestamp last_updated
}
```

### sales
Daily sales transaction log.

```sql
sales {
    int id PK
    int book_id FK
    int quantity_sold
    decimal sale_price
    date sale_date
    timestamp created_at
}
```

### import_logs
File upload tracking for inventory and sales imports.

```sql
import_logs {
    int id PK
    int user_id FK
    varchar file_name
    varchar import_type
    varchar status
    int rows_processed
    int rows_failed
    text error_message
    timestamp uploaded_at
    timestamp completed_at
}
```

## Indexes

Indexes are created on frequently queried columns for performance:
- `books.isbn` - ISBN lookup
- `books.category` - Category filtering
- `inventory.book_id` - Inventory by book
- `sales.book_id` - Sales by book
- `sales.sale_date` - Date range queries
- `import_logs.user_id` - User's import history

## Sample Queries

### Get current inventory status
```sql
SELECT b.isbn, b.title, i.quantity_on_hand, i.reorder_level
FROM books b
JOIN inventory i ON b.id = i.book_id
WHERE i.quantity_on_hand < i.reorder_level;
```

### Total sales by category
```sql
SELECT b.category, SUM(s.quantity_sold) as total_sold
FROM sales s
JOIN books b ON s.book_id = b.id
WHERE s.sale_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.category;
```

## Maintenance

- Regularly backup the database
- Review import_logs for failed imports
- Update inventory after each sales import
