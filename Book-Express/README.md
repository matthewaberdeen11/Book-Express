# Book Express Inventory Management System

A comprehensive inventory management system for book stores built with vanilla PHP, PostgreSQL, HTML, CSS, and AJAX.

## Overview

Book Express is a web-based inventory management system designed to help bookstores manage their stock efficiently. The system supports:

- **User Authentication** - Session-based login and access control
- **Inventory Management** - Track book stock, pricing, and availability
- **File Uploads** - Import inventory data via CSV files and daily sales updates
- **Real-time Updates** - AJAX-powered dynamic content loading

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript/AJAX
- **Backend**: PHP (Vanilla)
- **Database**: MySQL
- **Server**: XAMPP (Apache + MySQL)

## Project Structure

```
Book-Express/
├── frontend/              # Client-side code
│   ├── css/              # Stylesheets
│   └── js/               # JavaScript files
├── backend/              # Server-side code
│   ├── api/              # REST API endpoints
│   ├── auth/             # Authentication & sessions
│   ├── upload/           # File upload handling
│   ├── database/         # DB utilities
│   └── config/           # Backend configuration
├── database/             # Database files
│   ├── schema.sql        # Initial schema
│   └── migrations/       # Schema migrations
├── config/               # App configuration
├── docs/                 # Documentation
├── assets/               # Images, media
└── uploads/              # Uploaded files (secured)
```

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/matthewaberdeen11/Book-Express.git
   cd Book-Express
   ```

2. **Set up environment**
   - Copy `.env.example` to `.env`
   - Update database credentials with your PostgreSQL settings

3. **Create database**
   ```bash
   psql -U postgres -c "CREATE DATABASE book_express;"
   psql -U postgres -d book_express -f database/schema.sql
   ```

4. **Start XAMPP**
   - Start Apache and MySQL services
   - Place the project in XAMPP's htdocs folder

5. **Access the application**
   - Navigate to `http://localhost/Book-Express`

## Development Guidelines

- Work on feature branches (e.g., `Gabria`, `feature-name`)
- Follow PSR-1 PHP coding standards
- Use session-based authentication for user access
- File uploads are stored securely outside the web root
- Commit regularly with clear messages

## Team Members

- Matthew Aberdeen (Team Lead)
- Gabria (Developer)
- [Team members to be added]

## Contributing

Please refer to `docs/` for detailed contribution guidelines and API documentation.

## License

[To be determined]
2140
