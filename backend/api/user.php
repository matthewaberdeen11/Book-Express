<?php
// Get current user endpoint

header('Content-Type: application/json');

require_once __DIR__ . '/../auth/SessionManager.php';

SessionManager::init();

$user = SessionManager::getUser();

if ($user) {
    echo json_encode(['success' => true, 'user' => $user]);
} else {
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
}
