<?php
//update catalogue item details (supports both manual books and CSV items)
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

//check permissions
if (!in_array($user['role'], ['admin', 'staff', 'manager'])) {
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
    
    $item_id = $input['item_id'] ?? null;
    
    if (empty($item_id)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'item_id is required']);
        exit;
    }
    
    $conn = get_db_connection();
    
    // Get current item
    $stmt = $conn->prepare('SELECT * FROM inventory WHERE item_id = ?');
    $stmt->execute([$item_id]);
    $current = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$current) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Item not found']);
        exit;
    }
    
    $conn->beginTransaction();
    
    // Track changes
    $update_parts = [];
    $update_values = [];
    $price_changed = false;
    
    // Parse current rate (remove "JMD" prefix if present)
    $current_rate_numeric = floatval(preg_replace('/[^\d.]/', '', $current['rate'] ?? '0'));
    $old_price = $current_rate_numeric;
    $new_price = $current_rate_numeric;
    
    if (isset($input['item_name']) && $input['item_name'] != $current['item_name']) {
        $update_parts[] = 'item_name = ?';
        $update_values[] = $input['item_name'];
    }
    if (isset($input['grade_level']) && $input['grade_level'] != $current['grade_level']) {
        $update_parts[] = 'grade_level = ?';
        $update_values[] = $input['grade_level'];
    }
    if (isset($input['rate']) && floatval($input['rate']) != $current_rate_numeric) {
        $update_parts[] = 'rate = ?';
        $update_values[] = $input['rate'];
        $price_changed = true;
        $new_price = floatval($input['rate']);
    }
    
    // Update inventory if there are changes
    if (!empty($update_parts)) {
        $update_values[] = $item_id;
        $sql = 'UPDATE inventory SET ' . implode(', ', $update_parts) . ' WHERE item_id = ?';
        $stmt = $conn->prepare($sql);
        $stmt->execute($update_values);
    }
    
    // Log price changes in audit log if price was changed
    if ($price_changed) {
        $stmt = $conn->prepare('
            INSERT INTO catalogue_audit_log 
            (item_id, user_id, action_type, old_value, new_value, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ');
        $stmt->execute([
            $item_id,
            $user['id'],
            'PRICE_UPDATE',
            $old_price,
            $new_price
        ]);
        
        // Also store in price_history table
        $stmt = $conn->prepare('
            INSERT INTO price_history (item_id, old_price, new_price, changed_by, changed_at)
            VALUES (?, ?, ?, ?, NOW())
        ');
        $stmt->execute([$item_id, $old_price, $new_price, $user['id']]);
    }
    
    // Log other updates (non-price) in audit log
    if (!empty($update_parts) && !$price_changed) {
        $stmt = $conn->prepare('
            INSERT INTO catalogue_audit_log 
            (item_id, user_id, action_type, old_value, new_value, created_at)
            VALUES (?, ?, ?, ?, ?, NOW())
        ');
        
        $stmt->execute([
            $item_id,
            $user['id'],
            'UPDATE',
            json_encode($current),
            json_encode(['item_name' => $input['item_name'] ?? $current['item_name'], 'grade_level' => $input['grade_level'] ?? $current['grade_level'], 'rate' => $input['rate'] ?? $current['rate']])
        ]);
    }
    
    $conn->commit();
    
    echo json_encode([
        'success' => true,
        'message' => 'Item updated successfully'
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
