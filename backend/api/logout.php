<?php
// Logout API endpoint

header('Content-Type: application/json');

require_once __DIR__ . '/../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

SessionManager::destroy();
echo json_encode(['success' => true, 'message' => 'Logged out successfully']);
