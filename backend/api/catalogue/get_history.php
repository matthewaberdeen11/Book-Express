<?php
// Get adjustment history for a book
header('Content-Type: application/json');

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../auth/SessionManager.php';

SessionManager::init();

if (!SessionManager::isAuthenticated()) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $book_id = $_GET['book_id'] ?? null;
    $item_id = $_GET['item_id'] ?? null;
    
    if (empty($book_id) && empty($item_id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Book ID or Item ID is required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    if (!empty($item_id)) {
        // For CSV items (item_id provided)
        $stmt = $conn->prepare('
            SELECT 
                cal.id,
                cal.action_type,
                cal.field_changed,
                cal.old_value,
                cal.new_value,
                cal.quantity_change,
                cal.adjustment_reason,
                cal.notes,
                cal.timestamp,
                u.username,
                i.item_name as book_title
            FROM catalogue_audit_log cal
            JOIN users u ON cal.user_id = u.id
            LEFT JOIN inventory i ON cal.item_id = i.item_id
            WHERE cal.item_id = ?
            ORDER BY cal.timestamp DESC
            LIMIT 100
        ');
        $stmt->execute([$item_id]);
    } else {
        // For manual items (book_id provided)
        $stmt = $conn->prepare('
            SELECT 
                cal.id,
                cal.action_type,
                cal.field_changed,
                cal.old_value,
                cal.new_value,
                cal.quantity_change,
                cal.adjustment_reason,
                cal.notes,
                cal.timestamp,
                u.username,
                b.title as book_title
            FROM catalogue_audit_log cal
            JOIN users u ON cal.user_id = u.id
            LEFT JOIN books b ON cal.book_id = b.id
            WHERE cal.book_id = ?
            ORDER BY cal.timestamp DESC
            LIMIT 100
        ');
        $stmt->execute([$book_id]);
    }
    
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'history' => $history
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
