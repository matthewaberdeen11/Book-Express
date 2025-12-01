-- Insert predefined manager user
-- Username: manager
-- Password: Manager@2025
-- This user has full system access

INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
VALUES (
    'manager',
    'manager@bookexpress.local',
    '$2y$10$7TIo5.k6F4.5m1N2O3P4Qu.Y1aB2cD3eF4gH5iJ6kL7mN8oP9qR',
    'System',
    'Manager',
    'admin',
    true
);
