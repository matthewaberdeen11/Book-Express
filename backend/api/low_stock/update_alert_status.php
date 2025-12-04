<?php
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

$user = SessionManager::getUser();

if (!in_array($user['role'], ['admin', 'staff'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Insufficient permissions']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $input = json_decode(file_get_contents('php://input'), true);

    if (empty($input['alert_id']) || empty($input['status'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Alert ID and status are required']);
        exit;
    }

    $alertId = $input['alert_id'];
    $status = $input['status'];
    $notes = $input['notes'] ?? '';

    //Validates status
    $validStatuses = ['pending', 'acknowledged', 'reorder_initiated', 'resolved'];
    if (!in_array($status, $validStatuses)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid status']);
        exit;
    }

    $conn = get_db_connection();
    $conn->beginTransaction();

    //Update alert status
    $stmt = $conn->prepare('
        UPDATE low_stock_alerts
        SET status = ?, last_updated = NOW()
        WHERE id = ?
    ');
    $stmt->execute([$status, $alertId]);

    //Logs status change in history
    $stmt = $conn->prepare('
        INSERT INTO low_stock_history
        (alert_id, status, notes, updated_by)
        VALUES (?, ?, ?, ?)
    ');
    $stmt->execute([
        $alertId,
        $status,
        $notes,
        $user['id']
    ]);

    $conn->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Alert status updated successfully'
    ]);

} catch (Exception $e) {
    if (isset($conn)) {
        $conn->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
