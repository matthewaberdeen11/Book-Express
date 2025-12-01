<?php
// Session manager - handles initialization and configuration

class SessionManager {
    public static function init() {
        if (session_status() === PHP_SESSION_NONE) {
            session_name(getenv('SESSION_NAME') ?: 'BOOK_EXPRESS_SESSION');
            session_set_cookie_params([
                'lifetime' => 3600,
                'path' => '/',
                'httponly' => true,
                'samesite' => 'Strict'
            ]);
            session_start();
        }
        
        self::validateSession();
    }
    
    private static function validateSession() {
        if (isset($_SESSION['user_id'])) {
            $session_timeout = getenv('SESSION_TIMEOUT') ?: 3600;
            $last_activity = $_SESSION['last_activity'] ?? time();
            
            if (time() - $last_activity > $session_timeout) {
                self::destroy();
                return;
            }
            
            $_SESSION['last_activity'] = time();
        }
    }
    
    public static function isAuthenticated() {
        return isset($_SESSION['user_id']);
    }
    
    public static function setUser($user_id, $username, $role) {
        $_SESSION['user_id'] = $user_id;
        $_SESSION['username'] = $username;
        $_SESSION['role'] = $role;
        $_SESSION['last_activity'] = time();
    }
    
    public static function getUser() {
        if (self::isAuthenticated()) {
            return [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'role' => $_SESSION['role']
            ];
        }
        return null;
    }
    
    public static function destroy() {
        $_SESSION = [];
        session_destroy();
    }
}
