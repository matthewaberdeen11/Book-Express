-- Insert predefined manager user
-- Username: manager
-- Password: CHECK WHATSAPP CHAT
-- This user has full system access

INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_active)
VALUES (
    'manager',
    'manager@bookexpress.local',
    '$2y$10$hpGO7Aski0TRm2UNHeDwZe.MvYpY9rM3GtlQBph/mpUsY92TJxiYS',
    'System',
    'Manager',
    'admin',
    true
);
