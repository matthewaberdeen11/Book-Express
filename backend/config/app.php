<?php
// Application configuration

// Session settings
define('SESSION_NAME', getenv('SESSION_NAME') ?: 'BOOK_EXPRESS_SESSION');
define('SESSION_TIMEOUT', getenv('SESSION_TIMEOUT') ?: 3600);

// Upload settings
define('UPLOAD_DIR', __DIR__ . '/../../uploads');
define('MAX_FILE_SIZE', getenv('MAX_FILE_SIZE') ?: 10485760); // 10MB
define('ALLOWED_EXTENSIONS', ['csv', 'txt', 'xlsx']);

// Application environment
define('APP_ENV', getenv('APP_ENV') ?: 'development');
define('APP_DEBUG', (getenv('APP_DEBUG') === 'true'));

// Base URL for the application
define('BASE_URL', 'http://localhost/Book-Express');
