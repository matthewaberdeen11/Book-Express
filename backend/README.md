# Backend

This directory contains all server-side PHP code for the Book Express Inventory Management system.

## Structure

- **api/** - REST API endpoints for frontend communication
- **auth/** - Authentication and session management logic
- **upload/** - File upload handling and processing
- **database/** - Database connection and query utilities
- **config/** - Backend configuration files

## Development

All PHP files should follow PSR-1 coding standards. Each subdirectory has specific responsibilities:

- Use `auth/` for login/logout and session validation
- Put file upload logic in `upload/` with security measures
- Create API endpoints in `api/` for frontend consumption
- Maintain database utilities in `database/`
