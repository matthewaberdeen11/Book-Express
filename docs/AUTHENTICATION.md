# Authentication System Documentation

## Overview

The Book Express authentication system uses PHP sessions for user management with BCRYPT password hashing. The system supports a single predefined manager account with admin role who can manage other users (future feature).

## Predefined Manager Account

**Username:** `manager`  
**Password:** `Manager@2025`  
**Role:** `admin`

> Note: Change this password immediately after first login.

## Architecture

### Backend Components

#### 1. SessionManager.php
Handles session lifecycle and validation.

```php
SessionManager::init()           // Initialize session
SessionManager::isAuthenticated() // Check if user is logged in
SessionManager::setUser()        // Set user in session
SessionManager::getUser()        // Get current user
SessionManager::destroy()        // Destroy session (logout)
```

Features:
- HTTPOnly cookies (prevents XSS)
- SameSite=Strict (prevents CSRF)
- Session timeout after 1 hour of inactivity
- Automatic session validation

#### 2. Auth.php
Core authentication logic.

```php
$auth = new Auth($db);
$auth->login($username, $password)
$auth->changePassword($user_id, $old_password, $new_password)
```

Features:
- Bcrypt password hashing
- Account active status check
- Secure password verification

### API Endpoints

#### POST /backend/api/login.php
Authenticate user and create session.

Request:
```json
{
    "username": "string",
    "password": "string"
}
```

Response:
```json
{
    "success": true,
    "message": "Login successful",
    "user": {
        "id": 1,
        "username": "manager",
        "role": "admin"
    }
}
```

#### GET /backend/api/user.php
Get current authenticated user.

Response:
```json
{
    "success": true,
    "user": {
        "id": 1,
        "username": "manager",
        "role": "admin"
    }
}
```

#### POST /backend/api/logout.php
Destroy session and logout user.

Response:
```json
{
    "success": true,
    "message": "Logged out successfully"
}
```

#### POST /backend/api/change_password.php
Change user password.

Request:
```json
{
    "old_password": "string",
    "new_password": "string"
}
```

Response:
```json
{
    "success": true,
    "message": "Password changed successfully"
}
```

## Frontend Components

### login.html
Manager login form with AJAX submission. Clean, minimal design with dark theme.

### dashboard.html
Protected page that requires authentication. Displays after successful login.

### auth.js
AJAX functions for authentication:
- `handleLogin()` - Login form submission
- `checkAuth()` - Check if user is authenticated
- `logout()` - Logout user

## Security Features

1. **Password Hashing** - BCRYPT with default cost
2. **HTTPOnly Cookies** - Prevents JavaScript access
3. **SameSite Cookies** - CSRF protection
4. **Session Timeout** - 1 hour of inactivity
5. **SQL Prevention** - PDO prepared statements
6. **Error Messages** - Generic messages to prevent user enumeration

## User Roles

- `admin` - Full system access (manager accounts)
- `staff` - Standard user access (future)

## Database Schema

Users are stored in the `users` table with these fields:
- `id` - Primary key
- `username` - Unique username
- `email` - User email
- `password_hash` - BCRYPT hash
- `first_name` - User first name
- `last_name` - User last name
- `role` - User role (admin or staff)
- `is_active` - Account status
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

## Setup Instructions

1. Create database: `CREATE DATABASE book_express;`
2. Run schema: `mysql -u root book_express < database/schema.sql`
3. Add manager user: `mysql -u root book_express < database/migrations/002_add_manager_user.sql`
4. Configure .env with database credentials (MySQL root user by default)
5. Place project in XAMPP htdocs folder (C:\xampp\htdocs\)
6. Start Apache and MySQL in XAMPP
7. Access via `http://localhost/Book-Express/frontend/login.html`

### Login with:
- **Username:** manager
- **Password:** Manager@2025

## Testing

### Manual Login Test
1. Navigate to `/frontend/login.html`
2. Login with manager credentials
3. Access `/frontend/dashboard.html` to verify session

### API Testing with cURL
```bash
# Login
curl -X POST http://localhost/Book-Express/backend/api/login.php \
  -H "Content-Type: application/json" \
  -d '{"username":"manager","password":"Manager@2025"}'

# Check user
curl http://localhost/Book-Express/backend/api/user.php
```
## Future Enhancements

- User creation, edit, and deletion by manager
- Multiple roles (staff, manager, admin)
- Account status management
- Password reset functionality
