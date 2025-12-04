<?php
// Get adjustment history for an item
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
    $item_id = $_GET['item_id'] ?? null;
    
    if (empty($item_id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'item_id is required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    // Get adjustment and other audit history (excluding PRICE_UPDATE)
    $stmt = $conn->prepare('
        SELECT 
            cal.id,
            cal.action_type,
            cal.old_value,
            cal.new_value,
            cal.quantity_change,
            cal.adjustment_reason,
            cal.notes,
            cal.created_at,
            u.username as user_name
        FROM catalogue_audit_log cal
        LEFT JOIN users u ON cal.user_id = u.id
        WHERE cal.item_id = ? AND cal.action_type != "PRICE_UPDATE"
        ORDER BY cal.created_at DESC
        LIMIT 100
    ');
    $stmt->execute([$item_id]);
    
    $audit_history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Get price history only from price_history table (authoritative source)
    $stmt = $conn->prepare('
        SELECT 
            ph.id,
            "PRICE_UPDATE" as action_type,
            ph.old_price,
            ph.new_price,
            ph.changed_at,
            u.username as user_name
        FROM price_history ph
        LEFT JOIN users u ON ph.changed_by = u.id
        WHERE ph.item_id = ?
        ORDER BY ph.changed_at DESC
        LIMIT 100
    ');
    $stmt->execute([$item_id]);
    
    $price_history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Merge and sort both histories
    $combined = [];
    foreach ($audit_history as $entry) {
        $entry['type'] = 'audit';
        $combined[] = $entry;
    }
    foreach ($price_history as $entry) {
        $entry['type'] = 'price';
        $combined[] = $entry;
    }
    
    // Sort by timestamp
    usort($combined, function($a, $b) {
        $time_a = strtotime($a['created_at'] ?? $a['changed_at']);
        $time_b = strtotime($b['created_at'] ?? $b['changed_at']);
        return $time_b - $time_a;
    });
    
    echo json_encode([
        'success' => true,
        'history' => $combined
    ]);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
