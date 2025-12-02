<?php
// Login API endpoint

header('Content-Type: application/json');

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../auth/SessionManager.php';
require_once __DIR__ . '/../auth/Auth.php';

SessionManager::init();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

if (!isset($input['username']) || !isset($input['password'])) {
    echo json_encode(['success' => false, 'error' => 'Username and password required']);
    exit;
}

$auth = new Auth(get_db_connection());
$result = $auth->login($input['username'], $input['password']);

if ($result['success']) {
    SessionManager::setUser($result['user_id'], $result['username'], $result['role']);
    echo json_encode([
        'success' => true,
        'message' => 'Login successful',
        'user' => SessionManager::getUser()
    ]);
} else {
    http_response_code(401);
    echo json_encode($result);
}
