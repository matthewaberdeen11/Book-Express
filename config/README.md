# Configuration

This directory contains configuration files for the application.

## Files

- **.env.example** - Template for environment variables (copy to root .env)
- **database.php** - Database connection configuration
- **app.php** - Application-wide settings

## Setup

1. Copy `.env.example` from the root to create `.env`
2. Update values in `.env` with your local environment settings
3. Configuration files in this directory should load settings from `.env`

**Important**: Never commit `.env` or actual config files with secrets to Git. Use `.gitignore` to exclude them.
