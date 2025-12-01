<?php
// User authentication class

class Auth {
    private $db;
    
    public function __construct($database) {
        $this->db = $database;
    }
    
    public function login($username, $password) {
        try {
            $stmt = $this->db->prepare('SELECT id, username, password_hash, role, is_active FROM users WHERE username = ?');
            $stmt->execute([$username]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return ['success' => false, 'error' => 'Invalid username or password'];
            }
            
            if (!$user['is_active']) {
                return ['success' => false, 'error' => 'Account is disabled'];
            }
            
            if (!password_verify($password, $user['password_hash'])) {
                return ['success' => false, 'error' => 'Invalid username or password'];
            }
            
            return [
                'success' => true,
                'user_id' => $user['id'],
                'username' => $user['username'],
                'role' => $user['role']
            ];
            
        } catch (Exception $e) {
            return ['success' => false, 'error' => 'Login failed'];
        }
    }
    
    public function changePassword($user_id, $old_password, $new_password) {
        try {
            // Get current password hash
            $stmt = $this->db->prepare('SELECT password_hash FROM users WHERE id = ?');
            $stmt->execute([$user_id]);
            $user = $stmt->fetch();
            
            if (!$user) {
                return ['success' => false, 'error' => 'User not found'];
            }
            
            // Verify old password
            if (!password_verify($old_password, $user['password_hash'])) {
                return ['success' => false, 'error' => 'Current password is incorrect'];
            }
            
            // Validate new password
            if (strlen($new_password) < 8) {
                return ['success' => false, 'error' => 'New password must be at least 8 characters'];
            }
            
            // Update password
            $new_hash = password_hash($new_password, PASSWORD_BCRYPT);
            $stmt = $this->db->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $stmt->execute([$new_hash, $user_id]);
            
            return ['success' => true];
            
        } catch (Exception $e) {
            return ['success' => false, 'error' => 'Password change failed'];
        }
    }
}
