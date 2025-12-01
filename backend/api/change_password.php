<?php
// Change password endpoint

header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../auth/SessionManager.php';
require_once __DIR__ . '/../auth/Auth.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['old_password']) || !isset($input['new_password'])) {
    echo json_encode(['success' => false, 'error' => 'Missing required fields']);
    exit;
}

$user = SessionManager::getUser();
$auth = new Auth($db);
$result = $auth->changePassword($user['id'], $input['old_password'], $input['new_password']);

if ($result['success']) {
    echo json_encode(['success' => true, 'message' => 'Password changed successfully']);
} else {
    http_response_code(400);
    echo json_encode($result);
}
